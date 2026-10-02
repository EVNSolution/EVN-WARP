import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'
import path from 'path'
import { auth } from '@/auth'
import { geminiOCR } from '@/lib/receiptOcr'
import { CARD_RECEIPT_PREFIX } from '@/lib/cardUsage'

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp', '.pdf'])
const MAX_BYTES   = 15 * 1024 * 1024

// 카드사용 영수증 업로드 (개인카드·현금 전용) — 내역 저장 전에 올리고 URL을 내역에 담아 저장한다
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!(session?.user as any)?.id) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일 없음' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: '파일은 15MB 이하만 가능합니다.' }, { status: 400 })

  const ext = path.extname(file.name).toLowerCase() || (file.type === 'application/pdf' ? '.pdf' : '.jpg')
  if (!ALLOWED_EXT.has(ext)) return NextResponse.json({ error: '이미지 또는 PDF만 첨부할 수 있습니다.' }, { status: 400 })

  const month    = new Date().toISOString().slice(0, 7)
  const filename = `${randomUUID()}${ext}`
  const dir      = path.join(process.cwd(), 'public', 'uploads', 'card-receipts', month)
  await mkdir(dir, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(dir, filename), buffer)
  const url = `${CARD_RECEIPT_PREFIX}${month}/${filename}`

  const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'].includes(file.type)
  if (isImage && process.env.GOOGLE_API_KEY?.trim()) {
    try { return NextResponse.json({ url, amount: await geminiOCR(buffer, file.type) }) } catch {}
  }
  return NextResponse.json({ url, amount: null })
}
