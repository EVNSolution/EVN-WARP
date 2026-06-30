import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/* PUT /api/company-kpi/[id]/entry — 월별 목표/실적 upsert */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyKpiId } = await params
  const { year, month, target, actual, memo } = await req.json()

  if (!year || !month) {
    return NextResponse.json({ error: 'year, month 필수' }, { status: 400 })
  }

  const entry = await prisma.companyKpiEntry.upsert({
    where:  { companyKpiId_year_month: { companyKpiId, year, month } },
    create: { companyKpiId, year, month, target: target ?? null, actual: actual ?? null, memo: memo ?? null },
    update: {
      ...(target !== undefined && { target: target ?? null }),
      ...(actual !== undefined && { actual: actual ?? null }),
      ...(memo   !== undefined && { memo:   memo   ?? null }),
    },
  })
  return NextResponse.json(entry)
}
