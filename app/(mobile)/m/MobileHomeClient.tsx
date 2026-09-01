'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, Car, PlusCircle, ChevronRight } from 'lucide-react'

const TYPE_ICON: Record<string, string> = {
  '국내출장': '🚗', '해외출장': '✈️', '내부회의': '💬', '외부미팅': '🤝',
  '교육/연수': '📚', '세미나·컨퍼런스': '🎤', '고객미팅': '👥',
  '연차': '🏖️', '반차(오전)': '☀️', '반차(오후)': '🌙',
  '발표/전시·행사': '🎯', '전화·통화': '📞', '이메일': '📧',
  '문서·자료작성': '📝', '개발·구현': '💻', '고객행사': '🎉',
  'AS출동': '🔧', '설치·시운전': '⚙️', '정기점검': '🔍',
}

type Activity = {
  id: string
  date: string
  type: string
  title: string
  planStatus: string
  expenseTransport: number | null
  expenseAccomm: number | null
  expenseMeal: number | null
  expenseOther: number | null
  expensePaymentMethod: string | null
  mentions: string | null
  userName?: string | null
  team: { name: string } | null
  task: { title: string; code: string } | null
}

type Reservation = {
  id: string
  startAt: string
  endAt: string
  purpose: string
  status: string
  vehicle: { name: string; plateNo: string }
}

type ScopeKey = '개인' | '팀' | '전사'

interface Props {
  myName: string
  weekDates: string[]
  myActivities: Activity[]
  teamActivities: Activity[]
  allActivities: Activity[]
  myReservations: Reservation[]
  mentionedActivities: Activity[]
  todayStr: string
}

const DAYS_KO = ['월', '화', '수', '목', '금', '토', '일']

function expTotal(a: Activity) {
  return (a.expenseTransport ?? 0) + (a.expenseAccomm ?? 0) + (a.expenseMeal ?? 0) + (a.expenseOther ?? 0)
}

