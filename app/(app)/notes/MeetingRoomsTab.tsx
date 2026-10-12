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
interface Day { date: string; userName?: string; rooms: Room[]; reservations: Reservation[]; asOf: number | null; stale: boolean }

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
function RoomTimeline({ rooms, reservations, dimmed, onSlotClick, onMineClick }: {
  rooms: Room[]
  reservations: Reservation[]
  dimmed: boolean
  /** 빈 시간 칸 클릭 → 그 방·시각으로 예약 창 열기 */
  onSlotClick: (room: Room, hour: number) => void
  /** 내 예약 블록 클릭 → 취소 */
  onMineClick: (r: Reservation) => void
}) {
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
                  <button key={h} type="button" onClick={() => onSlotClick(room, h)}
                    title={`${h}시에 ${room.name} 예약`}
                    style={{ gridColumn: `${i + 1}`, gridRow: 1 }}
                    className={`h-full cursor-pointer hover:bg-lime-50 ${i < n - 1 ? 'border-r border-slate-100' : ''}`} />
                ))}
                {taken.map(r => {
                  const s = Math.max(r.startHour, minH)
                  const e = Math.min(r.endHour, maxH)
                  if (!(e > s)) return null
                  const label = `${r.startHour}–${r.endHour}시 · ${r.userName ?? '예약자 미상'}${r.title && r.title !== r.userName ? ` · ${r.title}` : ''}${r.mine ? ' (나)' : ''}`
                  return (
                    <div key={r.id} title={r.mine ? `${label} — 클릭하면 취소` : label}
                      onClick={r.mine ? () => onMineClick(r) : undefined}
                      style={{ gridColumn: `${s - minH + 1} / ${e - minH + 1}`, gridRow: 1 }}
                      className={`z-10 self-stretch my-0.5 mx-px rounded-md border px-1.5 flex items-center overflow-hidden text-[10px] ${blockClass(r)}${r.mine ? ' cursor-pointer hover:brightness-95' : ''}`}>
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

  // 빈 시간 클릭 → 예약 창
  const [draft, setDraft] = useState<{ roomId: string; roomName: string; startHour: number; endHour: number } | null>(null)
  const [resName, setResName] = useState('')
  const [resTitle, setResTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  const openDraft = (room: Room, hour: number) => {
    setResName(day?.userName ?? '')
    setResTitle('')
    setModalError('')
    setDraft({ roomId: room.id, roomName: room.name, startHour: hour, endHour: Math.min(hour + 1, 24) })
  }

  const submitDraft = async () => {
    if (!draft) return
    if (!resName.trim()) { setModalError('예약자 이름을 입력해 주세요.'); return }
    setSaving(true)
    setModalError('')
    try {
      const res = await fetch('/api/meeting-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: draft.roomId, date, startHour: draft.startHour, endHour: draft.endHour,
          userName: resName.trim(), title: resTitle.trim() || undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || j.error) { setModalError(j.error || '예약에 실패했습니다.'); return }
      setDraft(null)
      autoRefresh.current = 0
      setRetry(n => n + 1)
    } catch {
      setModalError('예약 요청에 실패했습니다 — 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const cancelMine = async (r: Reservation) => {
    const what = `${r.startHour}–${r.endHour}시 「${r.title ?? '회의'}」`
    if (!window.confirm(`${date} ${what} 예약을 취소할까요?`)) return
    const res = await fetch(`/api/meeting-rooms?id=${encodeURIComponent(r.id)}&roomId=${encodeURIComponent(r.roomId)}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || j.error) { window.alert(j.error || '취소에 실패했습니다.'); return }
    autoRefresh.current = 0
    setRetry(n => n + 1)
  }

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
          setDay({ date, userName: r.userName, rooms: r.rooms ?? [], reservations: r.reservations ?? [], asOf: r.asOf ?? null, stale: !!r.stale })
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
        <span className="flex items-center gap-1">
          <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700" />
          <span className="text-sm text-slate-600">({weekday})</span>
        </span>
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
          <RoomTimeline rooms={view.rooms} reservations={view.reservations} dimmed={loading}
            onSlotClick={openDraft} onMineClick={cancelMine} />
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

      {connected && (
        <p className="text-[11px] text-slate-400 mt-4">
          빈 시간을 클릭하면 바로 예약할 수 있고, 내 예약(연두)을 클릭하면 취소됩니다.
        </p>
      )}

      {/* 예약 창 */}
      {draft && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() => !saving && setDraft(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-bold text-slate-800">회의실 예약</div>
            <div className="text-xs text-slate-500 mt-1 mb-4">{draft.roomName} · {date} ({weekday})</div>

            <div className="flex items-center gap-2 mb-3">
              <select value={draft.startHour}
                onChange={e => setDraft(d => d && { ...d, startHour: Number(e.target.value), endHour: Math.max(d.endHour, Number(e.target.value) + 1) })}
                className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700">
                {Array.from({ length: 15 }, (_, i) => 7 + i).map(h => <option key={h} value={h}>{h}시</option>)}
              </select>
              <span className="text-slate-400 text-sm">~</span>
              <select value={draft.endHour}
                onChange={e => setDraft(d => d && { ...d, endHour: Number(e.target.value) })}
                className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-700">
                {Array.from({ length: 15 }, (_, i) => 8 + i).filter(h => h > draft.startHour).map(h => <option key={h} value={h}>{h}시</option>)}
              </select>
            </div>

            <input value={resName} onChange={e => setResName(e.target.value)}
              placeholder="예약자 이름 (예: 장원철, 장원철 외 3명)"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2" />
            <input value={resTitle} onChange={e => setResTitle(e.target.value)}
              placeholder="회의 제목 (선택 — 비우면 「회의」)"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />

            {modalError && <p className="text-xs text-red-500 mt-2">{modalError}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setDraft(null)} disabled={saving}
                className="px-3.5 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                닫기
              </button>
              <button onClick={submitDraft} disabled={saving}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-40">
                {saving ? '예약 중...' : '예약하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
