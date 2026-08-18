import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { randomUUID } from 'crypto'
import { toKstDate } from '@/lib/time'

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

    const startIso = toKstDate(startAt).toISOString()
    const endIso   = toKstDate(endAt).toISOString()

    // 같은 차량의 기존 예약과 시간이 겹치면 신청 자체를 막는다 (기존 예약은 손대지 않고, 필요 시 수동으로 수정)
    const conflict = await prisma.vehicleReservation.findFirst({
      where: {
        vehicleId,
        startAt: { lt: new Date(endIso) },
        endAt:   { gt: new Date(startIso) },
      },
    })
    if (conflict) {
      const fmt = (d: Date) => d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      return NextResponse.json({
        error: `이미 예약이 있어 신청할 수 없습니다. (${conflict.userName ?? '미입력'} · ${fmt(conflict.startAt)} ~ ${fmt(conflict.endAt)})`,
      }, { status: 409 })
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
         ${purpose}, ${startIso}, ${endIso},
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
