'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { isWorkRecord } from '@/lib/activityKind'
import type { CalActivity } from './CalendarView'

/**
 * 업무 탭 주간 뷰 — 세로 시간축 × 월~일 7열 그리드.
 * 시간이 있는 일정형 활동은 시간대 블록으로, 시간이 없거나 업무기록형(문서·개발 등)은
 * 각 요일 상단의 「종일」 칩으로 보여준다. 블록·칩을 누르면 기존 활동 팝업이 열린다.
 * 시간축은 0~24시 전체를 그리고, 기본 스크롤 위치는 08시(업무시간)다.
 */

type WeekDay = { dateStr: string; day: number; inMonth: boolean; dow: number }

const HOUR_START = 0
const HOUR_END = 24
const VIEW_START = 8  // 처음 보이는 시각
const VIEW_HOURS = 12 // 뷰포트 높이(시간 수) — 08~20시가 기본으로 보인다
const ROW_H = 44 // px per hour

const DOW_KR = ['일', '월', '화', '수', '목', '금', '토']

function toMin(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

type Block = {
  act: CalActivity
  startMin: number
  endMin: number
  col: number // 겹침 클러스터 내 열 번호
  cols: number // 클러스터의 총 열 수
}

/** 같은 날 겹치는 일정을 열로 나눠 배치 */
function layoutDay(acts: { act: CalActivity; startMin: number; endMin: number }[]): Block[] {
  const sorted = [...acts].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const blocks: Block[] = []
  let cluster: Block[] = []
  let clusterEnd = -1
  const flush = () => {
    const cols = Math.max(1, ...cluster.map(b => b.col + 1))
    for (const b of cluster) b.cols = cols
    blocks.push(...cluster)
    cluster = []
  }
  for (const e of sorted) {
    if (cluster.length > 0 && e.startMin >= clusterEnd) flush()
    // 빈 열 찾기
    const used = new Set(cluster.filter(b => b.endMin > e.startMin).map(b => b.col))
    let col = 0
    while (used.has(col)) col++
    cluster.push({ ...e, col, cols: 1 })
    clusterEnd = Math.max(clusterEnd, e.endMin)
  }
  if (cluster.length > 0) flush()
  return blocks
}

export default function WeeklyGrid({ days, actByDate, todayStr, typeColors, showWork, onSelect, onOpenDay }: {
  days: WeekDay[]
  actByDate: Map<string, CalActivity[]>
  todayStr: string
  typeColors: Record<string, { bg: string; text: string }>
  /** 업무기록형(문서·개발 등) 종일 칩 표시 여부 */
  showWork: boolean
  onSelect: (act: CalActivity) => void
  onOpenDay: (dateStr: string) => void
}) {
  const router = useRouter()
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i)
  const gridH = (HOUR_END - HOUR_START) * ROW_H

  // 빈 시간대 클릭 → 그 날짜·시각이 채워진 활동 추가로 이동
  const goNewActivity = (dateStr: string, hour: number) =>
    router.push(`/notes/new?date=${dateStr}&start=${String(hour).padStart(2, '0')}:00`)

  // 기본 스크롤 위치 = 08시 (0~24시 전체는 스크롤로 본다)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = (VIEW_START - HOUR_START) * ROW_H
  }, [])

  const perDay = days.map(d => {
    const acts = actByDate.get(d.dateStr) ?? []
    const timed: { act: CalActivity; startMin: number; endMin: number }[] = []
    const allDay: CalActivity[] = []
    for (const a of acts) {
      const start = a.startTime ? toMin(a.startTime) : null
      if (start !== null && !isWorkRecord(a.type)) {
        const end = a.endTime ? (toMin(a.endTime) ?? start + 60) : start + 60
        timed.push({ act: a, startMin: start, endMin: Math.max(end, start + 30) })
      } else {
        if (isWorkRecord(a.type) && !showWork) continue
        allDay.push(a)
      }
    }
    return { day: d, blocks: layoutDay(timed), allDay }
  })

  const MAX_ALLDAY = 3

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* 요일 헤더 + 종일 칩 영역 */}
      <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
        <div className="border-r border-slate-200" />
        {perDay.map(({ day, allDay }) => (
          <div key={day.dateStr} className="border-r border-slate-100 last:border-r-0 px-1 py-1.5 min-w-0">
            <button type="button" onClick={() => onOpenDay(day.dateStr)}
              className="w-full flex items-center justify-center gap-1 mb-1 hover:opacity-70">
              <span className={`text-[10px] font-bold ${day.dow === 0 ? 'text-red-400' : day.dow === 6 ? 'text-blue-400' : 'text-slate-500'}`}>
                {DOW_KR[day.dow]}
              </span>
              <span className={`w-5 h-5 flex items-center justify-center text-[11px] font-bold rounded-full ${
                day.dateStr === todayStr ? 'bg-red-500 text-white' : 'text-slate-700'
              }`}>{day.day}</span>
            </button>
            {/* 종일·업무기록 칩 */}
            <div className="space-y-0.5">
              {allDay.slice(0, MAX_ALLDAY).map(a => {
                const c = typeColors[a.type] ?? typeColors['문서·자료작성']
                return (
                  <button key={a.id + a.date} type="button" onClick={() => onSelect(a)}
                    title={`${a.title}${a.userName ? ` (${a.userName})` : ''}`}
                    className={`block w-full text-left text-[9px] font-medium px-1 py-0.5 rounded truncate hover:opacity-80 ${c.bg} ${c.text}`}>
                    {a.title}{a.userName ? ` (${a.userName})` : ''}
                  </button>
                )
              })}
              {allDay.length > MAX_ALLDAY && (
                <button type="button" onClick={() => onOpenDay(day.dateStr)}
                  className="block w-full text-left text-[9px] text-slate-400 px-1 hover:text-slate-600">
                  외 {allDay.length - MAX_ALLDAY}건 →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 시간축 그리드 — 0~24시 전체, 기본 스크롤 위치 08시 */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: VIEW_HOURS * ROW_H + 2 }}>
      <div className="grid" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
        {/* 시간 라벨 열 */}
        <div className="relative border-r border-slate-200" style={{ height: gridH }}>
          {hours.map(h => (
            <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[9px] text-slate-400"
              style={{ top: (h - HOUR_START) * ROW_H }}>
              {h !== HOUR_START ? `${String(h).padStart(2, '0')}:00` : ''}
            </div>
          ))}
        </div>
        {/* 요일 열 */}
        {perDay.map(({ day, blocks }) => (
          <div key={day.dateStr}
            className={`relative border-r border-slate-100 last:border-r-0 ${
              day.dateStr === todayStr ? 'bg-amber-50/40' : day.dow === 0 || day.dow === 6 ? 'bg-slate-50/50' : ''
            }`}
            style={{ height: gridH }}>
            {/* 빈 시간 칸 — 올리면 그 시간대가 하이라이트되고, 누르면 그 시각으로 활동 추가 */}
            {hours.slice(0, -1).map(h => (
              <div key={`slot-${h}`}
                onClick={() => goNewActivity(day.dateStr, h)}
                title={`${String(h).padStart(2, '0')}:00 활동 추가`}
                className="group/slot absolute inset-x-0 cursor-pointer hover:bg-[#C5D42A]/20 transition-colors"
                style={{ top: (h - HOUR_START) * ROW_H, height: ROW_H }}>
                <span className="hidden group-hover/slot:flex h-full items-center justify-center text-[10px] font-bold text-[#7a9200] pointer-events-none">
                  + {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
            {/* 시간 눈금 */}
            {hours.slice(1).map(h => (
              <div key={h} className="absolute inset-x-0 border-t border-slate-100 pointer-events-none"
                style={{ top: (h - HOUR_START) * ROW_H }} />
            ))}
            {/* 일정 블록 */}
            {blocks.map(b => {
              const c = typeColors[b.act.type] ?? typeColors['문서·자료작성']
              const top = Math.max(0, ((b.startMin / 60) - HOUR_START) * ROW_H)
              const rawH = ((b.endMin - Math.max(b.startMin, HOUR_START * 60)) / 60) * ROW_H
              const height = Math.max(22, Math.min(rawH, gridH - top))
              const widthPct = 100 / b.cols
              return (
                <button key={b.act.id + b.act.date} type="button"
                  onClick={e => { e.stopPropagation(); onSelect(b.act) }}
                  title={`${b.act.startTime}${b.act.endTime ? `~${b.act.endTime}` : ''} ${b.act.title}${b.act.userName ? ` (${b.act.userName})` : ''}`}
                  className={`absolute rounded-md px-1 py-0.5 text-left overflow-hidden border border-white/60 hover:opacity-85 transition-opacity ${c.bg} ${c.text}`}
                  style={{ top, height, left: `${b.col * widthPct}%`, width: `calc(${widthPct}% - 2px)` }}>
                  <span className="block text-[9px] font-bold leading-tight truncate">{b.act.startTime} {b.act.title}</span>
                  {height >= 34 && (
                    <span className="block text-[9px] leading-tight truncate opacity-80">{b.act.userName ?? ''}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      </div>
    </section>
  )
}
