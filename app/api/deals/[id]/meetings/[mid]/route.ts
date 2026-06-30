import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const { mid } = await params
  await prisma.leadMeeting.delete({ where: { id: mid } })
  return NextResponse.json({ ok: true })
}
