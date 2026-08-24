import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const now = new Date()

  const [vehicles, reservations] = await Promise.all([
    prisma.vehicle.findMany({
      where: { active: true },
      select: { id: true, name: true, plateNo: true },
      orderBy: { name: 'asc' },
    }),
    prisma.vehicleReservation.findMany({
      where: { status: { not: '취소' } },
      select: { vehicleId: true, userName: true, purpose: true, startAt: true, endAt: true, pickupLocation: true, returnLocation: true },
      orderBy: { startAt: 'asc' },
    }),
  ])

  const byVehicle = new Map<string, typeof reservations>()
  for (const r of reservations) {
    const list = byVehicle.get(r.vehicleId) ?? []
    list.push(r)
    byVehicle.set(r.vehicleId, list)
  }

  const status = vehicles.map(v => {
    const list = byVehicle.get(v.id) ?? []

    // 현재 시각이 사용 기간에 걸쳐 있는 예약 — 사용 중
    const inUse = list.find(r => r.startAt <= now && now < r.endAt)
    if (inUse) {
      return {
        id: v.id,
        name: v.name,
        plateNo: v.plateNo,
        inUse: true,
        userName: inUse.userName,
        purpose: inUse.purpose,
        returnAt: inUse.endAt.toISOString(),
        currentLocation: inUse.pickupLocation || '차고지 미확인',
      }
    }

    // 현재 시각 이전에 종료된 예약 중 가장 최근 것의 반납지를 현재 위치로 사용
    let latest: (typeof list)[number] | null = null
    for (const r of list) {
      if (r.endAt <= now && (!latest || r.endAt > latest.endAt)) latest = r
    }

    return {
      id: v.id,
      name: v.name,
      plateNo: v.plateNo,
      inUse: false,
      currentLocation: latest?.returnLocation || '차고지 미확인',
    }
  })

  return NextResponse.json(status)
}
