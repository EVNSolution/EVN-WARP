import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const [vehicles, reservations] = await Promise.all([
    prisma.vehicle.findMany({
      where: { active: true },
      select: { id: true, name: true, plateNo: true },
      orderBy: { name: 'asc' },
    }),
    prisma.vehicleReservation.findMany({
      where: { status: '완료' },
      select: { vehicleId: true, returnLocation: true, endAt: true },
      orderBy: { endAt: 'desc' },
    }),
  ])

  // vehicleId별 가장 최근(반납일시 기준) 완료 예약 하나만 남긴다
  const latestByVehicle = new Map<string, string | null>()
  for (const r of reservations) {
    if (!latestByVehicle.has(r.vehicleId)) latestByVehicle.set(r.vehicleId, r.returnLocation)
  }

  const status = vehicles.map(v => ({
    id: v.id,
    name: v.name,
    plateNo: v.plateNo,
    currentLocation: latestByVehicle.get(v.id) || '차고지 미확인',
  }))

  return NextResponse.json(status)
}
