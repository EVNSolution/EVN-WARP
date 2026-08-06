import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { prisma } from '@/lib/db'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads')

// DELETE /api/deals/[id]/documents/[docId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params

  const doc = await prisma.dealDocument.findUnique({ where: { id: docId } })
  if (!doc || doc.dealId !== id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 신규 경로(/api/uploads/...)는 UPLOADS_DIR 기준, 구 경로(/uploads/...)는 public/ 기준으로 해석
  const relPath = doc.filePath.startsWith('/api/uploads/')
    ? doc.filePath.slice('/api/uploads/'.length)
    : null
  const absPath = relPath
    ? path.join(UPLOADS_DIR, relPath)
    : path.join(process.cwd(), 'public', doc.filePath)
  if (existsSync(absPath)) {
    await unlink(absPath).catch(() => {})
  }

  await prisma.dealDocument.delete({ where: { id: docId } })
  return NextResponse.json({ ok: true })
}
