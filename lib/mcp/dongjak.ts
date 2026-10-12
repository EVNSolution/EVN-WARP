/**
 * 동작사무실 회의실 예약 API 클라이언트 (서버측) — 로컬 warp-mcp v0.4 의 포팅.
 * 인증: 사용자별로 저장된 X-Session-Id (내 계정 화면에서 로그인으로 바인딩).
 */

export const DONGJAK_BASE = 'https://dongjak-reservation-237884770618.asia-northeast3.run.app'

export const DONGJAK_LOGIN_GUIDE =
  '회의실 예약 계정이 연결되어 있지 않거나 로그인이 만료되었습니다. '
  + 'WARP → 내 계정 → AI 연결의 「회의실 예약 계정 연결」에서 다시 로그인해 주세요.'

export class DongjakAuthError extends Error {}

/** 예약 기본정보(프로필)가 없어 예약을 진행할 수 없을 때 — 호출측이 등록 안내로 바꿔 전달한다. */
export class DongjakProfileError extends Error {}

/** WARP 에 저장해 두는 예약 기본정보 — 최초 1회 AI 가 물어서 저장하고 이후 예약에 자동 동봉한다. */
export interface DongjakProfile {
  companyName?: string
  businessNumber?: string
  phone?: string
  email?: string
  roomNumber?: string
}

