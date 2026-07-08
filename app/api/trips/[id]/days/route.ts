import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const days = await prisma.tripDayRecord.findMany({
    where: { tripReportId: id },
    orderBy: { date: 'asc' },
  })
  return NextResponse.json(days)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const day = await prisma.tripDayRecord.create({
    data: {
      tripReportId:        id,
      date:                body.date,
      city:                body.city                || null,
      company:             body.company             || null,
      activity:            body.activity            || null,
      transportCost:       body.transportCost       ?? null,
      transportReceipt:    body.transportReceipt    || null,
      accommodationCost:   body.accommodationCost   ?? null,
      accommodationReceipt:body.accommodationReceipt|| null,
      mealCost:            body.mealCost            ?? null,
      mealReceipt:         body.mealReceipt         || null,
      otherCost:           body.otherCost           ?? null,
      otherReceipt:        body.otherReceipt        || null,
      costCurrencies:      body.costCurrencies      ?? null,
    },
  })
  return NextResponse.json(day, { status: 201 })
}
