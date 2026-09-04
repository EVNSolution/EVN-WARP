import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import path from 'path'
import fs from 'fs/promises'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads')
const ALLOWED_EXTS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.hwp', '.ppt', '.pptx', '.txt', '.zip'])

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!(session?.user as any)?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

  const ext = (file.name.match(/\.\w+$/)?.[0] ?? '').toLowerCase()
  if (!ALLOWED_EXTS.has(ext)) return NextResponse.json({ error: '지원하지 않는 파일 형식입니다' }, { status: 400 })

  const uploadDir = path.join(UPLOADS_DIR, 'suggestions')
  await fs.mkdir(uploadDir, { recursive: true })

  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')}`
  await fs.writeFile(path.join(uploadDir, safeName), Buffer.from(await file.arrayBuffer()))

  return NextResponse.json({ name: file.name, url: `/api/uploads/suggestions/${encodeURIComponent(safeName)}` })
}
