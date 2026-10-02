import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canManageUsers } from '@/lib/permissions'
import { parseCardUsageInput, withActivityTitles } from '@/lib/cardUsageServer'

// 카드/현금 사용내역 조회
//  ?activityId=  해당 활동에 연계된 내역
//  ?from=&to=    기간 (YYYY-MM-DD)
//  ?status=      신청|승인|반려
//  ?scope=all    전체 사용자 (관리 권한자만, 그 외는 본인 내역)
export async function GET(req: NextRequest) {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json([], { status: 401 })

  const sp = req.nextUrl.searchParams
  const activityId = sp.get('activityId')
  const from   = sp.get('from')
  const to     = sp.get('to')
  const status = sp.get('status')
  const wantAll = sp.get('scope') === 'all' && await canManageUsers(me.id)

  const rows = await prisma.cardUsage.findMany({
    where: {
      ...(activityId ? { activityId } : wantAll ? {} : { userId: me.id }),
      ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(await withActivityTitles(rows))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const input = await parseCardUsageInput(await req.json(), me.id)
  if (typeof input === 'string') return NextResponse.json({ error: input }, { status: 400 })

  const id = randomUUID()
  const userName = me.name ?? null
  await prisma.$executeRaw`
    INSERT INTO "CardUsage" ("id","date","payMethod","corporateCardId","personalCardId","cardLabel","merchant","attendees",
      "category","description","amount","receiptUrl","activityId","userId","userName","status")
    VALUES (${id}, ${input.date}, ${input.payMethod}, ${input.corporateCardId}, ${input.personalCardId}, ${input.cardLabel},
      ${input.merchant}, ${input.attendees}, ${input.category}, ${input.description}, ${input.amount}, ${input.receiptUrl}, ${input.activityId},
      ${me.id}, ${userName}, '신청')`

  const row = await prisma.cardUsage.findUnique({ where: { id } })
  return NextResponse.json(row, { status: 201 })
}
