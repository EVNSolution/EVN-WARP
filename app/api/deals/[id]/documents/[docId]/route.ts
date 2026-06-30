import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { prisma } from '@/lib/db'

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

  const absPath = path.join(process.cwd(), 'public', doc.filePath)
  if (existsSync(absPath)) {
    await unlink(absPath).catch(() => {})
  }

  await prisma.dealDocument.delete({ where: { id: docId } })
  return NextResponse.json({ ok: true })
}
