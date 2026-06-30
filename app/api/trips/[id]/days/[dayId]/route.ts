import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; dayId: string }> }) {
  const { dayId } = await params
  const body = await req.json()
  const { id: _id, createdAt: _c, updatedAt: _u, tripReportId: _t, ...data } = body
  const day = await prisma.tripDayRecord.update({ where: { id: dayId }, data })
  return NextResponse.json(day)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; dayId: string }> }) {
  const { dayId } = await params
  await prisma.tripDayRecord.delete({ where: { id: dayId } })
  return NextResponse.json({ ok: true })
}
