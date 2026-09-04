import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/db'

const ALLOWED_IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp'])

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일 없음' }, { status: 400 })

  const ext = path.extname(file.name).toLowerCase() || ''
  if (!ALLOWED_IMG_EXTS.has(ext)) return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다 (jpg, png, gif, webp, heic)' }, { status: 400 })

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'activity-images', id)
  await mkdir(uploadDir, { recursive: true })

  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')}`
  await writeFile(path.join(uploadDir, safeName), buffer)
  const url = `/uploads/activity-images/${id}/${encodeURIComponent(safeName)}`

  const existing = await prisma.workActivity.findUnique({ where: { id }, select: { imageUrl: true } })
  const prev = (existing as any)?.imageUrl as string | null
  const newUrl = prev ? `${prev}|${url}` : url

  await prisma.$executeRaw`UPDATE "WorkActivity" SET "imageUrl" = ${newUrl}, "updatedAt" = datetime('now') WHERE id = ${id}`

  return NextResponse.json({ url, imageUrl: newUrl })
}
