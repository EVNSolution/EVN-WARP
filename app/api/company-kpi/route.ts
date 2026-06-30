import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const year = parseInt(req.nextUrl.searchParams.get('year') ?? String(new Date().getFullYear()), 10)
  const kpis = await prisma.companyKpi.findMany({
    where:   { year },
    include: { entries: { where: { year }, orderBy: { month: 'asc' } } },
    orderBy: [{ category: 'asc' }, { index: 'asc' }],
  })
  return NextResponse.json(kpis)
}

export async function POST(req: NextRequest) {
  const { year, label, unit, category, index, annualTarget } = await req.json()
  if (!year || !label?.trim() || !category) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }
  const kpi = await prisma.companyKpi.create({
    data: { year, label: label.trim(), unit: unit || null, category, index: index ?? 0, annualTarget: annualTarget ?? null },
  })
  return NextResponse.json(kpi, { status: 201 })
}
