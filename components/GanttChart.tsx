'use client'

import { Fragment, useState, useMemo } from 'react'
import Link from 'next/link'
import GanttStatusToggle from './GanttStatusToggle'
import { getWeekStart } from '@/lib/week'

const CM_COLORS = ['#818cf8', '#fb923c', '#2dd4bf', '#c084fc', '#4ade80', '#fb7185']
const STRATEGY_BADGE: Record<string, string> = {
  A: 'bg-indigo-600 text-white',
  B: 'bg-emerald-600 text-white',
}

interface CmItem {
  id: string
  index: number
  description: string
  startDate: string | null
  endDate:   string | null
}

interface TaskItem {
  id: string
  code: string
  title: string
  teamId: string
  strategy: string
  parentTitle: string | null
  startDate: string
  endDate:   string
  countermeasures: CmItem[]
}

interface TeamEntry {
  teamId:   string
  teamName: string
  tasks:    TaskItem[]
}

interface UpdateItem {
  id:        string
  status:    string
  completed: string | null
}

interface GanttChartProps {
  teamEntries:   TeamEntry[]
  updates:       Record<string, UpdateItem>
  prevUpdates:   Record<string, string>
  ganttWeeks:    string[]
  weekId:        string
  nextWeek:      string
  weekStartIso:  string
  todayPos:      number | null
  windowStartMs: number
  windowEndMs:   number
  windowDays:    number
}

