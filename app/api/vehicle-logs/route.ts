import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { randomUUID } from 'crypto'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId')
  const from      = searchParams.get('from')
  const to        = searchParams.get('to')

  const where: any = {}
  if (vehicleId) where.vehicleId = vehicleId
  if (from && to) where.date = { gte: from, lte: to }

  const logs = await prisma.vehicleLog.findMany({
    where,
    include: { vehicle: { select: { id: true, name: true, plateNo: true } } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(logs)
}

export async function POST(req: NextRequest) {
  try {
    const [body, session] = await Promise.all([req.json(), auth()])
    const {
      vehicleId, date, driverName, department,
      departure, destination, purpose,
      odometerBefore, odometerAfter,
      isBusinessUse, isPlan, notes, activityId,
    } = body

    if (!vehicleId || !date || !departure || !destination || !purpose) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })
    }

    const plan = isPlan ? 1 : 0
    // 계획(신청)일 때는 주행거리 0 허용
    const odomBefore = plan ? (Number(odometerBefore) || 0) : Number(odometerBefore)
    const odomAfter  = plan ? (Number(odometerAfter)  || 0) : Number(odometerAfter)
    if (!plan && (isNaN(odomBefore) || isNaN(odomAfter) || odomAfter < odomBefore)) {
      return NextResponse.json({ error: '주행거리를 확인해주세요.' }, { status: 400 })
    }

    const me             = session?.user as any
    const resolvedDriver = driverName?.trim() || me?.name || '미입력'
    const distance       = odomAfter - odomBefore
    const id             = randomUUID()
    const now            = new Date().toISOString()

    await prisma.$executeRaw`
      INSERT INTO "VehicleLog"
        ("id","vehicleId","date","driverName","department","departure","destination","purpose",
         "odometerBefore","odometerAfter","distance","isBusinessUse","isPlan","notes","activityId","createdAt","updatedAt")
      VALUES
        (${id}, ${vehicleId}, ${date}, ${resolvedDriver}, ${department ?? null},
         ${departure}, ${destination}, ${purpose},
         ${odomBefore}, ${odomAfter}, ${distance},
         ${isBusinessUse !== false ? 1 : 0}, ${plan},
         ${notes ?? null}, ${activityId ?? null}, ${now}, ${now})
    `
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "VehicleLog" WHERE id = ${id} LIMIT 1`
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/vehicle-logs]', err)
    return NextResponse.json({ error: err?.message ?? '저장 실패' }, { status: 500 })
  }
}
