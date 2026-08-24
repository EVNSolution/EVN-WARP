import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function GET() {
  const garages = await prisma.garage.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(garages)
}

export async function POST(req: NextRequest) {
  try {
    const { name, address, detail } = await req.json()
    if (!name?.trim() || !address?.trim()) {
      return NextResponse.json({ error: '차고지명과 주소는 필수입니다.' }, { status: 400 })
    }
    const id  = randomUUID()
    const now = new Date().toISOString()
    await prisma.$executeRaw`
      INSERT INTO "Garage" ("id","name","address","detail","active","createdAt")
      VALUES (${id}, ${name.trim()}, ${address.trim()}, ${detail || null}, 1, ${now})
    `
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "Garage" WHERE id = ${id} LIMIT 1`
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/garages]', err)
    return NextResponse.json({ error: err?.message ?? '저장 실패' }, { status: 500 })
  }
}
