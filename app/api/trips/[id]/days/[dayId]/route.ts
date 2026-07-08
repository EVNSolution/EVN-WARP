import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; dayId: string }> }) {
  const { dayId } = await params
  const body = await req.json()
  const { id: _id, createdAt: _c, updatedAt: _u, tripReportId: _t, ...data } = body

  await prisma.$executeRaw`
    UPDATE "TripDayRecord" SET
      "city"                 = ${data.city                 ?? null},
      "company"              = ${data.company              ?? null},
      "activity"             = ${data.activity             ?? null},
      "transportCost"        = ${data.transportCost        ?? null},
      "transportReceipt"     = ${data.transportReceipt     ?? null},
      "accommodationCost"    = ${data.accommodationCost    ?? null},
      "accommodationReceipt" = ${data.accommodationReceipt ?? null},
      "mealCost"             = ${data.mealCost             ?? null},
      "mealReceipt"          = ${data.mealReceipt          ?? null},
      "otherCost"            = ${data.otherCost            ?? null},
      "otherReceipt"         = ${data.otherReceipt         ?? null},
      "costCurrencies"       = ${data.costCurrencies       ?? null},
      "updatedAt"            = CURRENT_TIMESTAMP
    WHERE "id" = ${dayId}
  `
  const day = await prisma.tripDayRecord.findUnique({ where: { id: dayId } })
  return NextResponse.json(day)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; dayId: string }> }) {
  const { dayId } = await params
  await prisma.tripDayRecord.delete({ where: { id: dayId } })
  return NextResponse.json({ ok: true })
}
