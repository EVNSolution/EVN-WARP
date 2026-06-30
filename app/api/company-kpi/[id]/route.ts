import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { label, unit, category, index, annualTarget } = await req.json()
  const kpi = await prisma.companyKpi.update({
    where: { id },
    data: {
      ...(label        !== undefined && { label: label.trim() }),
      ...(unit         !== undefined && { unit: unit || null }),
      ...(category     !== undefined && { category }),
      ...(index        !== undefined && { index }),
      ...(annualTarget !== undefined && { annualTarget: annualTarget ?? null }),
    },
  })
  return NextResponse.json(kpi)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.companyKpi.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
