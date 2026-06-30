import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { type, title, content, mentions, date, endDate, kpiItemId, kpiWeek, actualNum, countermeasureId, planStatus, referenceUrl,
    expenseTransport, expenseAccomm, expenseMeal, expenseOther, expenseNote,
    expenseTransportReceipt, expenseAccommReceipt, expenseMealReceipt, expenseOtherReceipt } = body

  if (type === '실적추가' && kpiItemId && kpiWeek && actualNum != null) {
    const act = await prisma.workActivity.findUnique({ where: { id }, select: { taskId: true } })
    if (act?.taskId) {
      await prisma.kpiActual.upsert({
        where:  { kpiItemId_week: { kpiItemId, week: kpiWeek } },
        create: { kpiItemId, taskId: act.taskId, week: kpiWeek, actual: String(actualNum), actualNum },
        update: { actual: String(actualNum), actualNum },
      })
    }
  }

  const activity = await prisma.workActivity.update({
    where: { id },
    data: {
      ...(type     !== undefined && { type }),
      ...(title    !== undefined && { title: title.trim() }),
      ...(content  !== undefined && { content: content || null }),
      ...(mentions !== undefined && { mentions: mentions || null }),
      ...(date     !== undefined && { date }),
      ...(endDate  !== undefined && { endDate: endDate || null }),
      ...(kpiItemId        !== undefined && { kpiItemId:        kpiItemId        || null }),
      ...(kpiWeek          !== undefined && { kpiWeek:          kpiWeek          || null }),
      ...(countermeasureId !== undefined && { countermeasureId: countermeasureId || null }),
      ...(planStatus        !== undefined && { planStatus: planStatus === '완료' ? '완료' : '계획' }),
      ...(referenceUrl      !== undefined && { referenceUrl:      referenceUrl      || null }),
      ...(expenseTransport        !== undefined && { expenseTransport:        expenseTransport        ?? null }),
      ...(expenseAccomm           !== undefined && { expenseAccomm:           expenseAccomm           ?? null }),
      ...(expenseMeal             !== undefined && { expenseMeal:             expenseMeal             ?? null }),
      ...(expenseOther            !== undefined && { expenseOther:            expenseOther            ?? null }),
      ...(expenseNote             !== undefined && { expenseNote:             expenseNote             || null }),
      ...(expenseTransportReceipt !== undefined && { expenseTransportReceipt: expenseTransportReceipt || null }),
      ...(expenseAccommReceipt    !== undefined && { expenseAccommReceipt:    expenseAccommReceipt    || null }),
      ...(expenseMealReceipt      !== undefined && { expenseMealReceipt:      expenseMealReceipt      || null }),
      ...(expenseOtherReceipt     !== undefined && { expenseOtherReceipt:     expenseOtherReceipt     || null }),
    },
  })
  return NextResponse.json(activity)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.workActivity.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