function fmtDt(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function buildByDate(acts: Activity[]) {
  return acts.reduce<Record<string, Activity[]>>((acc, a) => {
    ;(acc[a.date] ??= []).push(a)
    return acc
  }, {})
}

export default function MobileHomeClient({
  myName, weekDates, myActivities, teamActivities, allActivities,
  myReservations, mentionedActivities, todayStr,
}: Props) {
  const [scope,        setScope]        = useState<ScopeKey>('개인')
  const [selectedDate, setSelectedDate] = useState(todayStr)

  const scopeMap: Record<ScopeKey, Activity[]> = {
    '개인': myActivities,
    '팀':   teamActivities,
    '전사': allActivities,
  }
  const currentActs = scopeMap[scope]
  const byDate      = buildByDate(currentActs)
  const dayActs     = byDate[selectedDate] ?? []

  const fmtDateLabel = (s: string) => {
    const d = new Date(s)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  return (
    <div className="px-4 py-4 space-y-4">

      {/* ── 주간 캘린더 카드 ── */}
      <div className="bg-[#0B1D3A] rounded-2xl overflow-hidden">

        {/* 헤더 + 스코프 탭 */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-white/50">{weekDates[0]} ~ {weekDates[6]}</p>
            <h1 className="text-sm font-bold text-white mt-0.5">{myName} 님의 이번 주</h1>
          </div>
          <div className="flex gap-1">
            {(['개인', '팀', '전사'] as ScopeKey[]).map(s => (
              <button key={s} onClick={() => setScope(s)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors
                  ${scope === s ? 'bg-[#C5D42A] text-[#0B1D3A]' : 'bg-white/10 text-white/60'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 요일 탭 */}
        <div className="grid grid-cols-7 border-t border-white/10">
          {weekDates.map((d, i) => {
            const count   = byDate[d]?.length ?? 0
            const isToday = d === todayStr
            const isSel   = d === selectedDate
            const isSat   = i === 5
            const isSun   = i === 6
            return (
              <button key={d} onClick={() => setSelectedDate(d)}
                className={`flex flex-col items-center py-2.5 transition-colors
                  ${isSel ? 'bg-white/15' : 'hover:bg-white/5'}`}>
                <span className={`text-[9px] font-semibold mb-1
                  ${isSun ? 'text-red-400' : isSat ? 'text-blue-300' : 'text-white/50'}`}>
                  {DAYS_KO[i]}
                </span>
                <span className={`text-sm font-bold leading-none
                  ${isToday
                    ? 'bg-[#C5D42A] text-[#0B1D3A] rounded-full w-7 h-7 flex items-center justify-center text-[11px]'
                    : isSun ? 'text-red-300' : isSat ? 'text-blue-200' : 'text-white'}`}>
                  {new Date(d).getDate()}
                </span>
                {count > 0 && (
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center max-w-[28px]">
                    {Array.from({ length: Math.min(count, 3) }).map((_, k) => (
                      <div key={k} className={`w-1 h-1 rounded-full ${isSel ? 'bg-[#C5D42A]' : 'bg-white/40'}`} />
                    ))}
                    {count > 3 && <div className="text-[8px] text-white/40">+{count - 3}</div>}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* 선택 날짜 활동 목록 */}
        <div className="border-t border-white/10 min-h-[52px]">
          {dayActs.length === 0 ? (
            <div className="px-4 py-3 text-center text-[11px] text-white/30">
              {fmtDateLabel(selectedDate)} 활동 없음
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {dayActs.map(a => {
                const icon = TYPE_ICON[a.type] ?? '📋'
                const done = a.planStatus === '완료'
                const exp  = expTotal(a)
                return (
                  <div key={a.id} className="px-4 py-2.5 flex items-start gap-2">
                    <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
                          ${done ? 'bg-emerald-500/30 text-emerald-300' : 'bg-blue-500/30 text-blue-300'}`}>
                          {a.planStatus}
                        </span>
                        {scope !== '개인' && a.userName && (
                          <span className="text-[9px] font-semibold text-[#C5D42A]/80">{a.userName}</span>
                        )}
                        <span className="text-[9px] text-white/40">{a.type}</span>
                        {a.team && scope === '전사' && (
                          <span className="text-[9px] text-white/30">{a.team.name}</span>
                        )}
                      </div>
                      <div className="text-[13px] font-semibold text-white truncate mt-0.5">{a.title}</div>
                      {a.task && (
                        <div className="text-[9px] text-white/30 truncate">📌 {a.task.code} {a.task.title}</div>
                      )}
                      {(exp > 0 || a.mentions) && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {exp > 0 && (
                            <span className="text-[9px] text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded-full">
                              💰 {exp.toLocaleString()}원{a.expensePaymentMethod ? ` · ${a.expensePaymentMethod}` : ''}
                            </span>
                          )}
                          {a.mentions && (
                            <span className="text-[9px] text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded-full">
                              {a.mentions}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 날짜별 활동 추가 */}
        <div className="px-4 pb-3 pt-1">
          <Link href={`/m/activity?date=${selectedDate}`}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl border border-white/20 text-white/70 text-xs font-semibold hover:bg-white/5 active:bg-white/10 transition-colors">
            <PlusCircle size={13} />
            {fmtDateLabel(selectedDate)} 활동 추가
          </Link>
        </div>
      </div>

      {/* ── 알림 ── */}
      <section>
        <div className="flex items-center mb-2">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Bell size={14} className="text-indigo-500" />알림
          </h2>
          {mentionedActivities.length > 0 && (
            <span className="ml-1.5 bg-indigo-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {mentionedActivities.length}
            </span>
          )}
        </div>
        {mentionedActivities.length === 0 ? (
          <div className="rounded-xl bg-white border border-gray-100 px-4 py-4 text-center text-sm text-gray-400">
            이번 주 알림이 없습니다
          </div>
        ) : (
          <div className="space-y-1.5">
            {mentionedActivities.map(a => {
              const icon = TYPE_ICON[a.type] ?? '📋'
              return (
                <div key={a.id} className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-indigo-700">
                        {a.userName} · {a.team?.name ?? '—'} · {new Date(a.date).getMonth() + 1}/{new Date(a.date).getDate()}
                      </div>
                      <div className="text-sm text-gray-800 font-medium truncate mt-0.5">{a.title}</div>
                      <div className="text-[11px] text-indigo-500 mt-0.5">
                        {a.mentions?.split(/[,\s]+/).filter(m => m.startsWith('@')).join(' ')}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── 차량 예약 ── */}
      {myReservations.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Car size={14} className="text-lime-600" />차량 예약
            </h2>
            <Link href="/m/vehicle" className="text-xs text-blue-600 flex items-center gap-0.5">
              신청 <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-1.5">
            {myReservations.map(r => (
              <div key={r.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Car size={14} className="text-lime-600" />
                    <span className="font-semibold text-sm text-gray-900">{r.vehicle.name}</span>
                    <span className="text-xs text-gray-400">{r.vehicle.plateNo}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                    ${r.status === '신청' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {r.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{fmtDt(r.startAt)} → {fmtDt(r.endAt)}</div>
                <div className="text-xs text-gray-400 truncate">{r.purpose}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 빠른 실행 ── */}
      <div className="grid grid-cols-2 gap-2 pb-2">
        <Link href="/m/activity"
          className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-3 active:bg-blue-700">
          <PlusCircle size={18} />
          <span className="text-sm font-semibold">활동 추가</span>
        </Link>
        <Link href="/m/vehicle"
          className="flex items-center gap-2 bg-[#0B1D3A] text-white rounded-xl px-4 py-3 active:bg-[#1a3050]">
          <Car size={18} />
          <span className="text-sm font-semibold">차량 신청</span>
        </Link>
      </div>
    </div>
  )
}
