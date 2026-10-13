import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { isAdminRole } from '@/lib/permissions'
import { notifyCompanions } from '@/lib/notify-companions'
import { createNotification } from '@/lib/createNotification'

/**
 * 수정·삭제 권한: 본인 활동이거나 관리자만. (userId 없는 레거시/공용 활동은 허용)
 * 통과하면 수행자(me)를 돌려줘 알림의 actor 로 쓴다 — 남이 고친 것이 작성자가 고친 것처럼 보이지 않게.
 */
async function authorize(id: string): Promise<
  | { ok: true; me: { id: string; name: string; role?: string }; activity: { userId: string | null; userName: string | null } }
  | { ok: false; res: NextResponse }
> {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return { ok: false, res: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) }
  const activity = await prisma.workActivity.findUnique({ where: { id }, select: { userId: true, userName: true } })
  if (!activity) return { ok: false, res: NextResponse.json({ error: '활동을 찾을 수 없습니다.' }, { status: 404 }) }
  if (activity.userId && activity.userId !== me.id && !isAdminRole(me.role)) {
    return { ok: false, res: NextResponse.json({ error: '본인이 등록한 활동만 수정·삭제할 수 있습니다.' }, { status: 403 }) }
  }
  return { ok: true, me, activity }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authz = await authorize(id)
  if (!authz.ok) return authz.res
  const body = await req.json()
  const { type, title, content, mentions, companions, startTime, endTime, date, endDate, kpiItemId, kpiWeek, actualNum, countermeasureId, planStatus, referenceUrl, source,
    taskId, teamId, userId, userName,
    expenseTransport, expenseAccomm, expenseMeal, expenseOther, expensePaymentMethod, expenseCardId, expenseNote,
    expenseTransportReceipt, expenseAccommReceipt, expenseMealReceipt, expenseOtherReceipt,
    documentUrl, imageUrl, visibility } = body

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
      ...(taskId   !== undefined && { taskId:   taskId   || null }),
      ...(teamId   !== undefined && { teamId:   teamId   || null }),
      ...(userId   !== undefined && { userId:   userId   || null }),
      ...(userName !== undefined && { userName: userName || null }),
      ...(type     !== undefined && { type }),
      ...(title    !== undefined && { title: title.trim() }),
      ...(content  !== undefined && { content: content || null }),
      ...(mentions   !== undefined && { mentions:   mentions   || null }),
      ...(companions !== undefined && { companions: companions || null }),
      ...(startTime  !== undefined && { startTime:  startTime  || null }),
      ...(endTime    !== undefined && { endTime:    endTime    || null }),
      ...(date     !== undefined && { date }),
      ...(endDate  !== undefined && { endDate: endDate || null }),
      ...(kpiItemId        !== undefined && { kpiItemId:        kpiItemId        || null }),
      ...(kpiWeek          !== undefined && { kpiWeek:          kpiWeek          || null }),
      ...(countermeasureId !== undefined && { countermeasureId: countermeasureId || null }),
      ...(planStatus        !== undefined && { planStatus: planStatus === '완료' ? '완료' : '계획' }),
      ...(source === 'mcp' && { source: 'mcp' }), // AI(개인 Claude) 경유 수정 표시 — 그 외 값은 무시
      ...(referenceUrl      !== undefined && { referenceUrl:      referenceUrl      || null }),
      ...(expenseTransport        !== undefined && { expenseTransport:        expenseTransport        ?? null }),
      ...(expenseAccomm           !== undefined && { expenseAccomm:           expenseAccomm           ?? null }),
      ...(expenseMeal             !== undefined && { expenseMeal:             expenseMeal             ?? null }),
      ...(expenseOther            !== undefined && { expenseOther:            expenseOther            ?? null }),
      ...(expensePaymentMethod    !== undefined && { expensePaymentMethod:    expensePaymentMethod    || null }),
      ...(expenseCardId           !== undefined && { expenseCardId:           expenseCardId           || null }),
      ...(expenseNote             !== undefined && { expenseNote:             expenseNote             || null }),
      ...(expenseTransportReceipt !== undefined && { expenseTransportReceipt: expenseTransportReceipt || null }),
      ...(expenseAccommReceipt    !== undefined && { expenseAccommReceipt:    expenseAccommReceipt    || null }),
      ...(expenseMealReceipt      !== undefined && { expenseMealReceipt:      expenseMealReceipt      || null }),
      ...(expenseOtherReceipt     !== undefined && { expenseOtherReceipt:     expenseOtherReceipt     || null }),
      ...(documentUrl             !== undefined && { documentUrl:             documentUrl             || null }),
      ...(imageUrl                !== undefined && { imageUrl:                imageUrl                || null }),
      ...(visibility              !== undefined && { visibility:              visibility              || '공개' }),
    },
  })

  // 동반자로 적힌 팀원들에게 변경 알림 — actor 는 실제 수정한 사람 (작성자가 아닐 수 있다)
  void notifyCompanions({
    companions: activity.companions, actorId: authz.me.id, actorName: authz.me.name ?? '동료',
    title: activity.title, date: activity.date, action: '변경', activityId: activity.id,
  })
  // 관리자가 남의 활동을 수정한 경우 — 작성자 본인에게도 알림
  if (activity.userId && activity.userId !== authz.me.id) {
    void createNotification({
      userId: activity.userId, type: 'activity_edited',
      message: `${authz.me.name ?? '관리자'}님이 회원님의 활동 「${activity.title}」(${activity.date})을 수정했습니다.`,
      link: `/notes?month=${activity.date.slice(0, 7)}&activity=${activity.id}`,
    })
  }

  return NextResponse.json(activity)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authz = await authorize(id)
  if (!authz.ok) return authz.res
  const before = await prisma.workActivity.findUnique({ where: { id }, select: { title: true, date: true, userId: true } })
  await prisma.workActivity.delete({ where: { id } })
  // 관리자가 남의 활동을 삭제한 경우 — 작성자 본인에게 알림
  if (before?.userId && before.userId !== authz.me.id) {
    void createNotification({
      userId: before.userId, type: 'activity_deleted',
      message: `${authz.me.name ?? '관리자'}님이 회원님의 활동 「${before.title}」(${before.date})을 삭제했습니다.`,
      link: '/notes',
    })
  }
  return NextResponse.json({ ok: true })
}
