'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { STATUS_STYLE, dDay } from '@/lib/a3'

/* 팀 이름 해시 기반 고정 색상 — 같은 전사과제 안에서 팀별로 시각 구분 */
const TEAM_PALETTE = [
  { chip: 'bg-indigo-50 text-indigo-700 border-indigo-100', dot: 'bg-indigo-400', bar: 'border-l-indigo-300' },
  { chip: 'bg-violet-50 text-violet-700 border-violet-100', dot: 'bg-violet-400', bar: 'border-l-violet-300' },
  { chip: 'bg-teal-50 text-teal-700 border-teal-100',       dot: 'bg-teal-400',   bar: 'border-l-teal-300' },
  { chip: 'bg-amber-50 text-amber-700 border-amber-100',    dot: 'bg-amber-400',  bar: 'border-l-amber-300' },
  { chip: 'bg-rose-50 text-rose-700 border-rose-100',       dot: 'bg-rose-400',   bar: 'border-l-rose-300' },
  { chip: 'bg-sky-50 text-sky-700 border-sky-100',          dot: 'bg-sky-400',    bar: 'border-l-sky-300' },
]
function teamColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return TEAM_PALETTE[hash % TEAM_PALETTE.length]
}

interface Props {
  subTasks: any[]
}

export default function A3SubTaskGroups({ subTasks }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // 팀별 그룹
  const groups = new Map<string, { teamName: string; strategySummary: string | null; items: any[] }>()
  for (const sub of subTasks) {
    const key = sub.teamId
    if (!groups.has(key))
      groups.set(key, { teamName: sub.team?.name ?? '미배정', strategySummary: sub.team?.strategySummary ?? null, items: [] })
    groups.get(key)!.items.push(sub)
  }
  const groupList = [...groups.entries()]

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="border-t border-slate-100 divide-y divide-slate-100 bg-slate-50/40">
      {groupList.map(([teamId, { teamName, strategySummary, items }]) => {
        const isOpen = expanded.has(teamId)
        const c = teamColor(teamName)
        const doneCount = items.filter((i: any) => i.status === '완료').length

        return (
          <div key={teamId}>
            {/* 팀 그룹 헤더 (클릭 시 펼침/접힘) */}
            <button type="button" onClick={() => toggle(teamId)}
              title={strategySummary ?? undefined}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-white transition-colors">
              <ChevronRight size={13}
                className={`text-slate-300 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${c.chip}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {teamName}
              </span>
              <span className="text-xs text-slate-400 font-medium shrink-0">
                {items.length}건{doneCount > 0 && ` · 완료 ${doneCount}`}
              </span>
              {strategySummary && (
                <span className="text-xs text-slate-400 italic truncate min-w-0">{strategySummary}</span>
              )}
              <div className="flex-1" />
            </button>

            {/* 세부과제 목록 */}
            {isOpen && (
              <div className="pb-1.5">
                {items.map((sub: any) => {
                  const subDd = dDay(new Date(sub.endDate))
                  const subStCls = STATUS_STYLE[sub.status] ?? 'bg-gray-100 text-gray-500'
                  return (
                    <Link key={sub.id} href={`/a3/${sub.id}`}
                      className={`flex items-center gap-3 ml-20 mr-3 my-1 pl-3 pr-3 py-1.5 rounded-lg bg-white border border-l-[3px] border-slate-100 ${c.bar} hover:border-slate-200 hover:shadow-sm transition-all group`}>
                      <span className="flex-1 text-xs text-slate-700 font-medium truncate">{sub.title}</span>
                      <span className="text-xs text-slate-400 font-medium shrink-0">오너 {sub.owner}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${subStCls}`}>{sub.status}</span>
                      {sub.confirmed && <span className="text-xs text-green-500 shrink-0">✓확정</span>}
                      <span className={`text-xs font-medium shrink-0 ${subDd.cls}`}>{subDd.label}</span>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
