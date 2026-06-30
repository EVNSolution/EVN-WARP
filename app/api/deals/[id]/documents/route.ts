import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'

// GET /api/deals/[id]/documents
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const docs = await prisma.dealDocument.findMany({
    where: { dealId: id },
    orderBy: { uploadedAt: 'asc' },
  })
  return NextResponse.json(docs)
}

// POST /api/deals/[id]/documents  (multipart/form-data)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const formData = await req.formData()
  const file      = formData.get('file') as File | null
  const stageCode = formData.get('stageCode') as string | null
  const docKey    = formData.get('docKey') as string | null
  const docLabel  = formData.get('docLabel') as string | null

  if (!file || !stageCode || !docKey || !docLabel) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', 'deals', id)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })

  const ext        = path.extname(file.name)
  const storedName = `${randomUUID()}${ext}`
  const filePath   = path.join(dir, storedName)
  const buffer     = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  const doc = await prisma.dealDocument.create({
    data: {
      dealId:     id,
      stageCode,
      docKey,
      docLabel,
      fileName:   file.name,
      storedName,
      filePath:   `/uploads/deals/${id}/${storedName}`,
      fileSize:   file.size,
      mimeType:   file.type,
    },
  })

  return NextResponse.json(doc, { status: 201 })
}
