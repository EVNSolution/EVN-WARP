/**
 * 서버 기동 시 1회 실행되는 백그라운드 작업 등록 (Next instrumentation 규약).
 * 현재: 회의실 예약(동작) 세션 keep-alive — 연결된 세션을 15분마다 사용해
 * 창업센터 업스트림 세션 만료(→ 예약 앱 무응답)를 막는다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { startDongjakKeepAlive } = await import('./lib/mcp/dongjak')
  const { prisma } = await import('./lib/db')
  startDongjakKeepAlive(async () => {
    const rows = await prisma.user.findMany({
      where: { dongjakSessionId: { not: null } },
      select: { dongjakSessionId: true },
    })
    return rows.map(r => r.dongjakSessionId).filter((s): s is string => !!s)
  })
}
