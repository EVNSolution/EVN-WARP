import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const from = new Date(searchParams.get('from') ?? '')
  const to   = new Date(searchParams.get('to')   ?? '')
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'from/to 파라미터 필요' }, { status: 400 })
  }
  // to는 해당 날짜의 끝 (23:59:59)
  to.setHours(23, 59, 59, 999)

  const [meetings, newDeals, wonDeals, lostDeals, stageChanged, allActive] = await Promise.all([
    // 1. 기간 내 고객 미팅
    prisma.$queryRaw<any[]>`
      SELECT lm.id, lm.type, lm."meetingAt", lm.content, lm.result, lm."nextAction", lm.assignee,
             sd.name AS dealName, sd.id AS dealId
      FROM "LeadMeeting" lm
      JOIN "SalesDeal" sd ON lm."dealId" = sd.id
      WHERE lm."meetingAt" >= ${from} AND lm."meetingAt" <= ${to}
      ORDER BY lm."meetingAt" DESC
    `,
    // 2. 기간 내 신규 유입 리드
    prisma.$queryRaw<any[]>`
      SELECT id, name, assignee, "stageCode", "createdAt", "salesStatus"
      FROM "SalesDeal"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      ORDER BY "createdAt" DESC
    `,
    // 3. 기간 내 수주 (완료)
    prisma.$queryRaw<any[]>`
      SELECT id, name, assignee, "vehicleModel", "vehicleCount", "totalPrice",
             "closedAt", "productId"
      FROM "SalesDeal"
      WHERE "salesStatus" = '완료' AND "closedAt" >= ${from} AND "closedAt" <= ${to}
      ORDER BY "closedAt" DESC
    `,
    // 4. 기간 내 실주 (이탈)
    prisma.$queryRaw<any[]>`
      SELECT id, name, assignee, "lostReason", "closedAt"
      FROM "SalesDeal"
      WHERE "salesStatus" = '이탈' AND "closedAt" >= ${from} AND "closedAt" <= ${to}
      ORDER BY "closedAt" DESC
    `,
    // 5. 기간 내 단계 변동 (stageChangedAt 기준)
    prisma.$queryRaw<any[]>`
      SELECT id, name, assignee, "stageCode", "salesStatus", "stageChangedAt"
      FROM "SalesDeal"
      WHERE "stageChangedAt" >= ${from} AND "stageChangedAt" <= ${to}
        AND ("salesStatus" = '진행중' OR "salesStatus" IS NULL)
      ORDER BY "stageChangedAt" DESC
    `,
    // 6. 현재 활성 리드 단계 분포
    prisma.$queryRaw<any[]>`
      SELECT "stageCode", COUNT(*) AS cnt
      FROM "SalesDeal"
      WHERE ("salesStatus" = '진행중' OR "salesStatus" IS NULL)
        AND "stageCode" IS NOT NULL
      GROUP BY "stageCode"
      ORDER BY "stageCode"
    `,
  ])

  // 미팅 유형별 집계
  const meetingByType: Record<string, number> = {}
  for (const m of meetings) {
    meetingByType[m.type] = (meetingByType[m.type] ?? 0) + 1
  }

  // 수주 예상 매출 합계
  const wonRevenue = wonDeals.reduce((s: number, d: any) => s + (Number(d.totalPrice) || 0), 0)

  return NextResponse.json({
    meetings:     { total: meetings.length, byType: meetingByType, list: meetings },
    newDeals:     { count: newDeals.length, list: newDeals },
    stageChanged: { count: stageChanged.length, list: stageChanged },
    wonDeals:     { count: wonDeals.length, revenue: wonRevenue, list: wonDeals },
    lostDeals:    { count: lostDeals.length, list: lostDeals },
    stageDistribution: allActive.map(r => ({ stageCode: r.stageCode, count: Number(r.cnt) })),
  })
}
