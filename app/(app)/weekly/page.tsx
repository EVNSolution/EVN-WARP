import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import Link from 'next/link'
import { getWeekId, getWeekStart, adjacentWeek, formatWeekLabel } from '@/lib/week'
import { ChevronLeft, ChevronRight, Presentation, Printer } from 'lucide-react'
import GanttChart from '@/components/GanttChart'
import WeeklyReportColumns from '@/components/WeeklyReportColumns'
import { StartSlideshowButton } from '@/components/WeeklySlideShell'
import { aggregateDateRange } from '@/lib/kpiAggregate'
import { loadWeeklyReport } from '@/lib/weeklyReport'

type SearchParams = { week?: string; tab?: string; view?: string }

export default async function WeeklyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { week: weekParam, tab, view: viewParam } = await searchParams
  const activeTab  = tab === 'gantt' ? 'gantt' : 'weekly'
  const activeView = (viewParam === 'team' || viewParam === 'personal') ? viewParam : 'company'

  const currentWeekId = getWeekId(new Date())
  const weekId        = weekParam ?? currentWeekId
  const isCurrentWeek = weekId === currentWeekId

  // 7주 윈도우: [weekId-1 … weekId+5]
  const ganttWeeks: string[] = []
  for (let i = -1; i < 6; i++) ganttWeeks.push(adjacentWeek(weekId, i))

  const windowStart = getWeekStart(ganttWeeks[0])
  const windowEnd   = getWeekStart(ganttWeeks[ganttWeeks.length - 1])
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 7)
  const windowDays  = (windowEnd.getTime() - windowStart.getTime()) / 86400000

  const prevWeek     = adjacentWeek(weekId, -1)
  const nextWeek     = adjacentWeek(weekId,  1)
  const weekStartIso = getWeekStart(weekId).toISOString()

  const session   = await auth()
  const me        = session?.user as any
  const myUserId  = me?.id  as string | undefined
  const dbUser    = myUserId ? await prisma.user.findUnique({ where: { id: myUserId }, select: { teamId: true } }) : null
  const myTeamId  = dbUser?.teamId ?? null

  const report = await loadWeeklyReport(weekId)
  const { tasks, prevWeekUpdates, thisWeekActivities, nextWeekActivities, updateByTaskId, teamMap, teamEntries } = report

  // 팀과제 자체 기간이 없으면(신규 경량 팀과제) 세부과제 기간에서 자동 계산
  const effRangeByTaskId = new Map<string, { start: Date | null; end: Date | null }>()
  for (const t of tasks) {
    if (t.startDate && t.endDate) {
      effRangeByTaskId.set(t.id, { start: t.startDate, end: t.endDate })
    } else {
      const agg = aggregateDateRange(t.subTasks)
      effRangeByTaskId.set(t.id, { start: agg.startDate, end: agg.endDate })
    }
  }

  // ── 뷰 스코프 필터 ──
  const myThisActTaskIds = new Set(thisWeekActivities.filter(a => a.userId === myUserId && a.taskId).map(a => a.taskId!))
  const myNextActTaskIds = new Set(nextWeekActivities.filter(a => a.userId === myUserId && a.taskId).map(a => a.taskId!))

  const viewTeamEntries = activeView === 'personal'
    ? teamEntries.map(([tid, te]) => [tid, {
        ...te,
        tasks: te.tasks.filter(t => myThisActTaskIds.has(t.id) || myNextActTaskIds.has(t.id)),
      }] as const).filter(([, te]) => te.tasks.length > 0)
    : activeView === 'team'
    ? teamEntries.filter(([tid]) => tid === myTeamId)
    : teamEntries

  const withParams = (o: { week?: string }) =>
    `/weekly?week=${o.week ?? weekId}&tab=${activeTab}&view=${activeView}`

  const todayMs  = Date.now()
  const todayPos = todayMs >= windowStart.getTime() && todayMs <= windowEnd.getTime()
    ? (todayMs - windowStart.getTime()) / 86400000 / windowDays * 100 : null

  /* GanttChart 클라이언트 컴포넌트에 넘길 직렬화 데이터 — 뷰 스코프 적용 */
  const ganttTeamEntries = viewTeamEntries.map(([teamId, { teamName, tasks: tt }]) => ({
    teamId,
    teamName,
    tasks: tt
      .filter(t => {
        const r = effRangeByTaskId.get(t.id)!
        return r.start && r.end
      })
      .map(t => {
        const r = effRangeByTaskId.get(t.id)!
        return {
          id: t.id, code: t.code, title: t.title, teamId: t.teamId,
          strategy:    t.strategy || (t.parent as any)?.strategy || '',
          parentTitle: (t.parent as any)?.title ?? null,
          startDate: r.start!.toISOString(),
          endDate:   r.end!.toISOString(),
          hasOwnStatus: t.subTasks.length === 0,
          subItems: t.subTasks.length > 0
            ? t.subTasks.map(s => ({
                kind: 'subtask' as const,
                id: s.id, title: s.title,
                startDate: s.startDate ? s.startDate.toISOString() : null,
                endDate:   s.endDate   ? s.endDate.toISOString()   : null,
              }))
            : t.countermeasures.map(cm => ({
                kind: 'countermeasure' as const,
                id: cm.id, index: cm.index, description: cm.description, owner: cm.owner,
                startDate: cm.startDate as string | null,
                endDate:   cm.endDate   as string | null,
              })),
        }
      }),
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
            <Link href={withParams({ week: prevWeek })}
              className="px-2.5 py-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors border-r border-white/20">
              <ChevronLeft size={16} />
            </Link>
            <span className="px-4 py-1.5 text-sm font-semibold text-white min-w-[210px] text-center">
              {formatWeekLabel(weekId)}
              {isCurrentWeek && <span className="ml-2 text-xs font-medium" style={{ color: '#C5D42A' }}>이번 주</span>}
            </span>
            <Link href={withParams({ week: nextWeek })}
              className="px-2.5 py-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors border-l border-white/20">
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── 스코프 바 ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-slate-400 font-medium">보기:</span>
        {([
          { v: 'company',  label: '전사' },
          { v: 'team',     label: '내 팀' },
          { v: 'personal', label: '개인' },
        ] as const).map(({ v, label }) => (
          <Link key={v}
            href={`/weekly?week=${weekId}&tab=${activeTab}&view=${v}`}
            className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
              activeView === v
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
            }`}>
            {label}
          </Link>
        ))}
        {activeView !== 'company' && !myTeamId && (
          <span className="text-xs text-amber-500">
            ⚠ <Link href="/account" className="underline hover:text-amber-700">내 계정</Link>에서 소속팀을 먼저 설정하세요
          </span>
        )}
        {activeView === 'personal' && myTeamId && (
          <span className="text-xs text-slate-400">내가 활동을 기록한 과제만 표시</span>
        )}
        {activeView === 'team' && myTeamId && (
          <span className="text-xs text-slate-400">{teamMap.get(myTeamId)?.teamName ?? ''} 과제만 표시</span>
        )}

        {/* 팀별 보고 화면 — 회의용 독립 페이지(팀당 한 장) · 인쇄/PDF */}
        {activeTab === 'weekly' && (
          <>
            <span className="w-px h-4 bg-slate-200 mx-1" />
            <StartSlideshowButton href={`/weekly-report?week=${weekId}`}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors">
              <Presentation size={12} /> 팀별 보고 (슬라이드쇼)
            </StartSlideshowButton>
            <Link href={`/weekly-report?week=${weekId}&print=1`} target="_blank"
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border border-slate-200 text-slate-500 hover:border-slate-400 transition-colors">
              <Printer size={12} /> 인쇄/PDF
            </Link>
          </>
        )}
      </div>

      {/* ── 탭 네비게이션 ── */}
      <div className="flex gap-0 mb-4 border-b border-slate-200">
        <Link
          href={`/weekly?week=${weekId}&tab=weekly&view=${activeView}`}
          className={`px-6 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            activeTab === 'weekly'
              ? 'border-[#C5D42A] text-[#7a9200] bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          주간업무보고<span className="text-[80%] font-normal">(과제별 활동 실적 및 계획)</span>
        </Link>
        <Link
          href={`/weekly?week=${weekId}&tab=gantt&view=${activeView}`}
          className={`px-6 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            activeTab === 'gantt'
              ? 'border-[#C5D42A] text-[#7a9200] bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          간트<span className="text-[80%] font-normal">(과제별 진도 확인)</span>
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
              <h2 className="text-sm font-bold text-slate-700">전략과제 실행계획 · 7주</h2>
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
        <WeeklyReportColumns report={report} entries={viewTeamEntries} />
      )}

    </div>
  )
}
