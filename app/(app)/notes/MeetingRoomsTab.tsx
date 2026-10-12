'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

/**
 * 업무공간 「회의실」 탭 — 동작사무실 회의실의 날짜별 예약 현황.
 * 층(방)별로 누가 어떤 시간을 예약했는지 보여주고, 내 예약(AI 포함)은 강조 표시한다.
 * 데이터는 본인 계정에 연결된 회의실 세션으로 조회된다 (내 계정 → AI 연결에서 연결).
 * 서버가 60초 캐시 + 이전 결과 즉시 반환(stale)을 해 주므로 보통은 바로 뜬다.
 */

interface Reservation { id: string; roomId: string; startHour: number; endHour: number; title?: string; userName?: string; mine?: boolean; company?: boolean }
interface Room { id: string; name: string }
interface Day { date: string; rooms: Room[]; reservations: Reservation[]; asOf: number | null; stale: boolean }

function todayKst(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function hhmm(ms: number): string {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }).format(new Date(ms))
}

/**
 * 업무공간에 들어오면 탭과 무관하게 오늘 현황을 백그라운드로 한 번 조회한다 —
 * 잠들어 있는 예약 서버(Cloud Run)를 깨우고 서버 캐시를 채워, 회의실 탭이 즉시 뜨게 한다.
 */
export function MeetingRoomsPrewarm() {
  useEffect(() => {
    fetch(`/api/meeting-rooms?date=${todayKst()}`).catch(() => {})
  }, [])
  return null
}

/**
 * 가로 시간축 타임라인 — 방마다 한 줄, 몇 시부터 몇 시까지 차 있는지 블록으로 보인다.
 * 색: 내 예약 = 연두(라임), 우리 회사(WARP 구성원 이름 일치) = 옅은 파랑, 외부 = 회색.
 */
