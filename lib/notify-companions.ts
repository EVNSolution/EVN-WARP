import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/createNotification'

/**
 * 활동 동반자 알림 — 활동(업무·일정)에 동반자로 적힌 팀원들에게 알림을 보낸다.
 * companions 는 쉼표로 구분된 이름 문자열("홍길동, 김철수"). 이름이 WARP 구성원과
 * 일치하는 사람에게만 가고, 등록자 본인은 제외한다. 실패해도 등록을 막지 않는다.
 */
export async function notifyCompanions(opts: {
  companions: string | null | undefined
  actorId: string | null | undefined
  actorName: string
  title: string
  date: string
  action: '등록' | '변경'
}): Promise<void> {
  try {
    const names = [...new Set((opts.companions ?? '').split(',').map(s => s.trim()).filter(Boolean))]
    if (names.length === 0) return
    const users = await prisma.user.findMany({
      where: { name: { in: names } },
      select: { id: true },
    })
    const verb = opts.action === '등록' ? '함께하는 활동으로 등록했습니다' : '함께하는 활동을 변경했습니다'
    await Promise.all(
      users.filter(u => u.id !== opts.actorId).map(u =>
        createNotification({
          userId: u.id,
          type: 'activity_companion',
          message: `${opts.actorName}님이 「${opts.title}」(${opts.date})을 ${verb}.`,
          link: '/notes',
        })),
    )
  } catch (e) {
    console.error('[notifyCompanions] 실패:', e instanceof Error ? e.message : e)
  }
}
