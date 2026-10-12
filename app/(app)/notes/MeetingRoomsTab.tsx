'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * 업무공간 「회의실」 탭 — 동작사무실 회의실의 날짜별 예약 현황.
 * 층(방)별로 누가 어떤 시간을 예약했는지 보여주고, 내 예약(AI 포함)은 강조 표시한다.
 * 데이터는 본인 계정에 연결된 회의실 세션으로 조회된다 (내 계정 → AI 연결에서 연결).
 */

interface Reservation { id: string; roomId: string; startHour: number; endHour: number; title?: string; userName?: string; mine?: boolean }
interface Room { id: string; name: string }

function todayKst(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function MeetingRoomsTab() {
  const [date, setDate] = useState(todayKst())
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(true)
  const [rooms, setRooms] = useState<Room[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    fetch(`/api/meeting-rooms?date=${date}`)
      .then(r => r.json())
      .then(r => {
        if (!alive) return
        if (r.error) { setError(r.error); return }
        setConnected(r.connected !== false)
        setRooms(r.rooms ?? [])
        setReservations(r.reservations ?? [])
      })
      .catch(() => alive && setError('조회에 실패했습니다.'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [date])

  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(`${date}T00:00:00Z`).getUTCDay()]

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
        <span className="ml-auto text-[11px] text-slate-400 flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded bg-lime-200 border border-lime-400" /> 내 예약
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 py-8 text-center">불러오는 중...</p>
      ) : !connected ? (
        <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl p-8 text-center">
          회의실 예약 계정이 연결되어 있지 않습니다.<br />
          <Link href="/account" className="text-indigo-600 font-semibold hover:underline">내 계정 → AI 연결</Link>에서
          서울창업센터(동작) 계정을 연결하면 현황을 볼 수 있습니다.
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 border border-red-100 bg-red-50 rounded-xl p-5 text-center">{error}</div>
      ) : (
        <div className="space-y-2">
          {rooms.map(room => {
            const taken = reservations
              .filter(r => String(r.roomId) === String(room.id))
              .sort((a, b) => a.startHour - b.startHour)
            return (
              <div key={room.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-4">
                <div className="w-28 shrink-0 pt-0.5">
                  <div className="text-sm font-semibold text-slate-700">{room.name}</div>
                  <div className="text-[10px] text-slate-400">{room.id}</div>
                </div>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {taken.length === 0 ? (
                    <span className="text-xs text-slate-300 pt-1">예약 없음</span>
                  ) : taken.map(r => (
                    <span key={r.id}
                      className={`text-[11px] px-2 py-1 rounded-lg border ${r.mine
                        ? 'bg-lime-100 border-lime-400 text-lime-800 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      {r.startHour}–{r.endHour}시 · {r.userName ?? '예약자 미상'}{r.title && r.title !== r.userName ? ` · ${r.title}` : ''}
                      {r.mine && ' (나)'}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-400 mt-4">
        예약·취소는 AI(&ldquo;내일 2시 회의실 잡아줘&rdquo;) 또는 예약 사이트에서 — 이 화면은 조회 전용입니다.
      </p>
    </div>
  )
}
