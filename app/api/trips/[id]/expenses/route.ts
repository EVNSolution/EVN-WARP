import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const expenses = await prisma.tripExpense.findMany({
    where: { tripReportId: id },
    orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(expenses)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const expense = await prisma.tripExpense.create({
    data: {
      tripReportId:  id,
      date:          body.date,
      category:      body.category,
      detail:        body.detail        || null,
      currency:      body.currency      || 'KRW',
      amountForeign: body.amountForeign ?? null,
      exchangeRate:  body.exchangeRate  ?? null,
      amountKrw:     body.amountKrw     ?? 0,
      receiptUrl:    body.receiptUrl    || null,
      receiptName:   body.receiptName   || null,
      memo:          body.memo          || null,
      sortOrder:     body.sortOrder     ?? 0,
    },
  })
  return NextResponse.json(expense, { status: 201 })
}
