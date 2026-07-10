import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

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
    const likePattern = `%@${userName}%`
    const activities = await prisma.$queryRaw<any[]>`
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

  // 합쳐서 최신순 정렬
  const combined = [...notifications, ...mentionNotifs]
  combined.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return NextResponse.json(combined)
}
