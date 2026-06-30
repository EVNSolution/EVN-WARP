import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const LOST_WHERE = {
  OR: [
    { salesStatus: '이탈' },
    { salesStatus: null as string | null, stage: '이탈' },
  ],
}

/* ── GET: 미리보기 ── */
export async function GET() {
  const deals = await prisma.salesDeal.findMany({
    where:   LOST_WHERE,
    include: {
      customer: { select: { id: true, name: true, status: true } },
      meetings: { select: { id: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const preview = deals.map(d => ({
    id:           d.id,
    name:         d.name,
    phone:        d.phone,
    stageCode:    (d as any).stageCode ?? '—',
    meetingCount: d.meetings.length,
    customerId:   d.customer?.id   ?? null,
    customerName: d.customer?.name ?? null,
    collectedAt:  d.collectedAt?.toISOString().slice(0, 10) ?? null,
  }))

  return NextResponse.json({
    count:        deals.length,
    meetingCount: deals.reduce((s, d) => s + d.meetings.length, 0),
    preview,
  })
}

/* ── POST: 삭제 실행 ── */
export async function POST() {
  /* LeadMeeting은 onDelete:Cascade 이므로 SalesDeal 삭제 시 자동 삭제 */
  const result = await prisma.salesDeal.deleteMany({ where: LOST_WHERE })

  return NextResponse.json({
    ok:      true,
    deleted: result.count,
    message: `이탈 리드 ${result.count}건이 삭제되었습니다. 고객 레코드는 유지됩니다.`,
  })
}
