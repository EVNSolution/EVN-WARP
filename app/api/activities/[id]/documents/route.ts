import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/db'

const ALLOWED_EXTS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.hwp'])

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일 없음' }, { status: 400 })

  const ext = path.extname(file.name).toLowerCase() || ''
  if (!ALLOWED_EXTS.has(ext)) return NextResponse.json({ error: '지원하지 않는 파일 형식' }, { status: 400 })

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'activity-docs', id)
  await mkdir(uploadDir, { recursive: true })

  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')}`
  await writeFile(path.join(uploadDir, safeName), buffer)
  const url = `/uploads/activity-docs/${id}/${encodeURIComponent(safeName)}`

  // 기존 URL에 추가 (| 구분)
  const existing = await prisma.workActivity.findUnique({ where: { id }, select: { documentUrl: true } })
  const prev = (existing as any)?.documentUrl as string | null
  const newUrl = prev ? `${prev}|${url}` : url

  await prisma.$executeRaw`UPDATE "WorkActivity" SET "documentUrl" = ${newUrl}, "updatedAt" = datetime('now') WHERE id = ${id}`

  return NextResponse.json({ url, documentUrl: newUrl })
}
