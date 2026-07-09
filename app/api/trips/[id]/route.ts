import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const trip = await prisma.tripReport.findUnique({ where: { id } })
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(trip)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const b = await req.json()

    // 승인요청 시 결재자 필수 체크
    if (b.status === '승인요청') {
      const existing = await prisma.tripReport.findUnique({ where: { id }, select: { approversJson: true } as any })
      const approversRaw = (b.approversJson ?? (existing as any)?.approversJson) ?? '[]'
      let approvers: any[] = []
      try { approvers = JSON.parse(approversRaw) } catch {}
      if (approvers.length === 0) {
        return NextResponse.json({ error: '결재자를 먼저 지정해주세요.' }, { status: 422 })
      }
    }

    const trip = await prisma.tripReport.update({
      where: { id },
      data: {
        type:            b.type,
        title:           b.title,
        userId:          b.userId          ?? null,
        userName:        b.userName        ?? '',
        teamName:        b.teamName        ?? null,
        travelersJson:   b.travelersJson   ?? null,
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
        status:          b.status          ?? undefined,
        approverId:      b.approverId      ?? null,
        approverName:    b.approverName    ?? null,
        approversJson:   b.approversJson   ?? null,
        preApproverId:   b.preApproverId   ?? null,
        preApproverName: b.preApproverName ?? null,
        approvalComment: b.approvalComment ?? null,
        approvedAt:      b.approvedAt      ? new Date(b.approvedAt) : null,
        submittedAt:     'submittedAt' in b ? (b.submittedAt ? new Date(b.submittedAt) : null) : undefined,
      },
    })
    return NextResponse.json(trip)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '수정 오류' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.tripReport.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
