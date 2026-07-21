import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function GET() {
  const vehicles = await prisma.vehicle.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(vehicles)
}

export async function POST(req: NextRequest) {
  try {
    const { name, plateNo, department, manager, cardNo, hasCharge, hasHipass } = await req.json()
    if (!name?.trim() || !plateNo?.trim()) {
      return NextResponse.json({ error: '차량명과 차량번호는 필수입니다.' }, { status: 400 })
    }
    const id  = randomUUID()
    const now = new Date().toISOString()
    await prisma.$executeRaw`
      INSERT INTO "Vehicle" ("id","name","plateNo","department","manager","cardNo","hasCharge","hasHipass","active","createdAt")
      VALUES (${id}, ${name.trim()}, ${plateNo.trim()}, ${department ?? null}, ${manager ?? null}, ${cardNo ?? null},
              ${hasCharge ? 1 : 0}, ${hasHipass ? 1 : 0}, 1, ${now})
    `
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "Vehicle" WHERE id = ${id} LIMIT 1`
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/vehicles]', err)
    return NextResponse.json({ error: err?.message ?? '저장 실패' }, { status: 500 })
  }
}
