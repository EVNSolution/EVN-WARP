import Link from 'next/link'
import { prisma } from '@/lib/db'

/**
 * buildup 이벤트 미처리 배지 (#27) — 서버 컴포넌트.
 *
 * ⚠️ 전역 알림(NotificationBell)에는 싣지 않는다 — 목표관리 등 다른 용도로
 * WARP 를 쓰는 사람에게까지 고객 이벤트를 노출할 이유가 없다.
 * 고객관리·파이프라인 화면에 들어온 사람에게만 조용히 보인다. 0건이면 아무것도 없다.
 */
export default async function BuildupEventNotice() {
  let pending = 0
  try {
    pending = await prisma.buildupEvent.count({ where: { status: 'pending' } })
  } catch {
    return null // 테이블 미생성 등 — 배지는 부가 표시일 뿐, 화면을 막지 않는다
  }
  if (pending === 0) return null

  return (
    <Link href="/buildup-events"
      className="flex items-center gap-2 mx-6 mt-3 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition text-xs">
      <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center">
        {pending}
      </span>
      <span className="text-amber-800 font-semibold">
        buildup에서 온 미처리 고객 이벤트가 {pending}건 있습니다
      </span>
      <span className="text-amber-600 ml-auto">확인하기 →</span>
    </Link>
  )
}
