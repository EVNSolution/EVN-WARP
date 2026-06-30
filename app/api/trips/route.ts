import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const userId = searchParams.get('userId')

  const where: any = {}
  if (status && status !== '전체') where.status = status
  if (userId) where.userId = userId

  const trips = await prisma.tripReport.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(trips)
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    const trip = await prisma.tripReport.create({
      data: {
        type:            b.type,
        title:           b.title,
        userId:          b.userId          ?? null,
        userName:        b.userName        ?? '',
        teamName:        b.teamName        ?? null,
        destination:     b.destination,
        purpose:         b.purpose,
        visitTarget:     b.visitTarget     ?? null,
        companions:      b.companions      ?? null,
        startDate:       b.startDate,
        endDate:         b.endDate,
        transport:       b.transport       ?? null,
        accommodation:   b.accommodation   ?? null,
        budgetTransport: b.budgetTransport ?? null,
        budgetAccomm:    b.budgetAccomm    ?? null,
        budgetMeal:      b.budgetMeal      ?? null,
        budgetOther:     b.budgetOther     ?? null,
        actualTransport: b.actualTransport ?? null,
        actualAccomm:    b.actualAccomm    ?? null,
        actualMeal:      b.actualMeal      ?? null,
        actualOther:     b.actualOther     ?? null,
        schedule:        b.schedule        ?? null,
        result:          b.result          ?? null,
        nextAction:      b.nextAction      ?? null,
        status:          b.status          ?? '초안',
        approverId:      b.approverId      ?? null,
        approverName:    b.approverName    ?? null,
        approversJson:   b.approversJson   ?? null,
        preApproverId:   b.preApproverId   ?? null,
        preApproverName: b.preApproverName ?? null,
      },
    })
    return NextResponse.json(trip, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/trips]', err)
    return NextResponse.json({ error: err?.message ?? '저장 오류' }, { status: 500 })
  }
}
