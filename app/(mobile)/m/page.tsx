import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import MobileHomeClient from './MobileHomeClient'

export const dynamic = 'force-dynamic'

function getWeekDates() {
  const now = new Date()
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  mon.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

const ACT_SELECT = {
  id: true, date: true, type: true, title: true, content: true, planStatus: true,
  expenseTransport: true, expenseAccomm: true, expenseMeal: true, expenseOther: true,
  expensePaymentMethod: true, mentions: true, userName: true,
  team: { select: { name: true } },
  task: { select: { title: true, code: true } },
} as const

export default async function MobileHomePage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const me     = session.user as any
  const myName = me?.name ?? ''

  const weekDates = getWeekDates()
  const from      = weekDates[0]
  const to        = weekDates[6]
  const todayStr  = new Date().toISOString().slice(0, 10)

  // 내 teamId 조회
  const myUser = await prisma.user.findUnique({
    where: { id: me.id },
    select: { teamId: true },
  })
  const myTeamId = myUser?.teamId ?? null

  const [myActivities, teamActivities, allActivities, myReservations, mentionedActivities] = await Promise.all([
    // 개인: 내 활동
    prisma.workActivity.findMany({
      where: { userName: myName, date: { gte: from, lte: to } },
      select: ACT_SELECT,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
    // 팀: 같은 팀 모든 활동 (팀 없으면 빈 배열)
    myTeamId
      ? prisma.workActivity.findMany({
          where: { teamId: myTeamId, date: { gte: from, lte: to } },
          select: ACT_SELECT,
          orderBy: [{ date: 'asc' }, { userName: 'asc' }, { createdAt: 'asc' }],
        })
      : Promise.resolve([]),
    // 전사: 모든 활동
    prisma.workActivity.findMany({
      where: { date: { gte: from, lte: to } },
      select: ACT_SELECT,
      orderBy: [{ date: 'asc' }, { userName: 'asc' }, { createdAt: 'asc' }],
    }),
    // 차량 예약
    prisma.vehicleReservation.findMany({
      where: { userName: myName, status: { not: '취소' }, endAt: { gte: new Date() } },
      select: {
        id: true, startAt: true, endAt: true, purpose: true, status: true,
        vehicle: { select: { name: true, plateNo: true } },
      },
      orderBy: { startAt: 'asc' },
      take: 3,
    }),
    // 알림: 나를 @멘션한 이번 주 활동
    prisma.workActivity.findMany({
      where: {
        mentions: { contains: myName },
        date: { gte: from, lte: to },
        userName: { not: myName },
      },
      select: ACT_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  const serializedReservations = myReservations.map(r => ({
    ...r,
    startAt: r.startAt.toISOString(),
    endAt:   r.endAt.toISOString(),
  }))

  return (
    <MobileHomeClient
      myName={myName}
      weekDates={weekDates}
      myActivities={myActivities as any}
      teamActivities={teamActivities as any}
      allActivities={allActivities as any}
      myReservations={serializedReservations}
      mentionedActivities={mentionedActivities as any}
      todayStr={todayStr}
    />
  )
}
