import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const now  = new Date().toISOString()

  const startIso = body.startAt ? new Date(body.startAt).toISOString() : undefined
  const endIso   = body.endAt   ? new Date(body.endAt).toISOString()   : undefined

  await prisma.$executeRaw`
    UPDATE "VehicleReservation" SET
      purpose        = COALESCE(${body.purpose        ?? null}, purpose),
      startAt        = COALESCE(${startIso            ?? null}, startAt),
      endAt          = COALESCE(${endIso              ?? null}, endAt),
      pickupLocation = ${body.pickupLocation  !== undefined ? (body.pickupLocation  ?? null) : null},
      returnLocation = ${body.returnLocation  !== undefined ? (body.returnLocation  ?? null) : null},
      notes          = ${body.notes           !== undefined ? (body.notes           ?? null) : null},
      status         = COALESCE(${body.status ?? null}, status),
      updatedAt      = ${now}
    WHERE id = ${id}
  `
  const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "VehicleReservation" WHERE id = ${id} LIMIT 1`
  return NextResponse.json(rows[0] ?? {})
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.vehicleReservation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
