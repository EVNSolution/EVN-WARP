import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// 오늘~7일 이내 날짜들을 YYYY-MM-DD 배열로 반환
function nextSevenDays(): string[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

// 해당 월의 마지막 날 반환
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function buildScheduleNotifs(rules: any[]): any[] {
  const days = nextSevenDays()
  const result: any[] = []

  for (const rule of rules) {
    if (!rule.active) continue
    for (const dateStr of days) {
      const d = new Date(dateStr + 'T00:00:00')
      const year = d.getFullYear()
      const month = d.getMonth()
      const dom = d.getDate()
      const dow = d.getDay() // 0=Sun

      let match = false
      if (rule.recurrence === 'WEEKLY_DOW') {
        match = rule.dayOfWeek === dow
      } else if (rule.recurrence === 'MONTHLY_DAY') {
        match = rule.dayOfMonth === dom
      } else if (rule.recurrence === 'MONTHLY_LAST') {
        match = dom === lastDayOfMonth(year, month)
      } else if (rule.recurrence === 'YEARLY_MONTHDAY') {
        match = rule.month === month + 1 && rule.dayOfMonth === dom
      }

      if (match) {
        result.push({
          id: `schedule-${rule.id}-${dateStr}`,
          source: 'schedule',
          type: 'schedule',
          message: rule.title,
          scheduledDate: dateStr,
          link: null,
          read: true,
          createdAt: new Date(dateStr + 'T00:00:00').toISOString(),
        })
      }
    }
  }

  result.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
  return result
}

export async function GET() {
  const session = await auth()
  const userId = (session?.user as any)?.id
  const userName = session?.user?.name
  if (!userId) return NextResponse.json([], { status: 401 })

  // 1. 결재 알림 (Notification 테이블)
  const notifRecords = await (prisma as any).notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  const notifications = notifRecords.map((n: any) => ({ ...n, source: 'notification' }))

  // 2. @멘션/공지 알림 (WorkActivity 테이블)
  let mentionNotifs: any[] = []
  if (userName) {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { team: { select: { name: true } } },
    })
    const teamName = (userRecord as any)?.team?.name ?? null

    const likePattern = `%@${userName}%`
    let activities: any[]
    if (teamName) {
      const teamPattern = `%@${teamName}%`
      activities = await prisma.$queryRaw<any[]>`
        SELECT id, title, date, mentions
        FROM "WorkActivity"
        WHERE mentions IS NOT NULL AND mentions != ''
        AND (
          mentions LIKE '%@전체%'
          OR mentions LIKE '%@all%'
          OR mentions LIKE ${likePattern}
          OR mentions LIKE ${teamPattern}
        )
        ORDER BY date DESC
        LIMIT 20
      `
    } else {
      activities = await prisma.$queryRaw<any[]>`
        SELECT id, title, date, mentions
        FROM "WorkActivity"
        WHERE mentions IS NOT NULL AND mentions != ''
        AND (
          mentions LIKE '%@전체%'
          OR mentions LIKE '%@all%'
          OR mentions LIKE ${likePattern}
        )
        ORDER BY date DESC
        LIMIT 20
      `
    }

    mentionNotifs = activities.map((a: any) => {
      const isGlobal = a.mentions?.includes('@전체') || a.mentions?.includes('@all')
      return {
        id: `activity-${a.id}`,
        source: 'activity',
        type: isGlobal ? 'announcement' : 'mention',
        message: a.title ?? '업무 활동',
        link: `/notes/${a.id}/edit`,
        read: true,
        createdAt: a.date ? new Date(a.date).toISOString() : new Date().toISOString(),
        tripId: null,
      }
    })
  }

  // 3. 회사 운영일정 알림 (CompanyScheduleRule — 오늘~7일 이내)
  // 로컬 DB에 테이블이 없는 경우(마이그레이션 전) 빈 배열로 처리
  let scheduleNotifs: any[] = []
  try {
    const rules = await prisma.$queryRaw<any[]>`
      SELECT id, title, recurrence, dayOfWeek, dayOfMonth, active
      FROM "CompanyScheduleRule"
      WHERE active = 1
    `
    scheduleNotifs = buildScheduleNotifs(rules)
  } catch {
    // CompanyScheduleRule 테이블 미존재 시 무시
  }

  // 합쳐서 최신순 정렬
  const combined = [...notifications, ...mentionNotifs, ...scheduleNotifs]
  combined.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return NextResponse.json(combined)
}
