import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getWeekId } from '@/lib/week'
import { auth } from '@/auth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  const week = searchParams.get('week')

  const where: any = {}
  if (week) {
    where.week = week
  } else if (from && to) {
    where.date = { gte: from, lte: to }
  }

  const activities = await prisma.workActivity.findMany({
    where,
    include: { task: { select: { id: true, code: true, title: true, strategy: true } }, team: true },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(activities)
}

export async function POST(req: NextRequest) {
  try {
    const [body, session] = await Promise.all([req.json(), auth()])
    const { taskId, teamId, date, endDate, type, title, content, mentions, kpiItemId, kpiWeek, actualNum, countermeasureId, userId, userName, planStatus, referenceUrl,
      expenseTransport, expenseAccomm, expenseMeal, expenseOther, expenseNote,
      expenseTransportReceipt, expenseAccommReceipt, expenseMealReceipt, expenseOtherReceipt } = body

    if (!teamId || !date || !type || !title?.trim()) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })
    }

    if ((type === '실적추가' || type === '세금계산서 발행') && kpiItemId && kpiWeek && actualNum != null && taskId) {
      await prisma.kpiActual.upsert({
        where:  { kpiItemId_week: { kpiItemId, week: kpiWeek } },
        create: { kpiItemId, taskId, week: kpiWeek, actual: String(actualNum), actualNum },
        update: { actual: String(actualNum), actualNum },
      })
    }

    const me = session?.user as any
    const resolvedUserId   = userId   || me?.id   || null
    const resolvedUserName = userName || me?.name  || null

    const week = getWeekId(new Date(date))
    const activity = await prisma.workActivity.create({
      data: {
        taskId:           taskId           || null,
        teamId,
        date, endDate: endDate || null, week, type,
        title:            title.trim(),
        content:          content          || null,
        mentions:         mentions         || null,
        planStatus:       planStatus === '완료' ? '완료' : '계획',
        referenceUrl:     referenceUrl || null,
        kpiItemId:        kpiItemId        || null,
        kpiWeek:          kpiWeek          || null,
        countermeasureId: countermeasureId || null,
        userId:   resolvedUserId,
        userName: resolvedUserName,
        expenseTransport:        expenseTransport        ?? null,
        expenseAccomm:           expenseAccomm           ?? null,
        expenseMeal:             expenseMeal             ?? null,
        expenseOther:            expenseOther            ?? null,
        expenseNote:             expenseNote             || null,
        expenseTransportReceipt: expenseTransportReceipt || null,
        expenseAccommReceipt:    expenseAccommReceipt    || null,
        expenseMealReceipt:      expenseMealReceipt      || null,
        expenseOtherReceipt:     expenseOtherReceipt     || null,
      },
    })
    return NextResponse.json(activity, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/activities]', err)
    return NextResponse.json({ error: err?.message ?? '저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