async function call(sessionId: string | null | undefined, path: string, init?: RequestInit): Promise<any> {
  if (!sessionId) throw new DongjakAuthError(DONGJAK_LOGIN_GUIDE)
  // 예약 서버(Cloud Run)는 한동안 호출이 없으면 잠들어 있어 첫 응답이 수십 초 걸릴 수 있다.
  // 조회(GET)는 짧게 끊고 1회 더 길게 재시도하고, 쓰기는 중복 예약 위험이 있어 재시도하지 않는다.
  const retriable = !init?.method || init.method === 'GET'
  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await fetch(`${DONGJAK_BASE}/api${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId, ...init?.headers },
        signal: AbortSignal.timeout(retriable && attempt === 0 ? 15_000 : 30_000),
      })
    } catch (e) {
      if (retriable && attempt === 0) continue
      const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
      throw new Error(timedOut
        ? '회의실 예약 서버가 응답하지 않습니다(시간 초과). 잠시 후 다시 시도해 주세요.'
        : '회의실 예약 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.')
    }
    if (!res.ok) {
      // 서버가 주는 오류 본문(message/error)을 그대로 전달 — "400" 만으로는 원인을 알 수 없다
      const detail = await res.json().then(b => b?.message || b?.error || '').catch(() => '')
      throw new Error(detail ? `${detail} (회의실 서버 HTTP ${res.status})` : `회의실 예약 서버 오류 (${res.status})`)
    }
    return res.json()
  }
}

// ── 응답 속도용 캐시 ─────────────────────────────────────────────────────────
// 예약 서버가 콜드스타트·업스트림 지연으로 느릴 때가 많아, 성공한 조회 결과를 짧게 캐시한다.
// - 로그인 확인: 세션별 5분 (성공만 캐시 — 만료는 다음 실제 호출에서 드러난다)
// - 현황 조회: 세션+날짜별 60초는 그대로 사용, 15분까지는 「이전 결과 즉시 반환 + 백그라운드 갱신」
// 프로세스 메모리 캐시라 블루/그린 슬롯별로 따로 돌지만, 최선노력 캐시로 충분하다.

const STATUS_TTL = 5 * 60_000
const DAY_FRESH = 60_000
const DAY_STALE = 15 * 60_000

const loginCache = new Map<string, { at: number; userName: string }>()
const dayCache = new Map<string, { at: number; day: RoomDay }>()
const dayInflight = new Map<string, Promise<RoomDay>>()

function pruneCaches(): void {
  const now = Date.now()
  if (loginCache.size > 300) for (const [k, v] of loginCache) if (now - v.at > STATUS_TTL) loginCache.delete(k)
  if (dayCache.size > 300) for (const [k, v] of dayCache) if (now - v.at > DAY_STALE) dayCache.delete(k)
}

/** 로그인 확인(캐시) — 유효하면 userName 을 돌려준다. */
async function checkLogin(sessionId: string | null | undefined): Promise<string> {
  if (!sessionId) throw new DongjakAuthError(DONGJAK_LOGIN_GUIDE)
  const c = loginCache.get(sessionId)
  if (c && Date.now() - c.at < STATUS_TTL) return c.userName
  const s = await call(sessionId, '/status')
  if (!s.loggedIn) {
    loginCache.delete(sessionId)
    throw new DongjakAuthError(DONGJAK_LOGIN_GUIDE)
  }
  loginCache.set(sessionId, { at: Date.now(), userName: s.userName ?? '' })
  pruneCaches()
  return s.userName ?? ''
}

/** 예약·취소 후 해당 세션의 현황 캐시를 비운다 — 방금 바뀐 예약이 바로 보이게. */
function invalidateDayCache(sessionId: string): void {
  for (const k of dayCache.keys()) if (k.startsWith(`${sessionId}:`)) dayCache.delete(k)
}

/**
 * 예열 — AI 가 MCP 에 연결(initialize)되는 순간 잠든 예약 서버를 미리 깨우고
 * 로그인 캐시를 채워 둔다. 결과는 기다리지도 쓰지도 않는다 (fire-and-forget).
 */
export function warmDongjak(sessionId: string | null | undefined): void {
  if (!sessionId) return
  void checkLogin(sessionId).catch(() => {})
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

export interface RoomDay {
  userName: string
  date: string
  rooms: Array<{ id: string; name: string }>
  reservations: Array<{ id: string; roomId: string; startHour: number; endHour: number; title?: string; userName?: string; mine: boolean }>
  /** 이 데이터를 실제로 조회한 시각 (epoch ms) */
  asOf: number
  /** true = 예약 서버가 느려 이전 조회 결과를 대신 반환 (백그라운드에서 갱신 중) */
  stale?: boolean
}

/** 실제 네트워크 조회 — 성공 시 캐시에 기록한다. */
async function fetchDay(sessionId: string, date: string): Promise<RoomDay> {
  // 로그인 확인(대개 캐시 적중 = 네트워크 0회)과 현황 조회를 병렬로
  const [userName, r] = await Promise.all([
    checkLogin(sessionId),
    call(sessionId, `/reservations?date=${encodeURIComponent(date)}`),
  ])
  if (r.error) throw new Error(r.error)
  // ⚠️ 이 엔드포인트의 예약 필드는 snake_case 다 (room_id/start_hour/end_hour/reserver_name)
  //    — /my-reservations 의 camelCase 와 규약이 달라서, 양쪽 다 받도록 정규화한다.
  const rooms = ((r.rooms ?? []) as Array<{ id: unknown; name?: string }>).map(room => ({
    id: String(room.id), name: room.name ?? String(room.id),
  }))
  const reservations = ((r.reservations ?? []) as Array<Record<string, unknown>>).map(v => ({
    id: String(v.id ?? ''),
    roomId: String(v.room_id ?? v.roomId ?? ''),
    startHour: Number(v.start_hour ?? v.startHour),
    endHour: Number(v.end_hour ?? v.endHour),
    title: typeof v.title === 'string' && v.title ? v.title : undefined,
    userName: typeof v.reserver_name === 'string' && v.reserver_name ? v.reserver_name
      : typeof v.userName === 'string' && v.userName ? v.userName : undefined,
    mine: !!(v.is_mine ?? v.isMine),
  }))
  const day: RoomDay = { userName, date, rooms, reservations, asOf: Date.now() }
  dayCache.set(`${sessionId}:${date}`, { at: day.asOf, day })
  pruneCaches()
  return day
}

export async function roomStatus(sessionId: string | null | undefined, date: string): Promise<RoomDay> {
  if (!sessionId) throw new DongjakAuthError(DONGJAK_LOGIN_GUIDE)
  const key = `${sessionId}:${date}`
  const cached = dayCache.get(key)
  const age = cached ? Date.now() - cached.at : Infinity
  if (cached && age < DAY_FRESH) return cached.day

  // 같은 세션+날짜의 동시 조회는 한 번만 나간다 (다시 시도 연타 포함)
  let live = dayInflight.get(key)
  if (!live) {
    live = fetchDay(sessionId, date).finally(() => dayInflight.delete(key))
    dayInflight.set(key, live)
  }

  // 최근 결과가 있으면 기다리지 않고 즉시 반환 — 갱신은 백그라운드에서 진행된다
  if (cached && age < DAY_STALE) {
    live.catch(() => {})
    return { ...cached.day, stale: true }
  }
  try {
    return await live
  } catch (e) {
    // 서버가 끝내 응답하지 않아도, 너무 오래되지 않은 결과가 있으면 그것이라도 보여준다
    if (cached && age < 30 * 60_000 && !(e instanceof DongjakAuthError)) return { ...cached.day, stale: true }
    throw e
  }
}

export async function reserveRoom(sessionId: string | null | undefined, input: {
  roomId: string; date: string; startHour: number; endHour: number; title?: string
  /** 이번 예약의 사용자(예약자) 이름 — 참석자가 매번 달라 호출 때마다 받는다 */
  userName?: string
}, stored?: DongjakProfile | null): Promise<string> {
  // 실제 예약 사이트는 프로필 6종(회사명·사업자번호·이름·연락처·이메일·호실)을 함께 보낸다 — 누락하면 400.
  // WARP 에 저장된 기본정보(stored)를 우선 쓰고, 없으면 예약 사이트에 저장된 프로필로 채운다.
  const [loginName, p] = await Promise.all([
    checkLogin(sessionId),
    stored?.companyName && stored?.phone
      ? Promise.resolve({})            // 저장된 기본정보가 완비됐으면 사이트 프로필 조회를 생략
      : call(sessionId, '/profile').catch(() => ({})),
  ])
  const profile = p?.profile ?? {}
  const defaults = p?.defaults ?? {}
  const extra = {
    companyName: stored?.companyName || profile.company_name || defaults.companyName || '',
    businessNumber: stored?.businessNumber || profile.business_number || defaults.businessNumber || '',
    userName: input.userName || profile.user_name || loginName || '',
    phone: stored?.phone || profile.phone || '',
    email: stored?.email || profile.email || '',
    roomNumber: stored?.roomNumber || profile.room_number || defaults.roomNumber || '',
  }
  if (!extra.companyName || !extra.phone) {
    throw new DongjakProfileError('예약 기본정보(회사명·연락처 등)가 등록되어 있지 않아 예약할 수 없습니다.')
  }
  const r = await call(sessionId, '/reservations', {
    method: 'POST',
    body: JSON.stringify({
      roomId: input.roomId, date: input.date, startHour: input.startHour, endHour: input.endHour,
      title: input.title || '회의', ...extra,
    }),
  })
  if (!r.success) throw new Error(r.message || '예약에 실패했습니다.')
  if (sessionId) invalidateDayCache(sessionId)
  return r.message || '예약되었습니다.'
}

export async function myReservations(sessionId: string | null | undefined) {
  await checkLogin(sessionId)
  const r = await call(sessionId, '/my-reservations')
  return (r.reservations ?? []) as Array<{ id: string; roomId: string; roomName?: string; date: string; startHour: number; endHour: number; title?: string }>
}

export async function cancelReservation(sessionId: string | null | undefined, id: string, roomId: string): Promise<string> {
  await checkLogin(sessionId)
  const r = await call(sessionId, `/reservations/${encodeURIComponent(id)}?roomId=${encodeURIComponent(roomId)}`, { method: 'DELETE' })
  if (!r.success) throw new Error(r.message || '취소에 실패했습니다.')
  if (sessionId) invalidateDayCache(sessionId)
  return r.message || '예약이 취소되었습니다.'
}
