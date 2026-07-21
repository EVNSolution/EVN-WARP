import { prisma } from '@/lib/db'
import Link from 'next/link'
import { getWeekId, getWeekStart, adjacentWeek, formatWeekLabel } from '@/lib/week'
import { ChevronLeft, ChevronRight, CheckCircle, Clock } from 'lucide-react'
import GanttChart from '@/components/GanttChart'

const STATUS_BADGE: Record<string, string> = {
  '정상':    'bg-green-100  text-green-700  border-green-200',
  '지연':    'bg-yellow-100 text-yellow-700 border-yellow-200',
  '조치필요': 'bg-red-100    text-red-700   border-red-200',
}
const STRATEGY_BADGE: Record<string, string> = {
  A: 'bg-indigo-600 text-white',
  B: 'bg-emerald-600 text-white',
}

function isCmActive(
  cm: { startDate: string | null; endDate: string | null },
  rangeStart: number,
  rangeEnd: number,
): boolean {
  if (!cm.startDate || !cm.endDate) return false
  const s = new Date(cm.startDate).getTime()
  const e = new Date(cm.endDate).getTime() + 86400000
  return s < rangeEnd && e > rangeStart
}

function shouldShowInSection(
  cm: { startDate: string | null; endDate: string | null; description: string },
  taskStart: Date,
  taskEnd: Date,
  rangeStart: number,
  rangeEnd: number,
): boolean {
  if (!cm.description.trim()) return false
  if (cm.startDate && cm.endDate) return isCmActive(cm, rangeStart, rangeEnd)
  const ts = taskStart.getTime()
  const te = taskEnd.getTime() + 86400000
  return ts < rangeEnd && te > rangeStart
}

type SearchParams = { week?: string; tab?: string }

