import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readdir } from 'fs/promises'
import path from 'path'

// Tesseract 텍스트에서 합계 금액 파싱
function extractAmountFromText(text: string): number | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const totalKeywords = [
    /합\s*계|총\s*액|결\s*제\s*금\s*액|실\s*결\s*제|청\s*구\s*금\s*액/,
    /合\s*[计計]|总\s*[计計额額]|实\s*收|应\s*付|實\s*收|應\s*付/,
    /total|grand\s*total|amount\s*due|amount\s*paid/i,
  ]
  for (const kw of totalKeywords) {
    for (let i = 0; i < lines.length; i++) {
      if (kw.test(lines[i])) {
        for (const candidate of [lines[i], lines[i + 1] ?? '']) {
          const nums = candidate.match(/[\d,，.]+/g)
          if (nums) {
            const parsed = parseFloat(nums[nums.length - 1].replace(/[,，]/g, ''))
            if (!isNaN(parsed) && parsed > 0) return parsed
          }
        }
      }
    }
  }
  // 키워드 매칭 실패 시 가장 큰 숫자로 추정
  const all: number[] = []
  for (const line of lines) {
    for (const n of (line.match(/[\d,，.]+/g) ?? [])) {
      const v = parseFloat(n.replace(/[,，]/g, ''))
      if (!isNaN(v) && v > 0) all.push(v)
    }
  }
  return all.length > 0 ? Math.max(...all) : null
}

// ── 1순위: Gemini Vision (모델 순차 폴백) ────────────────────────────
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash']

async function geminiOCR(buffer: Buffer, mimeType: string): Promise<number | null> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genai  = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const prompt = '이 영수증 이미지에서 최종 합계(총액) 금액만 숫자로 알려주세요. ' +
                 '통화 기호·쉼표·공백 없이 숫자만 답하세요. 예: 15000  또는  285.50'

  for (const modelName of GEMINI_MODELS) {
    try {
      const model  = genai.getGenerativeModel({ model: modelName })
      const result = await model.generateContent([
        { inlineData: { data: buffer.toString('base64'), mimeType: mimeType as any } },
        prompt,
      ])
      const raw    = result.response.text().trim()
      const amount = parseFloat(raw.replace(/[^0-9.]/g, ''))
      console.log(`[Gemini OCR:${modelName}] 응답: "${raw}" → ${amount}`)
      if (!isNaN(amount) && amount > 0) return amount
    } catch (e: any) {
      console.warn(`[Gemini OCR:${modelName}] 실패: ${e?.message}`)
    }
  }
  return null
}

// ── 2순위: Claude Vision ──────────────────────────────────────────────
async function claudeOCR(buffer: Buffer, mimeType: string): Promise<number | null> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType as any, data: buffer.toString('base64') } },
        { type: 'text', text: '이 영수증에서 최종 합계 금액만 숫자로 알려주세요. 숫자만 답하세요. 예: 15000' },
      ],
    }],
  })
  const raw    = (message.content[0] as any).text?.trim() ?? ''
  const amount = parseFloat(raw.replace(/[^0-9.]/g, ''))
  console.log(`[Claude OCR] 응답: "${raw}" → ${amount}`)
  return isNaN(amount) ? null : amount
}


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

  const category  = (formData.get('category') as string | null) ?? '기타'
  const date      = (formData.get('date')     as string | null) ?? ''
  const shortDate = date ? date.slice(5).replace('-', '') : ''
  const ext       = path.extname(file.name).toLowerCase() || '.jpg'

  // ── 파일 저장 (카테고리+날짜 기반 자동 명명) ─────────────────────
  const bytes     = await file.arrayBuffer()
  const buffer    = Buffer.from(bytes)
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'receipts', id)
  await mkdir(uploadDir, { recursive: true })

  let idx = 1
  try {
    const existing = await readdir(uploadDir)
    const matching = existing.filter(f => f.startsWith(category) && /^\d/.test(f.slice(category.length)))
    if (matching.length > 0) {
      const indices = matching.map(f => parseInt(f.slice(category.length)) || 0)
      idx = Math.max(...indices) + 1
    }
  } catch {}

  const filename = shortDate ? `${category}${idx}_${shortDate}${ext}` : `${category}${idx}${ext}`
  await writeFile(path.join(uploadDir, filename), buffer)
  const url = `/uploads/receipts/${id}/${encodeURIComponent(filename)}`

  // PDF는 이미지 OCR 불가
  const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'].includes(file.type)
  if (!isImage) {
    return NextResponse.json({ url, amount: null, note: 'PDF는 금액을 직접 입력해주세요.' })
  }

  // ── OCR 우선순위: Gemini → Claude → Tesseract ────────────────────
  const googleKey    = process.env.GOOGLE_API_KEY?.trim()
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim()

  if (googleKey) {
    try {
      const amount = await geminiOCR(buffer, file.type)
      return NextResponse.json({ url, amount, engine: 'gemini' })
    } catch (e: any) {
      console.error('[Gemini OCR] 실패, 다음 엔진 시도:', e?.message)
    }
  }

  if (anthropicKey) {
    try {
      const amount = await claudeOCR(buffer, file.type)
      return NextResponse.json({ url, amount, engine: 'claude' })
    } catch (e: any) {
      console.error('[Claude OCR] 실패, Tesseract 폴백:', e?.message)
    }
  }

  // API 키 없음 — 직접 입력 안내
  return NextResponse.json({ url, amount: null, note: 'OCR API 키가 설정되지 않았습니다. 금액을 직접 입력해주세요.' })
}
