/**
 * 서버 기동 시 1회 실행되는 백그라운드 작업 등록 (Next instrumentation 규약).
 * 현재: 회의실 예약(동작) 세션 keep-alive, 업무 키워드 예열 — 내용은 instrumentation-node.ts.
 * Node 전용 코드는 반드시 이 조건 블록 안에서만 import 한다 (Next 문서 권장 형태 —
 * early return 형태는 webpack 개발 서버가 Edge 번들에서 제거하지 못해 lib/db 의 'path' 해석에 실패한다).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node')
  }
}
