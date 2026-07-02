import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { label, unit, category, index, annualTarget, linkedToFunnel } = await req.json()

  // linkedToFunnel: raw SQL로 처리 (libSQL adapter Boolean 호환성 이슈 우회)
  if (linkedToFunnel !== undefined) {
    if (linkedToFunnel === true) {
      // 기존 연동 KPI 전체 해제 후 현재 KPI만 활성화
      await prisma.$executeRaw`UPDATE "CompanyKpi" SET "linkedToFunnel" = 0`
      await prisma.$executeRaw`UPDATE "CompanyKpi" SET "linkedToFunnel" = 1 WHERE id = ${id}`
    } else {
      await prisma.$executeRaw`UPDATE "CompanyKpi" SET "linkedToFunnel" = 0 WHERE id = ${id}`
    }
  }

  // 나머지 필드는 ORM으로 업데이트
  const hasOtherFields = label !== undefined || unit !== undefined || category !== undefined
    || index !== undefined || annualTarget !== undefined

  if (hasOtherFields) {
    await prisma.companyKpi.update({
      where: { id },
      data: {
        ...(label        !== undefined && { label: label.trim() }),
        ...(unit         !== undefined && { unit: unit || null }),
        ...(category     !== undefined && { category }),
        ...(index        !== undefined && { index }),
        ...(annualTarget !== undefined && { annualTarget: annualTarget ?? null }),
      },
    })
  }

  const kpi = await prisma.companyKpi.findUnique({ where: { id } })
  return NextResponse.json(kpi)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.companyKpi.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
