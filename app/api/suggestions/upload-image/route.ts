import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import path from 'path'
import fs from 'fs/promises'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads')

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!(session?.user as any)?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

  const uploadDir = path.join(UPLOADS_DIR, 'suggestions')
  await fs.mkdir(uploadDir, { recursive: true })

  const ext = (file.name.match(/\.\w+$/)?.[0] ?? '.png').toLowerCase()
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
  const absPath  = path.join(uploadDir, safeName)
  await fs.writeFile(absPath, Buffer.from(await file.arrayBuffer()))

  return NextResponse.json({ url: `/api/uploads/suggestions/${safeName}` })
}
