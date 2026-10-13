import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/createNotification'

/**
 * 활동 동반자 알림 — 활동(업무·일정)에 동반자로 적힌 팀원들에게 알림을 보낸다.
 * companions 는 쉼표로 구분된 이름 문자열("홍길동, 김철수"). 이름이 WARP 구성원과
 * 일치하는 사람에게만 가고, 등록자 본인은 제외한다. 실패해도 등록을 막지 않는다.
 */
/** 활동 댓글 알림 — 활동 작성자 + 동반자(댓글 쓴 본인 제외)에게 보낸다. */
export async function notifyActivityComment(opts: {
  activityId: string
  title: string
  date: string
  ownerId: string | null | undefined
  companions: string | null | undefined
  commenterId: string
  commenterName: string
}): Promise<void> {
  try {
    const names = [...new Set((opts.companions ?? '').split(',').map(s => s.trim()).filter(Boolean))]
    const companionUsers = names.length
      ? await prisma.user.findMany({ where: { name: { in: names } }, select: { id: true } })
      : []
    const targets = new Set<string>(companionUsers.map(u => u.id))
    if (opts.ownerId) targets.add(opts.ownerId)
    targets.delete(opts.commenterId)
    await Promise.all([...targets].map(uid =>
      createNotification({
        userId: uid, type: 'activity_comment',
        message: `${opts.commenterName}님이 「${opts.title}」(${opts.date})에 댓글을 남겼습니다.`,
        link: `/notes?month=${opts.date.slice(0, 7)}&activity=${opts.activityId}`,
      })))
  } catch (e) {
    console.error('[notifyActivityComment] 실패:', e instanceof Error ? e.message : e)
  }
}

export interface CompanionNotifyResult {
  /** 알림이 발송된 구성원 (본인 제외) */
  notified: Array<{ name: string; email: string }>
  /** WARP 구성원과 이름이 일치하지 않아 알림을 못 보낸 이름 */
  missing: string[]
}

export async function notifyCompanions(opts: {
  companions: string | null | undefined
  actorId: string | null | undefined
  actorName: string
  title: string
  date: string
  action: '등록' | '변경' | '삭제'
  /** 알림 클릭 시 이동할 활동 id — 있으면 그 활동 상세(수정) 화면으로 간다 */
  activityId?: string
}): Promise<CompanionNotifyResult> {
  try {
    const names = [...new Set((opts.companions ?? '').split(',').map(s => s.trim()).filter(Boolean))]
    if (names.length === 0) return { notified: [], missing: [] }
    const users = await prisma.user.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true, email: true },
    })
    const found = new Set(users.map(u => u.name))
    const missing = names.filter(n => !found.has(n))
    const targets = users.filter(u => u.id !== opts.actorId)
    const verb = opts.action === '등록' ? '함께하는 활동으로 등록했습니다'
      : opts.action === '변경' ? '함께하는 활동을 변경했습니다'
        : '함께하던 활동을 삭제했습니다'
    await Promise.all(
      targets.map(u =>
        createNotification({
          userId: u.id,
          type: 'activity_companion',
          message: `${opts.actorName}님이 「${opts.title}」(${opts.date})을 ${verb}.`,
          link: opts.activityId && opts.action !== '삭제'
            ? `/notes?month=${opts.date.slice(0, 7)}&activity=${opts.activityId}`
            : '/notes',
        })),
    )
    return { notified: targets.map(u => ({ name: u.name, email: u.email })), missing }
  } catch (e) {
    console.error('[notifyCompanions] 실패:', e instanceof Error ? e.message : e)
    return { notified: [], missing: [] }
  }
}
