// 활동 반복 등록 — 시작일 이후 반복 일자 계산 (클라이언트 미리보기·서버 생성 공용)

export const REPEAT_OPTIONS = [
  { value: 'none',     label: '반복 안 함' },
  { value: 'weekdays', label: '매일 (평일)' },
  { value: 'daily',    label: '매일' },
  { value: 'weekly',   label: '매주' },
] as const

export type RepeatFreq = 'weekdays' | 'daily' | 'weekly'
export const MAX_REPEAT = 60   // 한 번에 만들 수 있는 최대 횟수 (시작일 포함)

// 시작일을 포함한 전체 일자 목록 (YYYY-MM-DD, UTC 기준 날짜 계산)
export function expandRepeatDates(start: string, freq: RepeatFreq, until: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(until) || until < start) return [start]
  const out: string[] = []
  const d = new Date(start + 'T00:00:00Z')
  const step = freq === 'weekly' ? 7 : 1
  while (out.length < MAX_REPEAT) {
    const s = d.toISOString().slice(0, 10)
    if (s > until) break
    const dow = d.getUTCDay()
    if (freq !== 'weekdays' || (dow !== 0 && dow !== 6) || s === start) out.push(s)
    d.setUTCDate(d.getUTCDate() + step)
  }
  return out
}

export function isRepeatFreq(v: unknown): v is RepeatFreq {
  return v === 'weekdays' || v === 'daily' || v === 'weekly'
}
