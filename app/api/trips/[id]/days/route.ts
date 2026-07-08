import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'

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

  const dayId = 'c' + randomBytes(11).toString('base64url').slice(0, 23)
  await prisma.$executeRaw`
    INSERT INTO "TripDayRecord" (
      "id","tripReportId","date","city","company","activity",
      "transportCost","transportReceipt","accommodationCost","accommodationReceipt",
      "mealCost","mealReceipt","otherCost","otherReceipt","costCurrencies",
      "createdAt","updatedAt"
    ) VALUES (
      ${dayId}, ${id}, ${body.date},
      ${body.city || null}, ${body.company || null}, ${body.activity || null},
      ${body.transportCost ?? null}, ${body.transportReceipt || null},
      ${body.accommodationCost ?? null}, ${body.accommodationReceipt || null},
      ${body.mealCost ?? null}, ${body.mealReceipt || null},
      ${body.otherCost ?? null}, ${body.otherReceipt || null},
      ${body.costCurrencies ?? null},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `
  const day = await prisma.tripDayRecord.findUnique({ where: { id: dayId } })
  return NextResponse.json(day, { status: 201 })
}
