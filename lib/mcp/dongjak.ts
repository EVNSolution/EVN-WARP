/**
 * 동작사무실 회의실 예약 API 클라이언트 (서버측) — 로컬 warp-mcp v0.4 의 포팅.
 * 인증: 사용자별로 저장된 X-Session-Id (내 계정 화면에서 로그인으로 바인딩).
 */

export const DONGJAK_BASE = 'https://dongjak-reservation-237884770618.asia-northeast3.run.app'

export const DONGJAK_LOGIN_GUIDE =
  '회의실 예약 계정이 연결되어 있지 않거나 로그인이 만료되었습니다. '
  + 'WARP → 내 계정 → AI 연결의 「회의실 예약 계정 연결」에서 다시 로그인해 주세요.'

export class DongjakAuthError extends Error {}

async function call(sessionId: string | null | undefined, path: string, init?: RequestInit): Promise<any> {
  if (!sessionId) throw new DongjakAuthError(DONGJAK_LOGIN_GUIDE)
  const res = await fetch(`${DONGJAK_BASE}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId, ...init?.headers },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`회의실 예약 서버 오류 (${res.status})`)
  return res.json()
}

/** 내 계정 화면 전용 — 새 세션 ID 를 로그인으로 바인딩한다. */
export async function dongjakLogin(sessionId: string, id: string, password: string): Promise<{ userName: string }> {
  const r = await call(sessionId, '/login', { method: 'POST', body: JSON.stringify({ id, password }) })
  if (!r.success) throw new Error(r.error || '로그인 실패')
  return { userName: r.userName ?? id }
}

export async function dongjakStatus(sessionId: string | null | undefined): Promise<{ loggedIn: boolean; userName?: string }> {
  try {
    const s = await call(sessionId, '/status')
    return { loggedIn: !!s.loggedIn, userName: s.userName }
  } catch {
    return { loggedIn: false }
  }
}

async function requireLogin(sessionId: string | null | undefined): Promise<{ userName: string }> {
  const s = await call(sessionId, '/status')
  if (!s.loggedIn) throw new DongjakAuthError(DONGJAK_LOGIN_GUIDE)
  return { userName: s.userName ?? '' }
}

export async function roomStatus(sessionId: string | null | undefined, date: string) {
  const { userName } = await requireLogin(sessionId)
  const r = await call(sessionId, `/reservations?date=${encodeURIComponent(date)}`)
  if (r.error) throw new Error(r.error)
  // 서버 응답의 id/시각 타입이 숫자·문자 혼재 가능 — 문자열/숫자로 정규화해 돌려준다
  const rooms = ((r.rooms ?? []) as Array<{ id: unknown; name?: string }>).map(room => ({
    id: String(room.id), name: room.name ?? String(room.id),
  }))
  const reservations = ((r.reservations ?? []) as Array<Record<string, unknown>>).map(v => ({
    id: String(v.id ?? ''),
    roomId: String(v.roomId ?? ''),
    startHour: Number(v.startHour),
    endHour: Number(v.endHour),
    title: typeof v.title === 'string' ? v.title : undefined,
    userName: typeof v.userName === 'string' ? v.userName : undefined,
  }))
  return { userName, date, rooms, reservations }
}

export async function reserveRoom(sessionId: string | null | undefined, input: {
  roomId: string; date: string; startHour: number; endHour: number; title?: string
}): Promise<string> {
  const { userName } = await requireLogin(sessionId)
  const r = await call(sessionId, '/reservations', {
    method: 'POST',
    body: JSON.stringify({ ...input, title: input.title || '회의', userName }),
  })
  if (!r.success) throw new Error(r.message || '예약에 실패했습니다.')
  return r.message || '예약되었습니다.'
}

export async function myReservations(sessionId: string | null | undefined) {
  await requireLogin(sessionId)
  const r = await call(sessionId, '/my-reservations')
  return (r.reservations ?? []) as Array<{ id: string; roomId: string; roomName?: string; date: string; startHour: number; endHour: number; title?: string }>
}

export async function cancelReservation(sessionId: string | null | undefined, id: string, roomId: string): Promise<string> {
  await requireLogin(sessionId)
  const r = await call(sessionId, `/reservations/${encodeURIComponent(id)}?roomId=${encodeURIComponent(roomId)}`, { method: 'DELETE' })
  if (!r.success) throw new Error(r.message || '취소에 실패했습니다.')
  return r.message || '예약이 취소되었습니다.'
}