export default function GanttChart({
  teamEntries,
  updates,
  prevUpdates,
  ganttWeeks,
  weekId,
  nextWeek,
  weekStartIso,
  todayPos,
  windowStartMs,
  windowEndMs,
  windowDays,
}: GanttChartProps) {
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set())
  const [groupBy,   setGroupBy]   = useState<'team' | 'strategy'>('team')

  const allExpandableIds = useMemo(() =>
    teamEntries.flatMap(({ tasks }) =>
      tasks
        .filter(t => t.countermeasures.length > 0)
        .map(t => t.id)
    ), [teamEntries])

  /* 전략별 그룹 */
  const strategyGroups = useMemo(() => {
    type SK = 'A' | 'B' | '기타'
    const ORDER: SK[] = ['A', 'B', '기타']
    const buckets: Record<SK, { teamId: string; teamName: string; tasks: TaskItem[] }[]> = { A: [], B: [], '기타': [] }

    for (const { teamId, teamName, tasks } of teamEntries) {
      const byStrat: Record<SK, TaskItem[]> = { A: [], B: [], '기타': [] }
      for (const task of tasks) {
        const k: SK = task.strategy === 'A' ? 'A' : task.strategy === 'B' ? 'B' : '기타'
        byStrat[k].push(task)
      }
      for (const k of ORDER) {
        if (byStrat[k].length > 0) buckets[k].push({ teamId, teamName, tasks: byStrat[k] })
      }
    }

    return ORDER.filter(k => buckets[k].length > 0).map(k => {
      const allTasks   = buckets[k].flatMap(t => t.tasks)
      const parentTitle = allTasks.find(t => t.parentTitle)?.parentTitle ?? ''
      return {
        stratKey: k,
        label:    k !== '기타' && parentTitle ? `${k}. ${parentTitle}` : k === '기타' ? '기타 과제' : `전략 ${k}`,
        hdrCls:   k === 'A' ? 'bg-indigo-800' : k === 'B' ? 'bg-emerald-800' : 'bg-slate-600',
        teams:    buckets[k],
      }
    })
  }, [teamEntries])

  const allExpanded = allExpandableIds.length > 0 && allExpandableIds.every(id => expanded.has(id))

  function toggleAll() {
    setExpanded(allExpanded ? new Set() : new Set(allExpandableIds))
  }

  function toggle(taskId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  function pct(ms: number) {
    return (ms - windowStartMs) / 86400000 / windowDays * 100
  }

  function getBar(startDate: string, endDate: string) {
    const s    = new Date(startDate).getTime()
    const eExc = new Date(endDate).getTime() + 86400000
    const eff0 = Math.max(s, windowStartMs)
    const eff1 = Math.min(eExc, windowEndMs)
    if (eff0 >= eff1) return null
    return { left: pct(eff0), width: pct(eff1) - pct(eff0) }
  }

  function getCmBar(startDate: string | null, endDate: string | null) {
    if (!startDate || !endDate) return null
    return getBar(startDate, endDate)
  }

  function getMilestonePos(endDate: string) {
    const ms = new Date(endDate).getTime()
    if (ms < windowStartMs || ms > windowEndMs) return null
    return Math.min(Math.max(pct(ms), 1), 98)
  }

  const winStart = new Date(windowStartMs)
  const winEnd   = new Date(windowEndMs)

  /* 주 격자 배경 — 재사용 */
  const WeekGrid = ({ current, light }: { current?: boolean; light?: boolean }) => (
    <div className="absolute inset-0 flex pointer-events-none">
      {ganttWeeks.map((w, i) => (
        <div key={w}
          className={`flex-1 h-full ${
            w === weekId   ? (current ? 'bg-indigo-50/50' : 'bg-indigo-50/30')
            : w === nextWeek ? (current ? 'bg-sky-50/30'   : 'bg-sky-50/20')
            : ''
          }`}
          style={{ borderRight: i < ganttWeeks.length - 1 ? `1px solid ${light ? '#f8fafc' : '#f1f5f9'}` : 'none' }}
        />
      ))}
    </div>
  )

  return (
    <div className="overflow-x-auto relative">
      {/* 오늘 선 */}
      {todayPos !== null && (
        <div className="absolute top-0 bottom-0 pointer-events-none z-30"
          style={{
            left: `calc(240px + (100% - 240px) * ${todayPos / 100})`,
            width: '2px',
            backgroundColor: '#ef4444',
            opacity: 0.7,
          }} />
      )}

      <table className="w-full text-xs border-collapse" style={{ minWidth: '960px', tableLayout: 'fixed' }}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <th className="text-left pl-4 pr-2 py-2 font-semibold text-slate-500 whitespace-nowrap" style={{ width: '240px' }}>
              <div className="flex items-center justify-between gap-2">
                {/* 보기 전환 토글 */}
                <div className="flex border border-slate-200 rounded overflow-hidden">
                  <button onClick={() => setGroupBy('team')}
                    className={`text-[10px] px-2.5 py-0.5 font-semibold transition-colors ${
                      groupBy === 'team' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-600 bg-white'
                    }`}>
                    팀별
                  </button>
                  <button onClick={() => setGroupBy('strategy')}
                    className={`text-[10px] px-2.5 py-0.5 font-semibold border-l border-slate-200 transition-colors ${
                      groupBy === 'strategy' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-600 bg-white'
                    }`}>
                    전략별
                  </button>
                </div>
                {allExpandableIds.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors
                      border-slate-300 text-slate-500 hover:border-slate-500 hover:text-slate-700 bg-white">
                    {allExpanded ? '전체 접기' : '전체 펼치기'}
                  </button>
                )}
              </div>
            </th>
            {ganttWeeks.map(w => {
              const isCurrent = w === weekId
              const isNext    = w === nextWeek
              const [, wNum]  = w.split('-W')
              const wStart    = getWeekStart(w)
              const mmdd      = `${wStart.getUTCMonth() + 1}/${wStart.getUTCDate()}`
              return (
                <th key={w}
                  className={`text-center py-2 font-medium ${
                    isCurrent ? 'bg-indigo-50 text-indigo-700'
                    : isNext  ? 'bg-sky-50/80 text-sky-700'
                    : 'text-slate-400'
                  }`}
                  style={{ width: `calc((100% - 240px) / 8)` }}>
                  <div className={`text-xs ${isCurrent || isNext ? 'font-bold' : ''}`}>W{wNum}</div>
                  <div className="text-[10px] opacity-60 mt-0.5">{mmdd}</div>
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {(() => {
            /* ── 과제 행 렌더 함수 (팀별/전략별 공통) ── */
            const renderTask = (task: TaskItem) => {
              const update         = updates[task.id]
              const milestonePos   = getMilestonePos(task.endDate)
              const milestoneColor = task.strategy === 'A' ? '#6366f1' : '#059669'
              const cmWithDates    = task.countermeasures.filter(cm => cm.startDate && cm.endDate)
              const stratBadgeCls  = STRATEGY_BADGE[task.strategy] ?? 'bg-slate-100 text-slate-500'
              const isExpanded     = expanded.has(task.id)
              const bar            = getBar(task.startDate, task.endDate)
              const hasCMs         = task.countermeasures.length > 0
              return (
                <Fragment key={task.id}>
                  <tr className={`hover:bg-slate-50/40 transition-colors group ${!hasCMs || !isExpanded ? 'border-b border-slate-200' : ''}`}>
                    <td className="pl-4 pr-2 py-1 align-top" style={{ width: '240px' }}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 truncate flex-1 min-w-0 ${stratBadgeCls}`}>
                          {task.strategy}. {task.parentTitle ?? task.title}
                        </span>
                        <div className="shrink-0">
                          <GanttStatusToggle
                            taskId={task.id}  teamId={task.teamId}
                            weekId={weekId}   weekStart={weekStartIso}
                            updateId={update?.id} currentStatus={update?.status}
                            prevStatus={prevUpdates[task.id]}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Link href={`/a3/${task.id}`} className="flex-1 min-w-0 hover:text-indigo-600 transition-colors">
                          <div className="text-[11px] font-bold text-slate-800 truncate" style={{ maxWidth: '185px' }}>
                            {task.title}
                          </div>
                        </Link>
                        {hasCMs && (
                          <button onClick={() => toggle(task.id)}
                            title={isExpanded ? '세부활동 접기' : '세부활동 펼치기'}
                            className={`shrink-0 flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded transition-colors ${
                              isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-500'
                            }`}>
                            <span>{isExpanded ? '▲' : '▼'}</span>
                            <span>{cmWithDates.length}</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td colSpan={ganttWeeks.length} className="p-0 align-middle relative" style={{ height: '36px' }}>
                      <WeekGrid current />
                      {milestonePos !== null && (
                        <div className="absolute z-10 pointer-events-none"
                          style={{ left: `calc(${milestonePos}% - 6px)`, top: '50%', transform: 'translateY(-50%)' }}>
                          <div className="w-3 h-3 rotate-45 bg-white border-2 shadow-sm" style={{ borderColor: milestoneColor }} />
                        </div>
                      )}
                      {!bar && (() => {
                        const ts = new Date(task.startDate)
                        const te = new Date(task.endDate)
                        if (te < winStart) return <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-300">← 완료</div>
                        if (ts > winEnd)   return <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-300">예정 →</div>
                        return null
                      })()}
                    </td>
                  </tr>
                  {isExpanded && task.countermeasures.map((cm, cmIdx) => {
                    const cmBar   = getCmBar(cm.startDate, cm.endDate)
                    const cmColor = CM_COLORS[cmIdx % CM_COLORS.length]
                    const isLast  = cmIdx === cmWithDates.length - 1
                    return (
                      <tr key={cm.id} className={`bg-slate-50/40 ${isLast ? 'border-b border-slate-200' : 'border-b border-slate-100'}`}>
                        <td className="pl-7 pr-2 py-0.5 align-middle" style={{ width: '240px' }}>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full text-[7px] font-bold text-white shrink-0 flex items-center justify-center"
                              style={{ backgroundColor: cmColor, minWidth: '12px' }}>{cm.index}</span>
                            <span className="text-[9px] text-slate-500 truncate" style={{ maxWidth: '190px' }}>{cm.description}</span>
                          </div>
                        </td>
                        <td colSpan={ganttWeeks.length} className="p-0 align-middle relative" style={{ height: '18px' }}>
                          <WeekGrid light />
                          {cmBar && (
                            <div className="absolute rounded"
                              style={{
                                top: '50%', transform: 'translateY(-50%)',
                                left:  `calc(${cmBar.left}%  + 4px)`,
                                width: `calc(${cmBar.width}% - 8px)`,
                                height: '6px', backgroundColor: cmColor, opacity: 0.65,
                              }} />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            }

            /* ── 팀별 뷰 ── */
            if (groupBy === 'team') {
              return teamEntries.map(({ teamId: tid, teamName, tasks: teamTasks }) => (
                <Fragment key={tid}>
                  <tr className="bg-slate-50/80 border-y border-slate-200">
                    <td className="pl-4 pr-2 py-1.5">
                      <span className="text-[11px] font-bold text-slate-600 tracking-wider uppercase">{teamName}</span>
                    </td>
                    <td colSpan={ganttWeeks.length} />
                  </tr>
                  {teamTasks.map(renderTask)}
                </Fragment>
              ))
            }

            /* ── 전략별 뷰 ── */
            return strategyGroups.map(({ stratKey, label, hdrCls, teams }) => (
              <Fragment key={stratKey}>
                {/* 전략 섹션 헤더 */}
                <tr>
                  <td colSpan={ganttWeeks.length + 1} className={`pl-4 pr-2 py-1.5 ${hdrCls}`}>
                    <span className="text-xs font-bold text-white">{label}</span>
                  </td>
                </tr>
                {/* 팀 서브그룹 */}
                {teams.map(({ teamId, teamName, tasks: teamTasks }) => (
                  <Fragment key={teamId}>
                    <tr className="bg-slate-50/60 border-y border-slate-200">
                      <td className="pl-6 pr-2 py-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{teamName}</span>
                      </td>
                      <td colSpan={ganttWeeks.length} />
                    </tr>
                    {teamTasks.map(renderTask)}
                  </Fragment>
                ))}
              </Fragment>
            ))
          })()}
        </tbody>
      </table>
    </div>
  )
}