function RoomTimeline({ rooms, reservations, dimmed }: { rooms: Room[]; reservations: Reservation[]; dimmed: boolean }) {
  // 기본 8시~20시 축 — 범위 밖 예약이 있으면 축을 넓힌다
  const starts = reservations.map(r => r.startHour).filter(Number.isFinite)
  const ends = reservations.map(r => r.endHour).filter(Number.isFinite)
  const minH = Math.min(8, ...(starts.length ? starts : [8]))
  const maxH = Math.max(20, ...(ends.length ? ends : [20]))
  const n = maxH - minH
  const hours = Array.from({ length: n }, (_, i) => minH + i)
  const grid = { display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)` } as const

  const blockClass = (r: Reservation) =>
    r.mine ? 'bg-lime-200 border-lime-400 text-lime-900 font-semibold'
      : r.company ? 'bg-sky-100 border-sky-300 text-sky-800'
        : 'bg-slate-200 border-slate-300 text-slate-600'

  return (
    <div className={dimmed ? 'opacity-60' : ''}>
      {/* 시간축 헤더 */}
      <div className="flex items-end gap-4 px-4 mb-1">
        <div className="w-28 shrink-0" />
        <div className="flex-1" style={grid}>
          {hours.map(h => (
            <div key={h} className="text-[9px] text-slate-400 -ml-0.5">{h}</div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {rooms.map(room => {
          const taken = reservations
            .filter(r => String(r.roomId) === String(room.id))
            .sort((a, b) => a.startHour - b.startHour)
          return (
            <div key={room.id} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-4">
              <div className="w-28 shrink-0">
                <div className="text-sm font-semibold text-slate-700">{room.name}</div>
                <div className="text-[10px] text-slate-400">{room.id}</div>
              </div>
              <div className="flex-1 h-8 rounded-lg overflow-hidden bg-slate-50" style={grid}>
                {hours.map((h, i) => (
                  <div key={h} style={{ gridColumn: `${i + 1}`, gridRow: 1 }}
                    className={`h-full ${i < n - 1 ? 'border-r border-slate-100' : ''}`} />
                ))}
                {taken.map(r => {
                  const s = Math.max(r.startHour, minH)
                  const e = Math.min(r.endHour, maxH)
                  if (!(e > s)) return null
                  const label = `${r.startHour}–${r.endHour}시 · ${r.userName ?? '예약자 미상'}${r.title && r.title !== r.userName ? ` · ${r.title}` : ''}${r.mine ? ' (나)' : ''}`
                  return (
                    <div key={r.id} title={label}
                      style={{ gridColumn: `${s - minH + 1} / ${e - minH + 1}`, gridRow: 1 }}
                      className={`z-10 self-stretch my-0.5 mx-px rounded-md border px-1.5 flex items-center overflow-hidden text-[10px] ${blockClass(r)}`}>
                      <span className="truncate">{r.userName ?? r.title ?? '예약'}{r.mine ? ' (나)' : ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MeetingRoomsTab() {
  const [date, setDate] = useState(todayKst())
  const [loading, setLoading] = useState(true)
  const [slow, setSlow] = useState(false)
  const [connected, setConnected] = useState(true)
  const [day, setDay] = useState<Day | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  // 이전 결과(stale)를 받은 경우 서버가 뒤에서 갱신 중 — 잠시 뒤 자동으로 최신본을 다시 가져온다 (최대 2회)
  const autoRefresh = useRef(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    setSlow(false)
    const slowTimer = setTimeout(() => { if (alive) setSlow(true) }, 3_000)
    fetch(`/api/meeting-rooms?date=${date}`)
      .then(r => r.json())
      .then(r => {
        if (!alive) return
        if (r.error) { setError(r.error); return }
        setConnected(r.connected !== false)
        if (r.connected !== false) {
          setDay({ date, rooms: r.rooms ?? [], reservations: r.reservations ?? [], asOf: r.asOf ?? null, stale: !!r.stale })
          if (r.stale && autoRefresh.current < 2) {
            autoRefresh.current += 1
            setTimeout(() => { if (alive) setRetry(n => n + 1) }, 7_000)
          }
          if (!r.stale) autoRefresh.current = 0
        }
      })
      .catch(() => { if (alive) setError('조회에 실패했습니다.') })
      .finally(() => { clearTimeout(slowTimer); if (alive) setLoading(false) })
    return () => { alive = false; clearTimeout(slowTimer) }
  }, [date, retry])

  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(`${date}T00:00:00Z`).getUTCDay()]
  // 보여줄 데이터는 현재 날짜와 일치할 때만 — 날짜 이동 중 이전 날짜 데이터가 섞여 보이지 않게
  const view = day && day.date === date ? day : null

  return (
    <div>
      {/* 날짜 이동 */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setDate(d => shiftDate(d, -1))}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronLeft size={15} /></button>
        <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700" />
        <span className="text-sm text-slate-500">({weekday})</span>
        <button onClick={() => setDate(d => shiftDate(d, 1))}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronRight size={15} /></button>
        <button onClick={() => setDate(todayKst())}
          className="ml-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">오늘</button>
        <button onClick={() => { autoRefresh.current = 0; setRetry(n => n + 1) }} disabled={loading} title="새로고침"
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
        <span className="ml-auto text-[11px] text-slate-400 flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-lime-200 border border-lime-400" /> 내 예약</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-sky-100 border border-sky-300" /> 우리 회사</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-slate-200 border border-slate-300" /> 외부</span>
        </span>
      </div>

      {!connected ? (
        <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl p-8 text-center">
          회의실 예약 계정이 연결되어 있지 않습니다.<br />
          <Link href="/account" className="text-indigo-600 font-semibold hover:underline">내 계정 → AI 연결</Link>에서
          서울창업센터(동작) 계정을 연결하면 현황을 볼 수 있습니다.
        </div>
      ) : view ? (
        <>
          {(view.stale || error) && (
            <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 flex items-center justify-between gap-2">
              <span>
                {view.asOf ? `${hhmm(view.asOf)} 기준 조회 결과입니다` : '이전 조회 결과입니다'}
                {error ? ' — 예약 서버 응답이 지연되고 있어 최신 현황을 받지 못했습니다.' : ' — 최신 현황을 가져오는 중입니다.'}
              </span>
              <button onClick={() => setRetry(n => n + 1)} className="shrink-0 underline hover:no-underline">새로고침</button>
            </div>
          )}
          <RoomTimeline rooms={view.rooms} reservations={view.reservations} dimmed={loading} />
        </>
      ) : loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">
          불러오는 중...
          {slow && (
            <div className="text-[11px] text-slate-400 mt-2">
              예약 서버가 잠들어 있어 깨우는 중입니다 — 처음 한 번은 최대 1분 정도 걸릴 수 있습니다.
            </div>
          )}
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 border border-red-100 bg-red-50 rounded-xl p-5 text-center">
          {error}
          <div className="mt-3">
            <button onClick={() => setRetry(n => n + 1)}
              className="px-3 py-1.5 rounded-lg border border-red-200 bg-white text-xs text-red-500 hover:bg-red-50">
              다시 시도
            </button>
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-slate-400 mt-4">
        예약·취소는 AI(&ldquo;내일 2시 회의실 잡아줘&rdquo;) 또는 예약 사이트에서 — 이 화면은 조회 전용입니다.
      </p>
    </div>
  )
}
