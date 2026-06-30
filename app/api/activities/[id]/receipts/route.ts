import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readdir } from 'fs/promises'
import path from 'path'

const CATEGORY_MAP: Record<string, string> = {
  transport: '교통비',
  accomm:    '숙박비',
  meal:      '식비',
  other:     '기타',
}

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash']

async function geminiOCR(buffer: Buffer, mimeType: string): Promise<number | null> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genai  = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const prompt = '이 영수증 이미지에서 최종 합계(총액) 금액만 숫자로 알려주세요. 통화 기호·쉼표·공백 없이 숫자만 답하세요. 예: 15000'
  for (const modelName of GEMINI_MODELS) {
    try {
      const model  = genai.getGenerativeModel({ model: modelName })
      const result = await model.generateContent([
        { inlineData: { data: buffer.toString('base64'), mimeType: mimeType as any } },
        prompt,
      ])
      const raw    = result.response.text().trim()
      const amount = parseFloat(raw.replace(/[^0-9.]/g, ''))
      console.log(`[Activity Receipt OCR:${modelName}] "${raw}" → ${amount}`)
      if (!isNaN(amount) && amount > 0) return amount
    } catch (e: any) {
      console.warn(`[Activity Receipt OCR:${modelName}] 실패: ${e?.message}`)
    }
  }
  return null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  const category = (formData.get('category') as string | null) ?? 'other'
  const date     = (formData.get('date')     as string | null) ?? ''
  if (!file) return NextResponse.json({ error: '파일 없음' }, { status: 400 })

  const catLabel  = CATEGORY_MAP[category] ?? '기타'
  const shortDate = date ? date.slice(5).replace('-', '') : ''
  const ext       = path.extname(file.name).toLowerCase() || '.jpg'

  const bytes     = await file.arrayBuffer()
  const buffer    = Buffer.from(bytes)
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'activity-receipts', id)
  await mkdir(uploadDir, { recursive: true })

  // 카테고리별 순번
  let idx = 1
  try {
    const existing = await readdir(uploadDir)
    const matching = existing.filter(f => f.startsWith(catLabel))
    if (matching.length > 0) {
      const indices = matching.map(f => parseInt(f.slice(catLabel.length)) || 0)
      idx = Math.max(...indices) + 1
    }
  } catch {}

  const filename = shortDate ? `${catLabel}${idx}_${shortDate}${ext}` : `${catLabel}${idx}${ext}`
  await writeFile(path.join(uploadDir, filename), buffer)
  const url = `/uploads/activity-receipts/${id}/${encodeURIComponent(filename)}`

  const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'].includes(file.type)
  if (!isImage) return NextResponse.json({ url, amount: null })

  const googleKey = process.env.GOOGLE_API_KEY?.trim()
  if (googleKey) {
    try {
      const amount = await geminiOCR(buffer, file.type)
      return NextResponse.json({ url, amount, engine: 'gemini' })
    } catch {}
  }
  return NextResponse.json({ url, amount: null })
}
