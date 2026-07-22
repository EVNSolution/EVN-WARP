'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, X, ExternalLink, Mail, Car } from 'lucide-react'
import VehicleReservationModal from './VehicleReservationModal'

export type CalActivity = {
  id:           string
  date:         string
  type:         string
  title:        string
  content:      string | null
  mentions:     string | null
  referenceUrl: string | null
  planStatus:   string
  taskTitle:    string | null
  taskCode:     string | null
  teamName:     string
  userName:     string | null
  // 출장보고서 전용
  tripId?:      string
  tripStart?:   string
  tripEnd?:     string
}

export type CalVehicleReservation = {
  id:             string
  vehicleId:      string
  vehicleName:    string
  plateNo:        string | null
  userName:       string
  teamName:       string | null
  purpose:        string
  startAt:        string   // ISO datetime string
  endAt:          string   // ISO datetime string
  pickupLocation: string | null
  returnLocation: string | null
  notes:          string | null
  status:         string
}

type WeekDay = { dateStr: string; day: number; inMonth: boolean; dow: number }

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  '내부회의':        { bg: 'bg-blue-100',    text: 'text-blue-700' },
  '외부미팅':        { bg: 'bg-purple-100',  text: 'text-purple-700' },
  '이메일':          { bg: 'bg-sky-100',     text: 'text-sky-700' },
  '전화·통화':       { bg: 'bg-cyan-100',    text: 'text-cyan-700' },
  '국내출장':        { bg: 'bg-orange-100',  text: 'text-orange-700' },
  '해외출장':        { bg: 'bg-red-100',     text: 'text-red-700' },
  '발표/전시·행사':  { bg: 'bg-rose-100',    text: 'text-rose-700' },
  '교육/연수':       { bg: 'bg-amber-100',   text: 'text-amber-700' },
  '세미나·컨퍼런스': { bg: 'bg-amber-100',   text: 'text-amber-800' },
  '문서·자료작성':   { bg: 'bg-slate-100',   text: 'text-slate-600' },
  '개발·구현':       { bg: 'bg-slate-100',   text: 'text-slate-600' },
  '도면·설계':       { bg: 'bg-slate-100',   text: 'text-slate-600' },
  '제품제작·조립':   { bg: 'bg-slate-100',   text: 'text-slate-600' },
  'AS출동':          { bg: 'bg-yellow-100',  text: 'text-yellow-700' },
  '설치·시운전':     { bg: 'bg-yellow-100',  text: 'text-yellow-700' },
  '정기점검':        { bg: 'bg-yellow-100',  text: 'text-yellow-700' },
  '고객미팅':        { bg: 'bg-violet-100',  text: 'text-violet-700' },
  '신규영업':        { bg: 'bg-violet-100',  text: 'text-violet-700' },
  '제안/견적':       { bg: 'bg-violet-100',  text: 'text-violet-700' },
  '고객행사':        { bg: 'bg-violet-100',  text: 'text-violet-700' },
  '인재영입':        { bg: 'bg-teal-100',    text: 'text-teal-700' },
  '외부 네트워킹':   { bg: 'bg-green-100',   text: 'text-green-700' },
  '파트너십 타진':   { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  '견적서 발행':     { bg: 'bg-teal-100',    text: 'text-teal-700' },
  'PO 발행':        { bg: 'bg-teal-100',    text: 'text-teal-700' },
  '수주 확정':      { bg: 'bg-teal-100',    text: 'text-teal-700' },
  '세금계산서 발행': { bg: 'bg-teal-100',   text: 'text-teal-700' },
  '실적추가':        { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'IR 발표':         { bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  '투자자 미팅':     { bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  '투자행사':        { bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  '대관·신청':       { bg: 'bg-stone-100',   text: 'text-stone-700' },
  '세무·회계':       { bg: 'bg-stone-100',   text: 'text-stone-700' },
  '신고·갱신':       { bg: 'bg-stone-100',   text: 'text-stone-700' },
  '법무·계약':       { bg: 'bg-stone-100',   text: 'text-stone-700' },
  '경영기획':        { bg: 'bg-stone-100',   text: 'text-stone-700' },
  // 레거시
  '외부회의':  { bg: 'bg-purple-100',  text: 'text-purple-700' },
  '발표/보고': { bg: 'bg-teal-100',    text: 'text-teal-700' },
  '전시/행사': { bg: 'bg-rose-100',    text: 'text-rose-700' },
  '사무업무':  { bg: 'bg-slate-100',   text: 'text-slate-600' },
}

const DOW_KR = ['일', '월', '화', '수', '목', '금', '토']
const LEAVE_TYPES = new Set(['연차', '반차', '오전반차', '오후반차', '공가'])

const RESV_STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  '신청': { bg: 'bg-lime-100',   text: 'text-lime-700' },
  '승인': { bg: 'bg-green-100',  text: 'text-green-700' },
  '완료': { bg: 'bg-slate-100',  text: 'text-slate-500' },
  '취소': { bg: 'bg-red-50',     text: 'text-red-400' },
}

interface Props {
  weeks:        WeekDay[][]
  activities:   CalActivity[]
  reservations: CalVehicleReservation[]
  todayStr:     string
}

export default function CalendarView({ weeks, activities, reservations, todayStr }: Props) {
  const router = useRouter()
  const [selected, setSelected]         = useState<CalActivity | null>(null)
  const [selectedResv, setSelectedResv] = useState<CalVehicleReservation | null>(null)
  const [showNewResv, setShowNewResv]   = useState(false)
  const [newResvDate, setNewResvDate]   = useState('')

  const handleResvSaved = useCallback(() => router.refresh(), [router])

  // 예약이 해당 날짜에 겹치는지 확인
  function resvForDate(dateStr: string): CalVehicleReservation[] {
    const dayStart = new Date(dateStr + 'T00:00:00')
    const dayEnd   = new Date(dateStr + 'T23:59:59')
    return reservations.filter(r => {
      const s = new Date(r.startAt)
      const e = new Date(r.endAt)
      return s <= dayEnd && e >= dayStart && r.status !== '취소'
    })
  }

  const actByDate = new Map<string, CalActivity[]>()
  for (const a of activities) {
    if (!actByDate.has(a.date)) actByDate.set(a.date, [])
    actByDate.get(a.date)!.push(a)
  }

  function openNewResv(dateStr: string) {
    setNewResvDate(dateStr)
    setShowNewResv(true)
  }

  return (
    <>
      {/* ─── 캘린더 그리드 ─── */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">

        {/* 요일 헤더 + 차량 신청 버튼 */}
        <div className="relative grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DOW_KR.map((d, i) => (
            <div key={i} className={`text-center py-2.5 text-xs font-bold tracking-wider ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'
            }`}>{d}</div>
          ))}
          <button
            onClick={() => openNewResv(todayStr)}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-lime-700 bg-white border border-lime-200 rounded-lg hover:bg-lime-50 transition-colors">
            <Car size={11} />
            차량 신청
          </button>
        </div>

        {/* 주 행 */}
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="border-b border-slate-200 last:border-b-0">
            <div className="grid grid-cols-7 divide-x divide-slate-100">
              {week.map(({ dateStr, day, inMonth, dow }) => {
                const dayActs  = actByDate.get(dateStr) ?? []
                const dayResvs = resvForDate(dateStr)
                const isToday  = dateStr === todayStr

                return (
                  <div key={dateStr}
                    className={`group relative min-h-[88px] p-1.5 ${
                      !inMonth ? 'bg-slate-50/60'
                      : dow === 0 ? 'bg-red-50/10'
                      : dow === 6 ? 'bg-blue-50/10'
                      : 'bg-white'
                    }`}>

                    {/* 날짜 번호 */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full ${
                        isToday    ? 'bg-red-500 text-white'
                        : !inMonth ? 'text-slate-300'
                        : dow === 0 ? 'text-red-400'
                        : dow === 6 ? 'text-blue-400'
                        : 'text-slate-700'
                      }`}>{day}</span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                        <button
                          onClick={() => openNewResv(dateStr)}
                          title="차량 신청"
                          className="w-5 h-5 flex items-center justify-center rounded-full bg-lime-50 text-lime-500 hover:bg-lime-100 hover:text-lime-700">
                          <Car size={9} />
                        </button>
                        <Link href={`/notes/new?date=${dateStr}`}
                          className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-50 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-600">
                          <Plus size={11} />
                        </Link>
                      </div>
                    </div>

                    {/* 차량 예약 칩 */}
                    {dayResvs.length > 0 && (
                      <div className="space-y-0.5 mb-0.5">
                        {dayResvs.map(r => {
                          const sc = RESV_STATUS_COLOR[r.status] ?? RESV_STATUS_COLOR['신청']
                          const startTime = new Date(r.startAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
                          return (
                            <button key={r.id} type="button"
                              onClick={() => setSelectedResv(r)}
                              className={`flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded w-full text-left truncate hover:opacity-80 transition-opacity ${sc.bg} ${sc.text}`}>
                              <Car size={8} className="shrink-0" />
                              <span className="truncate">{r.vehicleName} {startTime} {r.userName}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* 활동 칩 — 클릭 시 모달 or 출장 페이지 */}
                    {(() => {
                      const leaveGroups = new Map<string, { first: CalActivity; names: string[] }>()
                      const otherActs: CalActivity[] = []
                      for (const act of dayActs) {
                        if (LEAVE_TYPES.has(act.type)) {
                          if (!leaveGroups.has(act.type)) leaveGroups.set(act.type, { first: act, names: [] })
                          const g = leaveGroups.get(act.type)!
                          if (act.userName) g.names.push(act.userName)
                        } else {
                          otherActs.push(act)
                        }
                      }
                      return (
                        <div className="space-y-0.5">
                          {[...leaveGroups.entries()].map(([type, { first, names }]) => {
                            const c = TYPE_COLORS[type] ?? TYPE_COLORS['문서·자료작성']
                            const label = names.length > 0 ? `${type}(${names.join(', ')})` : type
                            return (
                              <button key={`leave-${type}`} type="button"
                                onClick={() => setSelected(first)}
                                className={`flex items-center gap-0.5 text-[9px] font-medium px-1 py-0.5 rounded w-full text-left truncate hover:opacity-80 transition-opacity ${c.bg} ${c.text}`}>
                                <span className="truncate">{label}</span>
                              </button>
                            )
                          })}
                          {otherActs.map(act => {
                            const c = TYPE_COLORS[act.type] ?? TYPE_COLORS['문서·자료작성']
                            const nameTag = act.userName ? `(${act.userName})` : ''
                            if (act.tripId) {
                              return (
                                <Link key={act.id + act.date} href={`/trip/${act.tripId}`}
                                  className={`flex items-center gap-0.5 text-[9px] font-medium px-1 py-0.5 rounded w-full text-left truncate hover:opacity-80 transition-opacity ${c.bg} ${c.text}`}>
                                  <span className="truncate">{act.title}{nameTag}</span>
                                </Link>
                              )
                            }
                            return (
                              <button key={act.id} type="button"
                                onClick={() => setSelected(act)}
                                className={`flex items-center gap-0.5 text-[9px] font-medium px-1 py-0.5 rounded w-full text-left truncate hover:opacity-80 transition-opacity ${c.bg} ${c.text}`}>
                                {act.type === '이메일' && <Mail size={8} className="shrink-0" />}
                                <span className="truncate">{act.title}{nameTag}</span>
                              </button>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      {/* ─── 활동 상세 모달 ─── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden"
            onClick={e => e.stopPropagation()}>

            {(() => {
              const c = TYPE_COLORS[selected.type] ?? TYPE_COLORS['문서·자료작성']
              return (
                <div className={`px-6 pt-5 pb-4 ${c.bg}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded mb-2 bg-white/60 ${c.text}`}>
                        {selected.type}
                      </span>
                      <h3 className={`text-sm font-bold leading-snug ${c.text}`}>{selected.title}</h3>
                    </div>
                    <button onClick={() => setSelected(null)}
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white/50 hover:bg-white/80 transition-colors mt-0.5">
                      <X size={13} className={c.text} />
                    </button>
                  </div>
                </div>
              )
            })()}

            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-[56px,1fr] gap-y-1.5 text-xs">
                <span className="text-slate-400">날짜</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-700">{selected.date}</span>
                  {selected.planStatus === '완료' && (
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">완료</span>
                  )}
                </div>
                <span className="text-slate-400">팀</span>
                <span className="text-slate-700">{selected.teamName}</span>
                {selected.taskTitle && (
                  <>
                    <span className="text-slate-400">과제</span>
                    <span className="text-slate-700 truncate">{selected.taskTitle}</span>
                  </>
                )}
                {selected.userName && (
                  <>
                    <span className="text-slate-400">작성자</span>
                    <span className="text-slate-700">{selected.userName}</span>
                  </>
                )}
              </div>
              {selected.content && (
                <div className="bg-slate-50 rounded-lg px-4 py-3">
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{selected.content}</p>
                </div>
              )}
              {selected.type === '이메일' && selected.referenceUrl && (
                <a href={selected.referenceUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-700 font-medium hover:bg-sky-100 transition-colors">
                  <Mail size={12} />
                  이메일 열기
                  <ExternalLink size={11} className="ml-auto" />
                </a>
              )}
              {selected.mentions?.trim() && (
                <p className="text-xs text-indigo-500">@ {selected.mentions}</p>
              )}
            </div>

            <div className="flex gap-2 justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/60">
              <button onClick={() => setSelected(null)}
                className="px-4 py-1.5 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-white transition-colors">
                닫기
              </button>
              <Link href={`/notes/${selected.id}/edit`}
                className="px-4 py-1.5 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                수정하기
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ─── 차량 예약 상세 모달 ─── */}
      {selectedResv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setSelectedResv(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden"
            onClick={e => e.stopPropagation()}>

            {/* 헤더 */}
            <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 bg-lime-50">
              <div className="flex items-center gap-2">
                <Car size={15} className="text-lime-700 shrink-0" />
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      (RESV_STATUS_COLOR[selectedResv.status] ?? RESV_STATUS_COLOR['신청']).bg
                    } ${(RESV_STATUS_COLOR[selectedResv.status] ?? RESV_STATUS_COLOR['신청']).text}`}>
                      {selectedResv.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-lime-800">
                    {selectedResv.vehicleName} ({selectedResv.plateNo ?? '번호 없음'})
                  </h3>
                </div>
              </div>
              <button onClick={() => setSelectedResv(null)}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white/50 hover:bg-white/80 transition-colors mt-0.5">
                <X size={13} className="text-lime-700" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-[72px,1fr] gap-y-2 text-xs">
                <span className="text-slate-400">목적</span>
                <span className="text-slate-700 font-medium">{selectedResv.purpose}</span>
                <span className="text-slate-400">신청자</span>
                <span className="text-slate-700">{selectedResv.userName}{selectedResv.teamName ? ` (${selectedResv.teamName})` : ''}</span>
                <span className="text-slate-400">사용 시작</span>
                <span className="text-slate-700">{new Date(selectedResv.startAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-slate-400">반납 예정</span>
                <span className="text-slate-700">{new Date(selectedResv.endAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                {selectedResv.pickupLocation && (
                  <>
                    <span className="text-slate-400">픽업 장소</span>
                    <span className="text-slate-700">{selectedResv.pickupLocation}</span>
                  </>
                )}
                {selectedResv.returnLocation && (
                  <>
                    <span className="text-slate-400">반납 장소</span>
                    <span className="text-slate-700">{selectedResv.returnLocation}</span>
                  </>
                )}
                {selectedResv.notes && (
                  <>
                    <span className="text-slate-400">비고</span>
                    <span className="text-slate-700">{selectedResv.notes}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/60">
              <button onClick={() => setSelectedResv(null)}
                className="px-4 py-1.5 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-white transition-colors">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 차량 신청 모달 ─── */}
      {showNewResv && (
        <VehicleReservationModal
          initialDate={newResvDate}
          onClose={() => setShowNewResv(false)}
          onSaved={handleResvSaved}
        />
      )}
    </>
  )
}
