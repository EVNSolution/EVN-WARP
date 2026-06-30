import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; expId: string }> }) {
  const { expId } = await params
  const body = await req.json()
  const { id: _id, createdAt: _c, updatedAt: _u, tripReportId: _t, ...data } = body
  const expense = await prisma.tripExpense.update({ where: { id: expId }, data })
  return NextResponse.json(expense)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; expId: string }> }) {
  const { expId } = await params
  await prisma.tripExpense.delete({ where: { id: expId } })
  return NextResponse.json({ ok: true })
}
