import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  // startAt ~ endAt 범위가 from~to 와 겹치는 예약
  const where: any = {}
  if (from && to) {
    where.AND = [
      { startAt: { lte: new Date(to + 'T23:59:59Z') } },
      { endAt:   { gte: new Date(from + 'T00:00:00Z') } },
    ]
  }

  const rows = await prisma.vehicleReservation.findMany({
    where,
    include: { vehicle: { select: { id: true, name: true, plateNo: true } } },
    orderBy: { startAt: 'asc' },
  })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  try {
    const [body, session] = await Promise.all([req.json(), auth()])
    const me = session?.user as any
    const {
      vehicleId, purpose, startAt, endAt,
      pickupLocation, returnLocation, notes,
      userName, teamName,
    } = body

    if (!vehicleId || !purpose || !startAt || !endAt) {
      return NextResponse.json({ error: '차량, 목적, 시작/반납 일시는 필수입니다.' }, { status: 400 })
    }

    const id  = randomUUID()
    const now = new Date().toISOString()
    const resolvedName = userName || me?.name || '미입력'

    await prisma.$executeRaw`
      INSERT INTO "VehicleReservation"
        ("id","vehicleId","userId","userName","teamName","purpose",
         "startAt","endAt","pickupLocation","returnLocation","notes",
         "status","createdAt","updatedAt")
      VALUES
        (${id}, ${vehicleId}, ${me?.id ?? null}, ${resolvedName}, ${teamName ?? null},
         ${purpose}, ${new Date(startAt).toISOString()}, ${new Date(endAt).toISOString()},
         ${pickupLocation ?? null}, ${returnLocation ?? null}, ${notes ?? null},
         '신청', ${now}, ${now})
    `
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "VehicleReservation" WHERE id = ${id} LIMIT 1`
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/vehicle-reservations]', err)
    return NextResponse.json({ error: err?.message ?? '저장 실패' }, { status: 500 })
  }
}
