/**
 * Node.js 런타임 전용 기동 작업 — instrumentation.ts 에서 NEXT_RUNTIME === 'nodejs' 일 때만 import 한다.
 * (Edge 번들에 lib/db 등 Node 모듈이 섞이면 webpack 개발 서버가 실패하므로 파일을 분리)
 */
import { startDongjakKeepAlive } from './lib/mcp/dongjak'
import { prisma } from './lib/db'
import { workKeywords } from './lib/work-keywords'

// 회의실 예약(동작) 세션 keep-alive — 연결된 세션을 15분마다 사용해
// 창업센터 업스트림 세션 만료(→ 예약 앱 무응답)를 막는다.
startDongjakKeepAlive(async () => {
  const rows = await prisma.user.findMany({
    where: { dongjakSessionId: { not: null } },
    select: { dongjakSessionId: true },
  })
  return rows.map(r => r.dongjakSessionId).filter((s): s is string => !!s)
})

// 업무 키워드(온톨로지) 예열 — 첫 방문자가 AI 선별을 기다리지 않게 미리 채워 둔다
void workKeywords().catch(() => {})