export default async function WeeklyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { week: weekParam, tab } = await searchParams
  const activeTab = tab === 'weekly' ? 'weekly' : 'gantt'

  const currentWeekId = getWeekId(new Date())
  const weekId        = weekParam ?? currentWeekId
  const isCurrentWeek = weekId === currentWeekId
  const isPastWeek    = weekId < currentWeekId

  // 8주 윈도우: [weekId-1 … weekId+6]
  const ganttWeeks: string[] = []
  for (let i = -1; i < 7; i++) ganttWeeks.push(adjacentWeek(weekId, i))

  const windowStart = getWeekStart(ganttWeeks[0])
  const windowEnd   = getWeekStart(ganttWeeks[ganttWeeks.length - 1])
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 7)
  const windowDays  = (windowEnd.getTime() - windowStart.getTime()) / 86400000

  const prevWeek     = adjacentWeek(weekId, -1)
  const nextWeek     = adjacentWeek(weekId,  1)
  const weekStartIso = getWeekStart(weekId).toISOString()

  const weekStartMs     = getWeekStart(weekId).getTime()
  const weekEndMs       = weekStartMs + 7 * 86400000
  const nextWeekStartMs = getWeekStart(nextWeek).getTime()
  const nextWeekEndMs   = nextWeekStartMs + 7 * 86400000

  const nextWeekFromDate = getWeekStart(nextWeek).toISOString().slice(0, 10)
  const nextWeekToDate   = (() => {
    const d = getWeekStart(nextWeek); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10)
  })()
  const thisWeekFromDate = getWeekStart(weekId).toISOString().slice(0, 10)
  const thisWeekToDate   = (() => {
    const d = getWeekStart(weekId); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10)
  })()

  const [tasks, weeklyUpdates, prevWeekUpdates, thisWeekActivities, nextWeekActivities] = await Promise.all([
    prisma.strategyTask.findMany({
      where: { parentId: { not: null }, suspended: false },
      include: {
        team: true,
        countermeasures: { orderBy: { index: 'asc' } },
        parent: { select: { id: true, title: true, code: true, strategy: true } },
      },
      orderBy: [{ teamId: 'asc' }, { teamSeq: 'asc' }],
    }),
    prisma.weeklyUpdate.findMany({
      where: { week: weekId },
    }),
    prisma.weeklyUpdate.findMany({
      where: { week: prevWeek },
      select: { taskId: true, status: true },
    }),
    prisma.workActivity.findMany({
      where: { date: { gte: thisWeekFromDate, lte: thisWeekToDate } },
      orderBy: [{ date: 'asc' }],
    }),
    prisma.workActivity.findMany({
      where: { date: { gte: nextWeekFromDate, lte: nextWeekToDate } },
      orderBy: [{ date: 'asc' }],
    }),
  ])

  const updateByTaskId      = new Map(weeklyUpdates.map(u => [u.taskId, u]))
  const thisActByTask       = new Map<string, typeof thisWeekActivities>()
  const nextActByTask       = new Map<string, typeof nextWeekActivities>()
  for (const a of thisWeekActivities) {
    if (!a.taskId) continue
    if (!thisActByTask.has(a.taskId)) thisActByTask.set(a.taskId, [])
    thisActByTask.get(a.taskId)!.push(a)
  }
  for (const a of nextWeekActivities) {
    if (!a.taskId) continue
    if (!nextActByTask.has(a.taskId)) nextActByTask.set(a.taskId, [])
    nextActByTask.get(a.taskId)!.push(a)
  }

  const teamMap = new Map<string, { teamName: string; tasks: typeof tasks }>()
  for (const task of tasks) {
    if (!teamMap.has(task.teamId)) {
      teamMap.set(task.teamId, { teamName: task.team.name, tasks: [] })
    }
    teamMap.get(task.teamId)!.tasks.push(task)
  }
  const teamEntries = [...teamMap.entries()]

  const todayMs  = Date.now()
  const todayPos = todayMs >= windowStart.getTime() && todayMs <= windowEnd.getTime()
    ? (todayMs - windowStart.getTime()) / 86400000 / windowDays * 100 : null

  const weekDateRange     = formatWeekLabel(weekId).match(/\((.+)\)/)?.[1] ?? ''
  const nextWeekDateRange = formatWeekLabel(nextWeek).match(/\((.+)\)/)?.[1] ?? ''

  /* GanttChart 클라이언트 컴포넌트에 넘길 직렬화 데이터 */
  const ganttTeamEntries = teamEntries.map(([teamId, { teamName, tasks: tt }]) => ({
    teamId,
    teamName,
    tasks: tt.map(t => ({
      id: t.id, code: t.code, title: t.title, teamId: t.teamId,
      strategy:    t.strategy || (t.parent as any)?.strategy || '',
      parentTitle: (t.parent as any)?.title ?? null,
      startDate: (t.startDate as Date).toISOString(),
      endDate:   (t.endDate   as Date).toISOString(),
      countermeasures: t.countermeasures.map(cm => ({
        id: cm.id, index: cm.index, description: cm.description,
        startDate: cm.startDate as string | null,
        endDate:   cm.endDate   as string | null,
      })),
    })),
  }))
  const ganttUpdates: Record<string, { id: string; status: string; completed: string | null }> = {}
  for (const [tid, u] of updateByTaskId) {
    ganttUpdates[tid] = { id: u.id, status: u.status, completed: u.completed }
  }
  const ganttPrevUpdates: Record<string, string> = {}
  for (const u of prevWeekUpdates) {
    ganttPrevUpdates[u.taskId] = u.status
  }

  return (
    <div className="p-6" style={{ maxWidth: '1440px' }}>

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between px-6 py-4 mb-4 rounded-xl" style={{ backgroundColor: '#111111' }}>
        <div>
          <h1 className="text-xl font-bold text-white">주간업무</h1>
          <p className="text-xs mt-0.5" style={{ color: '#C5D42A' }}>팀별 주간 실행계획 · 간트차트</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-white/20 rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Link href={`/weekly?week=${prevWeek}&tab=${activeTab}`}
              className="px-2.5 py-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors border-r border-white/20">
              <ChevronLeft size={16} />
            </Link>
            <span className="px-4 py-1.5 text-sm font-semibold text-white min-w-[210px] text-center">
              {formatWeekLabel(weekId)}
              {isCurrentWeek && <span className="ml-2 text-xs font-medium" style={{ color: '#C5D42A' }}>이번 주</span>}
            </span>
            <Link href={`/weekly?week=${nextWeek}&tab=${activeTab}`}
              className="px-2.5 py-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors border-l border-white/20">
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── 탭 네비게이션 ── */}
      <div className="flex gap-0 mb-4 border-b border-slate-200">
        <Link
          href={`/weekly?week=${weekId}&tab=gantt`}
          className={`px-6 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            activeTab === 'gantt'
              ? 'border-[#C5D42A] text-[#7a9200] bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          간트
        </Link>
        <Link
          href={`/weekly?week=${weekId}&tab=weekly`}
          className={`px-6 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            activeTab === 'weekly'
              ? 'border-[#C5D42A] text-[#7a9200] bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          주간 관리
        </Link>
      </div>

      {/* ══════════════════════════════
          간트 탭
      ══════════════════════════════ */}
      {activeTab === 'gantt' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {/* 범례 */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-5">
              <h2 className="text-sm font-bold text-slate-700">전략과제 실행계획 · 8주</h2>
              <div className="flex items-center gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500" />정상
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" />지연
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full bg-red-500" />조치필요
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />완료
                </span>
                {todayPos !== null && (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-0.5 h-3.5 bg-red-400 rounded-full" />오늘
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rotate-45 border-2 border-slate-400 bg-white" />마감일
                </span>
              </div>
            </div>
          </div>

          <GanttChart
            teamEntries={ganttTeamEntries}
            updates={ganttUpdates}
            prevUpdates={ganttPrevUpdates}
            ganttWeeks={ganttWeeks}
            weekId={weekId}
            nextWeek={nextWeek}
            weekStartIso={weekStartIso}
            todayPos={todayPos}
            windowStartMs={windowStart.getTime()}
            windowEndMs={windowEnd.getTime()}
            windowDays={windowDays}
          />
        </section>
      )}

      {/* ══════════════════════════════
          주간 관리 탭
      ══════════════════════════════ */}
      {activeTab === 'weekly' && (
        <>
          <section className="grid grid-cols-2 gap-4 mb-4">

            {/* Weekly Completed Works */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-indigo-100 bg-indigo-50/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-indigo-500" />
                    <h2 className="text-sm font-bold text-indigo-900">{isPastWeek ? 'Weekly Completed Works' : 'Weekly Planned Works'}</h2>
                  </div>
                  <span className="text-xs text-indigo-400">{weekDateRange}</span>
                </div>
              </div>
              <div className="divide-y divide-slate-100" style={{ minHeight: '100px' }}>
                {(() => {
                  type RI = { teamName: string; task: typeof tasks[0]; update: (typeof weeklyUpdates)[0] | undefined; activeCms: typeof tasks[0]['countermeasures']; taskActs: typeof thisWeekActivities; lines: string[] }
                  const buckets: Record<'A' | 'B' | '기타', RI[]> = { A: [], B: [], '기타': [] }

                  for (const [, { teamName, tasks: tt }] of teamEntries) {
                    for (const task of tt) {
                      const update    = updateByTaskId.get(task.id)
                      const taskActs  = thisActByTask.get(task.id) ?? []
                      const activeCms = task.countermeasures.filter(cm =>
                        shouldShowInSection(cm, new Date(task.startDate), new Date(task.endDate), weekStartMs, weekEndMs)
                        || taskActs.some((a: any) => a.countermeasureId === cm.id)
                      )
                      if (activeCms.length === 0 && taskActs.length === 0 && !update?.completed?.trim()) continue
                      const sl = (task.strategy || (task.parent as any)?.strategy || '') as string
                      const key: 'A' | 'B' | '기타' = sl === 'A' ? 'A' : sl === 'B' ? 'B' : '기타'
                      buckets[key].push({ teamName, task, update, activeCms, taskActs, lines: update?.completed?.split('\n').filter(l => l.trim()) ?? [] })
                    }
                  }

                  const STRAT_CFG = [
                    { key: 'A'   as const, hdr: 'bg-indigo-800',  dot: 'text-indigo-400' },
                    { key: 'B'   as const, hdr: 'bg-emerald-800', dot: 'text-emerald-400' },
                    { key: '기타' as const, hdr: 'bg-slate-600',   dot: 'text-indigo-400' },
                  ]

                  const renderTaskRow = (ri: RI, dotCls: string, num: number) => {
                    const { task, update, activeCms, taskActs, lines } = ri
                    return (
                      <div key={task.id} className="px-4 py-1.5">
                        <div className="flex items-center gap-2 mb-1 pb-1 border-b border-slate-100">
                          <span className="text-xs font-bold text-slate-400 shrink-0">{num})</span>
                          <span className="text-xs font-bold text-slate-800 flex-1 truncate">{task.title}</span>
                          {update && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${STATUS_BADGE[update.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                              {update.status}
                            </span>
                          )}
                        </div>
                        <div className="pl-3 space-y-0.5">
                          {activeCms.map(cm => {
                            const cmActs = taskActs.filter((a: any) => a.countermeasureId === cm.id)
                            return (
                              <div key={cm.id}>
                                <div className="flex items-center gap-1.5">
                                  <span className={`${dotCls} shrink-0 text-xs`}>●</span>
                                  <span className="text-xs font-medium text-slate-700">{cm.description}</span>
                                </div>
                                {cmActs.length > 0 && (
                                  <div className="ml-4 mt-0.5 space-y-0.5">
                                    {cmActs.map((act: any) => (
                                      <div key={act.id} className="flex items-start gap-1 text-xs text-slate-500">
                                        <span className="shrink-0 text-slate-300">-</span>
                                        <span>
                                          {act.type === '이메일' && act.referenceUrl
                                            ? <a href={act.referenceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">{act.title}</a>
                                            : act.title}
                                          {act.planStatus === '완료' && <span className="ml-1 text-[9px] font-bold text-emerald-600">[완료, {+act.date.slice(5,7)}/{+act.date.slice(8,10)}]</span>}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {lines.length > 0 && (
                          <div className="pl-3 ml-4 mt-0.5 space-y-0.5">
                            {lines.map((line, i) => (
                              <div key={i} className="flex items-start gap-1 text-xs text-slate-600">
                                <span className="shrink-0 text-slate-400">-</span><span>{line}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {(() => {
                          const unlinked = taskActs.filter((a: any) => !a.countermeasureId)
                          if (unlinked.length === 0) return null
                          return (
                            <div className={`pl-3 ml-4 ${activeCms.length > 0 || lines.length > 0 ? 'mt-1 pt-1 border-t border-slate-50' : ''} space-y-0.5`}>
                              {unlinked.map((act: any) => (
                                <div key={act.id} className="flex items-start gap-1 text-xs text-slate-500">
                                  <span className="shrink-0 text-slate-300">-</span>
                                  <span>
                                    {act.type === '이메일' && act.referenceUrl
                                      ? <a href={act.referenceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">{act.title}</a>
                                      : act.title}
                                    {act.planStatus === '완료' && <span className="ml-1 text-[9px] font-bold text-emerald-600">[완료, {+act.date.slice(5,7)}/{+act.date.slice(8,10)}]</span>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                        {activeCms.length === 0 && lines.length === 0 && taskActs.length === 0 && update?.completed && (
                          <p className="pl-3 text-xs text-slate-700 leading-relaxed">{update.completed}</p>
                        )}
                      </div>
                    )
                  }

                  const totalCount = Object.values(buckets).reduce((s, b) => s + b.length, 0)
                  if (totalCount === 0) {
                    return <div className="flex items-center justify-center h-20"><p className="text-xs text-slate-400">이번 주 완료사항이 없습니다.</p></div>
                  }

                  return STRAT_CFG.flatMap(({ key, hdr, dot }) => {
                    const items = buckets[key]
                    if (items.length === 0) return []
                    /* 섹션 헤더 레이블: "{letter}. {전략명}" or "기타 과제" */
                    const parentTitle = items[0]?.task.parent?.title ?? items[0]?.task.title ?? ''
                    const headerLabel = key !== '기타' && parentTitle ? `${key}. ${parentTitle}` : '기타 과제'
                    /* 팀별 서브그룹 */
                    const teamOrder: string[] = []
                    const byTeam = new Map<string, RI[]>()
                    for (const ri of items) {
                      if (!byTeam.has(ri.teamName)) { teamOrder.push(ri.teamName); byTeam.set(ri.teamName, []) }
                      byTeam.get(ri.teamName)!.push(ri)
                    }
                    return [
                      <div key={`sh-${key}`} className={`px-4 py-2 ${hdr} flex items-center gap-2`}>
                        <span className="text-xs font-bold text-white">{headerLabel}</span>
                        <span className="text-[10px] text-white/50">{items.length}건</span>
                      </div>,
                      ...teamOrder.flatMap(tn => [
                        <div key={`th-${key}-${tn}`} className="px-4 py-1 bg-slate-50/80 border-b border-slate-100">
                          <span className="text-[10px] font-semibold text-slate-400">{tn}</span>
                        </div>,
                        ...byTeam.get(tn)!.map((ri, idx) => renderTaskRow(ri, dot, idx + 1)),
                      ]),
                    ]
                  })
                })()}
              </div>
            </div>

            {/* Weekly Planned Works */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    <h2 className="text-sm font-bold text-slate-700">{nextWeek < currentWeekId ? 'Weekly Completed Works' : 'Weekly Planned Works'}</h2>
                  </div>
                  <span className="text-xs text-slate-400">{nextWeekDateRange}</span>
                </div>
              </div>
              <div className="divide-y divide-slate-100" style={{ minHeight: '100px' }}>
                {(() => {
                  type RI2 = { teamName: string; task: typeof tasks[0]; update: (typeof weeklyUpdates)[0] | undefined; activeCms: typeof tasks[0]['countermeasures']; taskActs: typeof nextWeekActivities; lines: string[] }
                  const buckets: Record<'A' | 'B' | '기타', RI2[]> = { A: [], B: [], '기타': [] }

                  for (const [, { teamName, tasks: tt }] of teamEntries) {
                    for (const task of tt) {
                      const update    = updateByTaskId.get(task.id)
                      const taskActs  = nextActByTask.get(task.id) ?? []
                      const activeCms = task.countermeasures.filter(cm =>
                        shouldShowInSection(cm, new Date(task.startDate), new Date(task.endDate), nextWeekStartMs, nextWeekEndMs)
                        || taskActs.some((a: any) => a.countermeasureId === cm.id)
                      )
                      if (activeCms.length === 0 && taskActs.length === 0 && !update?.planned?.trim()) continue
                      const sl = (task.strategy || (task.parent as any)?.strategy || '') as string
                      const key: 'A' | 'B' | '기타' = sl === 'A' ? 'A' : sl === 'B' ? 'B' : '기타'
                      buckets[key].push({ teamName, task, update, activeCms, taskActs, lines: update?.planned?.split('\n').filter(l => l.trim()) ?? [] })
                    }
                  }

                  const STRAT_CFG = [
                    { key: 'A'    as const, hdr: 'bg-indigo-800',  dot: 'text-sky-400' },
                    { key: 'B'    as const, hdr: 'bg-emerald-800', dot: 'text-sky-400' },
                    { key: '기타' as const, hdr: 'bg-slate-600',   dot: 'text-sky-400' },
                  ]

                  const renderTaskRow = (ri: RI2, dotCls: string, num: number) => {
                    const { task, activeCms, taskActs, lines } = ri
                    return (
                      <div key={task.id} className="px-4 py-1.5">
                        <div className="flex items-center gap-2 mb-1 pb-1 border-b border-slate-100">
                          <span className="text-xs font-bold text-slate-400 shrink-0">{num})</span>
                          <span className="text-xs font-bold text-slate-800 flex-1 truncate">{task.title}</span>
                        </div>
                        <div className="pl-3 space-y-0.5">
                          {activeCms.map(cm => {
                            const cmActs = taskActs.filter((a: any) => a.countermeasureId === cm.id)
                            return (
                              <div key={cm.id}>
                                <div className="flex items-center gap-1.5">
                                  <span className={`${dotCls} shrink-0 text-xs`}>●</span>
                                  <span className="text-xs font-medium text-slate-700">{cm.description}</span>
                                </div>
                                {cmActs.length > 0 && (
                                  <div className="ml-4 mt-0.5 space-y-0.5">
                                    {cmActs.map((act: any) => (
                                      <div key={act.id} className="flex items-start gap-1 text-xs text-slate-500">
                                        <span className="shrink-0 text-slate-300">-</span>
                                        <span>
                                          {act.type === '이메일' && act.referenceUrl
                                            ? <a href={act.referenceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">{act.title}</a>
                                            : act.title}
                                          {act.planStatus === '완료' && <span className="ml-1 text-[9px] font-bold text-emerald-600">[완료, {+act.date.slice(5,7)}/{+act.date.slice(8,10)}]</span>}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        {lines.length > 0 && (
                          <div className="pl-3 ml-4 mt-0.5 space-y-0.5">
                            {lines.map((line, i) => (
                              <div key={i} className="flex items-start gap-1 text-xs text-slate-600">
                                <span className="shrink-0 text-slate-400">-</span><span>{line}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {(() => {
                          const unlinked = taskActs.filter((a: any) => !a.countermeasureId)
                          if (unlinked.length === 0) return null
                          return (
                            <div className={`pl-3 ml-4 ${activeCms.length > 0 || lines.length > 0 ? 'mt-1 pt-1 border-t border-slate-50' : ''} space-y-0.5`}>
                              {unlinked.map((act: any) => (
                                <div key={act.id} className="flex items-start gap-1 text-xs text-slate-500">
                                  <span className="shrink-0 text-slate-300">-</span>
                                  <span>
                                    {act.type === '이메일' && act.referenceUrl
                                      ? <a href={act.referenceUrl} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">{act.title}</a>
                                      : act.title}
                                    {act.planStatus === '완료' && <span className="ml-1 text-[9px] font-bold text-emerald-600">[완료, {+act.date.slice(5,7)}/{+act.date.slice(8,10)}]</span>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  }

                  const totalCount = Object.values(buckets).reduce((s, b) => s + b.length, 0)
                  if (totalCount === 0) {
                    return <div className="flex items-center justify-center h-20"><p className="text-xs text-slate-400">차주 계획이 없습니다.</p></div>
                  }

                  return STRAT_CFG.flatMap(({ key, hdr, dot }) => {
                    const items = buckets[key]
                    if (items.length === 0) return []
                    const parentTitle = items[0]?.task.parent?.title ?? items[0]?.task.title ?? ''
                    const headerLabel = key !== '기타' && parentTitle ? `${key}. ${parentTitle}` : '기타 과제'
                    const teamOrder: string[] = []
                    const byTeam = new Map<string, RI2[]>()
                    for (const ri of items) {
                      if (!byTeam.has(ri.teamName)) { teamOrder.push(ri.teamName); byTeam.set(ri.teamName, []) }
                      byTeam.get(ri.teamName)!.push(ri)
                    }
                    return [
                      <div key={`sh-${key}`} className={`px-4 py-2 ${hdr} flex items-center gap-2`}>
                        <span className="text-xs font-bold text-white">{headerLabel}</span>
                        <span className="text-[10px] text-white/50">{items.length}건</span>
                      </div>,
                      ...teamOrder.flatMap(tn => [
                        <div key={`th-${key}-${tn}`} className="px-4 py-1 bg-slate-50/80 border-b border-slate-100">
                          <span className="text-[10px] font-semibold text-slate-400">{tn}</span>
                        </div>,
                        ...byTeam.get(tn)!.map((ri, idx) => renderTaskRow(ri, dot, idx + 1)),
                      ]),
                    ]
                  })
                })()}
              </div>
            </div>
          </section>

        </>
      )}

    </div>
  )
}
