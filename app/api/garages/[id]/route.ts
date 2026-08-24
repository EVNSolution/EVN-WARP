import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await req.json()
    const current = await prisma.garage.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: '차고지를 찾을 수 없습니다.' }, { status: 404 })

    const name    = b.name    !== undefined ? String(b.name).trim()    : current.name
    const address = b.address !== undefined ? String(b.address).trim() : current.address
    const detail  = b.detail  !== undefined ? (b.detail || null)       : current.detail

    if (!name)    return NextResponse.json({ error: '차고지명은 필수입니다.' }, { status: 400 })
    if (!address) return NextResponse.json({ error: '주소는 필수입니다.' },     { status: 400 })

    await prisma.$executeRaw`
      UPDATE "Garage" SET "name" = ${name}, "address" = ${address}, "detail" = ${detail}
      WHERE id = ${id}
    `
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "Garage" WHERE id = ${id} LIMIT 1`
    return NextResponse.json(rows[0])
  } catch (err: any) {
    console.error('[PUT /api/garages/[id]]', err)
    return NextResponse.json({ error: err?.message ?? '수정 실패' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // 예약 이력과 연결될 수 있어 하드 삭제 대신 비활성화 처리
    await prisma.$executeRaw`UPDATE "Garage" SET "active" = 0 WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[DELETE /api/garages/[id]]', err)
    return NextResponse.json({ error: err?.message ?? '삭제 실패' }, { status: 500 })
  }
}
