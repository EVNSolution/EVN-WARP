import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { label, unit, category, index, annualTarget, linkedToFunnel } = await req.json()

  // linkedToFunnel 활성화 시 다른 KPI의 연동 해제 (단일 선택)
  if (linkedToFunnel === true) {
    await prisma.companyKpi.updateMany({
      where: { id: { not: id }, linkedToFunnel: true },
      data: { linkedToFunnel: false },
    })
  }

  const kpi = await prisma.companyKpi.update({
    where: { id },
    data: {
      ...(label          !== undefined && { label: label.trim() }),
      ...(unit           !== undefined && { unit: unit || null }),
      ...(category       !== undefined && { category }),
      ...(index          !== undefined && { index }),
      ...(annualTarget   !== undefined && { annualTarget: annualTarget ?? null }),
      ...(linkedToFunnel !== undefined && { linkedToFunnel }),
    },
  })
  return NextResponse.json(kpi)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.companyKpi.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
