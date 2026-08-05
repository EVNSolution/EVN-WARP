import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await req.json()
    const current = await prisma.vehicle.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: '차량을 찾을 수 없습니다.' }, { status: 404 })

    const name       = b.name       !== undefined ? String(b.name).trim()    : current.name
    const plateNo    = b.plateNo    !== undefined ? String(b.plateNo).trim() : current.plateNo
    const department = b.department !== undefined ? (b.department || null)  : current.department
    const manager    = b.manager    !== undefined ? (b.manager    || null)  : current.manager
    const cardNo     = b.cardNo     !== undefined ? (b.cardNo     || null)  : current.cardNo
    const hasCharge  = b.hasCharge  !== undefined ? !!b.hasCharge           : current.hasCharge
    const hasHipass  = b.hasHipass  !== undefined ? !!b.hasHipass           : current.hasHipass

    if (!name)    return NextResponse.json({ error: '차량명은 필수입니다.' },   { status: 400 })
    if (!plateNo) return NextResponse.json({ error: '차량번호는 필수입니다.' }, { status: 400 })

    await prisma.$executeRaw`
      UPDATE "Vehicle" SET
        "name" = ${name}, "plateNo" = ${plateNo}, "department" = ${department},
        "manager" = ${manager}, "cardNo" = ${cardNo},
        "hasCharge" = ${hasCharge ? 1 : 0}, "hasHipass" = ${hasHipass ? 1 : 0}
      WHERE id = ${id}
    `
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "Vehicle" WHERE id = ${id} LIMIT 1`
    return NextResponse.json(rows[0])
  } catch (err: any) {
    console.error('[PUT /api/vehicles/[id]]', err)
    return NextResponse.json({ error: err?.message ?? '수정 실패' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // 운행 기록과 연결된 차량이 많아 하드 삭제 대신 비활성화 처리
    await prisma.$executeRaw`UPDATE "Vehicle" SET "active" = 0 WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[DELETE /api/vehicles/[id]]', err)
    return NextResponse.json({ error: err?.message ?? '삭제 실패' }, { status: 500 })
  }
}
