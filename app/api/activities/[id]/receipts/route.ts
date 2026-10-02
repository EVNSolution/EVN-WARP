import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readdir } from 'fs/promises'
import path from 'path'
import { geminiOCR } from '@/lib/receiptOcr'

const CATEGORY_MAP: Record<string, string> = {
  transport: '교통비',
  accomm:    '숙박비',
  meal:      '식비',
  other:     '기타',
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
