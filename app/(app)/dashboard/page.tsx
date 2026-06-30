import { prisma } from '@/lib/db'
import { getWeekId, adjacentWeek, formatWeekLabel } from '@/lib/week'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, TrendingUp, AtSign, Megaphone } from 'lucide-react'
import KpiInputModal from '@/components/KpiInputModal'
import KpiDashboardChart from '@/components/KpiDashboardChart'

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

  /* ── 데이터 조회 ── */
  const [execTasks, weeklyUpdates, companyKpis, announcements] = await Promise.all([
    prisma.strategyTask.findMany({
      where:   { parentId: { not: null }, suspended: false },
      include: { team: true },
      orderBy: [{ teamId: 'asc' }, { teamSeq: 'asc' }],
    }),
    prisma.weeklyUpdate.findMany({ where: { week: weekId } }),
    prisma.companyKpi.findMany({
      where:   { year: currentYear },
      include: { entries: { where: { year: currentYear }, orderBy: { month: 'asc' } } },
      orderBy: [{ category: 'asc' }, { index: 'asc' }],
    }),
    prisma.workActivity.findMany({
      where:   { mentions: { not: null } },
      include: { task: { select: { code: true, title: true } }, team: true },
      orderBy: { date: 'desc' },
      take: 30,
    }),
  ])

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

  const validAnn    = announcements.filter(a => a.mentions?.trim())
  const globalAnn   = validAnn.filter(a => a.mentions?.includes('@전체') || a.mentions?.includes('@all'))
  const mentionFeed = validAnn.filter(a => !a.mentions?.includes('@전체') && !a.mentions?.includes('@all'))

  return (
    <div className="p-5 bg-slate-100 min-h-screen">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">경영 대시보드</h1>
          <p className="text-xs text-slate-500 mt-0.5">{currentYear}년 · 전략과제 실행현황 · 전사 KPI · 알림마당</p>
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

      {/* ══ 3컬럼 그리드 ══ */}
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>

        {/* ① 전사 KPI 달성 현황 */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-3 bg-[#111111]">
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
          <KpiDashboardChart kpis={companyKpis} currentMonth={currentMonth} />
        </section>

        {/* ② 전략과제 현황 */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-[#111111]">
            <h2 className="text-sm font-bold text-white">전략과제 현황</h2>
            <p className="text-[11px] mt-0.5" style={{ color: '#C5D42A' }}>팀별 실행 상태 · {weekLabel}</p>
          </div>

          <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
            {[
              { label: '정상',    count: statusCounts.정상,    numCls: 'text-emerald-600', bg: 'bg-emerald-50/70' },
              { label: '지연',    count: statusCounts.지연,    numCls: 'text-amber-600',   bg: 'bg-amber-50/70' },
              { label: '조치필요', count: statusCounts.조치필요, numCls: 'text-red-500',    bg: 'bg-red-50/70' },
              { label: '완료',    count: statusCounts.완료,    numCls: 'text-blue-600',    bg: 'bg-blue-50/50' },
            ].map(({ label, count, numCls, bg }) => (
              <div key={label} className={`py-3 text-center ${bg}`}>
                <p className="text-[10px] text-slate-500 leading-none mb-1">{label}</p>
                <p className={`text-2xl font-black tabular-nums leading-none ${numCls}`}>{count}</p>
              </div>
            ))}
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left pl-4 pr-2 py-2 text-[10px] font-semibold text-slate-400 tracking-wide">팀</th>
                <th className="text-center px-1 py-2 text-[10px] font-bold text-emerald-600 w-9">정상</th>
                <th className="text-center px-1 py-2 text-[10px] font-bold text-amber-600 w-9">지연</th>
                <th className="text-center px-1 py-2 text-[10px] font-bold text-red-500 w-12">조치필요</th>
                <th className="text-center px-1 py-2 text-[10px] font-bold text-blue-500 w-10">완료</th>
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
                    <td className="pl-4 pr-2 py-2.5 align-middle">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700 text-xs">{teamName}</span>
                        <span className="text-[9px] font-semibold text-slate-400">{teamTasks.length}건</span>
                      </div>
                    </td>
                    <td className="text-center px-1 py-2.5 align-middle">
                      {cntNormal > 0
                        ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700">{cntNormal}</span>
                        : <span className="text-slate-200 text-xs">—</span>}
                    </td>
                    <td className="text-center px-1 py-2.5 align-middle">
                      {cntDelayed > 0
                        ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-[10px] font-black text-amber-700">{cntDelayed}</span>
                        : <span className="text-slate-200 text-xs">—</span>}
                    </td>
                    <td className="text-center px-1 py-2.5 align-middle">
                      {cntAction > 0
                        ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-[10px] font-black text-red-600">{cntAction}</span>
                        : <span className="text-slate-200 text-xs">—</span>}
                    </td>
                    <td className="text-center px-1 py-2.5 align-middle">
                      {cntDone > 0
                        ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-[10px] font-black text-blue-600">{cntDone}</span>
                        : <span className="text-slate-200 text-xs">—</span>}
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-[#111111]">
                <td className="pl-4 pr-2 py-2 text-[10px] font-bold text-slate-400">합계 · {execTasks.length}건</td>
                <td className="text-center px-1 py-2 text-[10px] font-black text-emerald-400">{statusCounts.정상 || '—'}</td>
                <td className="text-center px-1 py-2 text-[10px] font-black text-amber-400">{statusCounts.지연 || '—'}</td>
                <td className="text-center px-1 py-2 text-[10px] font-black text-red-400">{statusCounts.조치필요 || '—'}</td>
                <td className="text-center px-1 py-2 text-[10px] font-black text-blue-400">{statusCounts.완료 || '—'}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ③ 알림마당 */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-4 bg-[#111111]">
            <div className="flex items-center gap-2">
              <Megaphone size={15} className="shrink-0" style={{ color: '#C5D42A' }} />
              <h2 className="text-sm font-bold text-white">알림마당</h2>
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: '#C5D42A' }}>4페이지 @멘션 연동</p>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 520 }}>
            {globalAnn.length > 0 && (
              <div>
                <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
                  <Megaphone size={9} className="text-amber-500" />
                  <span className="text-[9px] font-black text-amber-700 tracking-widest uppercase">전체공지</span>
                </div>
                {globalAnn.map(a => (
                  <Link key={a.id} href={`/notes/${a.id}/edit`}
                    className="block px-4 py-3 border-b border-amber-50/80 bg-amber-50/30 hover:bg-amber-50/70 transition-colors">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{a.type}</span>
                      <span className="text-[9px] text-slate-400 ml-auto">{a.date}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 truncate">{a.title}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <AtSign size={8} className="text-amber-500 shrink-0" />
                      <span className="text-[9px] text-amber-600 truncate">{a.mentions}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {mentionFeed.length > 0 && (
              <div>
                <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5">
                  <AtSign size={9} className="text-indigo-400" />
                  <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase">멘션</span>
                </div>
                {mentionFeed.map(a => (
                  <Link key={a.id} href={`/notes/${a.id}/edit`}
                    className="block px-4 py-2.5 border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-slate-100 text-slate-500">{a.type}</span>
                      <span className="text-[9px] text-slate-400 ml-auto">{a.date}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-700 truncate">{a.title}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <AtSign size={8} className="text-indigo-400 shrink-0" />
                      <span className="text-[9px] text-indigo-500 truncate">{a.mentions}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {validAnn.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                <Megaphone size={22} className="text-amber-200 mb-2" />
                <p className="text-xs text-slate-400">4페이지 활동에서</p>
                <p className="text-xs text-slate-400">
                  <span className="font-mono font-bold text-amber-500">@전체</span>를 입력하면<br />공지로 표시됩니다.
                </p>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
