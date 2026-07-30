import { prisma } from '@/lib/db'
import { getWeekId, adjacentWeek, formatWeekLabel } from '@/lib/week'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react'
import KpiInputModal from '@/components/KpiInputModal'
import KpiDashboardChart from '@/components/KpiDashboardChart'
import QuickTaskModal from '@/components/QuickTaskModal'
import { teamOrderIndex } from '@/lib/teamOrder'
import { CEO_TEAM_ID } from '@/lib/constants'

type SearchParams = { week?: string }

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { week: weekParam } = await searchParams
  const currentWeekId = getWeekId(new Date())
  const weekId        = weekParam ?? currentWeekId
  const isCurrentWeek = weekId === currentWeekId
  const prevWeek      = adjacentWeek(weekId, -1)
  const nextWeek      = adjacentWeek(weekId,  1)
  const weekLabel     = formatWeekLabel(weekId)
  const currentYear   = new Date().getFullYear()
  const currentMonth  = new Date().getMonth() + 1

  const [execTasks, weeklyUpdates, companyKpisRaw, linkedRows, teams, topTasks] = await Promise.all([
    prisma.strategyTask.findMany({
      where:   { parentId: { not: null }, parent: { parentId: null }, suspended: false },
      include: { team: true },
      orderBy: [{ teamId: 'asc' }, { teamSeq: 'asc' }],
    }),
    prisma.weeklyUpdate.findMany({ where: { week: weekId } }),
    prisma.companyKpi.findMany({
      where:   { year: currentYear },
      include: { entries: { where: { year: currentYear }, orderBy: { month: 'asc' } } },
      orderBy: [{ category: 'asc' }, { index: 'asc' }],
    }),
    // linkedToFunnel은 raw SQL로 읽어야 libSQL adapter 호환
    prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "CompanyKpi" WHERE "linkedToFunnel" = 1`,
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.strategyTask.findMany({
      where: { parentId: null },
      select: { id: true, code: true, title: true, strategy: true },
      orderBy: { teamSeq: 'asc' },
    }),
  ])

  const linkedIds = new Set(linkedRows.map(r => r.id))
  const companyKpis = companyKpisRaw.map(k => ({ ...k, linkedToFunnel: linkedIds.has(k.id) }))

  /* ── 집계 ── */
  const updateByTaskId = new Map(weeklyUpdates.map(u => [u.taskId, u]))
  const statusCounts = {
    정상:    weeklyUpdates.filter(u => u.status === '정상').length,
    지연:    weeklyUpdates.filter(u => u.status === '지연').length,
    조치필요: weeklyUpdates.filter(u => u.status === '조치필요').length,
    완료:    execTasks.filter(t => t.status === '완료').length,
  }

  const teamMap = new Map<string, { teamName: string; tasks: typeof execTasks }>()
  for (const task of execTasks) {
    if (!teamMap.has(task.teamId)) teamMap.set(task.teamId, { teamName: task.team.name, tasks: [] })
    teamMap.get(task.teamId)!.tasks.push(task)
  }
  const teamEntries = [...teamMap.values()]
    .sort((a, b) => teamOrderIndex(a.teamName) - teamOrderIndex(b.teamName))

  return (
    <div className="p-5 bg-slate-100 h-[calc(100vh-64px)] flex flex-col overflow-hidden">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">경영 대시보드</h1>
          <p className="text-xs text-slate-500 mt-0.5">{currentYear}년 · 전략과제 실행현황 · 전사 KPI</p>
        </div>
        <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <Link href={`/dashboard?week=${prevWeek}`}
            className="px-3 py-2 hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors border-r border-slate-100">
            <ChevronLeft size={15} />
          </Link>
          <span className="px-5 py-2 text-sm font-semibold text-slate-800 min-w-[200px] text-center">
            {weekLabel}
            {isCurrentWeek && <span className="ml-2 text-[11px] font-bold" style={{ color: '#7a9200' }}>이번 주</span>}
          </span>
          <Link href={`/dashboard?week=${nextWeek}`}
            className="px-3 py-2 hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors border-l border-slate-100">
            <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      {/* ══ 2컬럼 그리드 ══ */}
      <div className="grid gap-4 items-stretch flex-1 min-h-0" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>

        {/* ① 전사 KPI 달성 현황 */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 flex items-center gap-3 bg-[#111111] shrink-0">
            <TrendingUp size={17} className="shrink-0" style={{ color: '#C5D42A' }} />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold" style={{ color: '#C5D42A' }}>전사 KPI 달성 현황</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">{currentYear}년 · {currentMonth}월 기준</p>
            </div>
            <KpiInputModal
              kpis={companyKpis}
              year={currentYear}
              buttonClassName="flex items-center gap-1.5 text-xs font-semibold text-white border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            <KpiDashboardChart kpis={companyKpis} currentMonth={currentMonth} />
          </div>
        </section>

        {/* ② 전략과제 현황 */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 flex items-center gap-3 bg-[#111111] shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-white">전략과제 현황</h2>
              <p className="text-[11px] mt-0.5" style={{ color: '#C5D42A' }}>팀별 실행 상태 · {weekLabel}</p>
            </div>
            <QuickTaskModal
              teams={teams}
              ceoTeamId={CEO_TEAM_ID}
              topTasks={topTasks}
              buttonClassName="flex items-center gap-1.5 text-xs font-semibold text-white border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
            />
          </div>

          <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 shrink-0">
            {[
              { label: '정상',    count: statusCounts.정상,    numCls: 'text-emerald-600', bg: 'bg-emerald-50/70' },
              { label: '지연',    count: statusCounts.지연,    numCls: 'text-amber-600',   bg: 'bg-amber-50/70' },
              { label: '조치필요', count: statusCounts.조치필요, numCls: 'text-red-500',    bg: 'bg-red-50/70' },
              { label: '완료',    count: statusCounts.완료,    numCls: 'text-blue-600',    bg: 'bg-blue-50/50' },
            ].map(({ label, count, numCls, bg }) => (
              <div key={label} className={`py-3 text-center ${bg}`}>
                <p className="text-xs text-slate-500 leading-none mb-1.5">{label}</p>
                <p className={`text-3xl font-black tabular-nums leading-none ${numCls}`}>{count}</p>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left pl-4 pr-2 py-2.5 text-xs font-semibold text-slate-400 tracking-wide">팀</th>
                <th className="text-center px-1 py-2.5 text-xs font-bold text-emerald-600 w-12">정상</th>
                <th className="text-center px-1 py-2.5 text-xs font-bold text-amber-600 w-12">지연</th>
                <th className="text-center px-1 py-2.5 text-xs font-bold text-red-500 w-14">조치필요</th>
                <th className="text-center px-1 py-2.5 text-xs font-bold text-blue-500 w-12">완료</th>
              </tr>
            </thead>
            <tbody>
              {teamEntries.map(({ teamName, tasks: teamTasks }) => {
                const cntNormal  = teamTasks.filter(t => updateByTaskId.get(t.id)?.status === '정상').length
                const cntDelayed = teamTasks.filter(t => updateByTaskId.get(t.id)?.status === '지연').length
                const cntAction  = teamTasks.filter(t => updateByTaskId.get(t.id)?.status === '조치필요').length
                const cntDone    = teamTasks.filter(t => t.status === '완료').length
                return (
                  <tr key={teamName} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="pl-4 pr-2 py-3 align-middle">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700 text-sm">{teamName}</span>
                        <span className="text-xs font-semibold text-slate-400">{teamTasks.length}건</span>
                      </div>
                    </td>
                    <td className="text-center px-1 py-3 align-middle">
                      {cntNormal > 0
                        ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-xs font-black text-emerald-700">{cntNormal}</span>
                        : <span className="text-slate-200 text-sm">—</span>}
                    </td>
                    <td className="text-center px-1 py-3 align-middle">
                      {cntDelayed > 0
                        ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-xs font-black text-amber-700">{cntDelayed}</span>
                        : <span className="text-slate-200 text-sm">—</span>}
                    </td>
                    <td className="text-center px-1 py-3 align-middle">
                      {cntAction > 0
                        ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-xs font-black text-red-600">{cntAction}</span>
                        : <span className="text-slate-200 text-sm">—</span>}
                    </td>
                    <td className="text-center px-1 py-3 align-middle">
                      {cntDone > 0
                        ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-xs font-black text-blue-600">{cntDone}</span>
                        : <span className="text-slate-200 text-sm">—</span>}
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-[#111111]">
                <td className="pl-4 pr-2 py-2.5 text-xs font-bold text-slate-400">합계 · {execTasks.length}건</td>
                <td className="text-center px-1 py-2.5 text-xs font-black text-emerald-400">{statusCounts.정상 || '—'}</td>
                <td className="text-center px-1 py-2.5 text-xs font-black text-amber-400">{statusCounts.지연 || '—'}</td>
                <td className="text-center px-1 py-2.5 text-xs font-black text-red-400">{statusCounts.조치필요 || '—'}</td>
                <td className="text-center px-1 py-2.5 text-xs font-black text-blue-400">{statusCounts.완료 || '—'}</td>
              </tr>
            </tbody>
          </table>
          </div>
        </section>

      </div>
    </div>
  )
}
