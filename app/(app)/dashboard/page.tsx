import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { getWeekId, adjacentWeek, formatWeekLabel } from '@/lib/week'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, TrendingUp, AtSign, Megaphone, ClipboardList, Globe, MapPin } from 'lucide-react'
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

  const session = await auth()
  const myId    = (session?.user as any)?.id as string | undefined
  const myName  = session?.user?.name as string | undefined

  /* ── 데이터 조회 ── */
  const likePattern = myName ? `%@${myName}%` : '%__NOMATCH__%'

  const [execTasks, weeklyUpdates, companyKpisRaw, pendingTrips, myMentions, globalAnn, linkedRows] = await Promise.all([
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
    // 승인요청 상태 출장보고 전체 (내 결재 대기 필터링용)
    prisma.$queryRaw<any[]>`
      SELECT id, title, type, "userName", "approversJson", "submittedAt"
      FROM "TripReport"
      WHERE status = '승인요청'
      ORDER BY "submittedAt" DESC
    `,
    // 나를 @멘션한 업무활동 (전체공지 제외)
    prisma.$queryRaw<any[]>`
      SELECT id, title, date, type, mentions
      FROM "WorkActivity"
      WHERE mentions IS NOT NULL AND mentions != ''
      AND mentions LIKE ${likePattern}
      AND mentions NOT LIKE '%@전체%'
      AND mentions NOT LIKE '%@all%'
      ORDER BY date DESC
      LIMIT 10
    `,
    // @전체 공지
    prisma.$queryRaw<any[]>`
      SELECT id, title, date, type, mentions
      FROM "WorkActivity"
      WHERE (mentions LIKE '%@전체%' OR mentions LIKE '%@all%')
      ORDER BY date DESC
      LIMIT 5
    `,
    // linkedToFunnel은 raw SQL로 읽어야 libSQL adapter 호환
    prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "CompanyKpi" WHERE "linkedToFunnel" = 1`,
  ])

  const linkedIds = new Set(linkedRows.map(r => r.id))
  const companyKpis = companyKpisRaw.map(k => ({ ...k, linkedToFunnel: linkedIds.has(k.id) }))

  // 내가 결재해야 할 대기 건 필터링
  const myPendingApprovals = myId ? pendingTrips.filter((trip: any) => {
    try {
      const approvers = JSON.parse(trip.approversJson ?? '[]')
      return approvers.some((a: any) => a.userId === myId && (!a.status || a.status === '' || a.status === '대기'))
    } catch { return false }
  }) : []

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

  const totalPending = myPendingApprovals.length + myMentions.length + globalAnn.length

  return (
    <div className="p-5 bg-slate-100 h-[calc(100vh-64px)] flex flex-col overflow-hidden">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">경영 대시보드</h1>
          <p className="text-xs text-slate-500 mt-0.5">{currentYear}년 · 전략과제 실행현황 · 전사 KPI · 나의 대기 업무</p>
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
      <div className="grid gap-4 items-stretch flex-1 min-h-0" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>

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
          <div className="px-5 py-4 bg-[#111111] shrink-0">
            <h2 className="text-sm font-bold text-white">전략과제 현황</h2>
            <p className="text-[11px] mt-0.5" style={{ color: '#C5D42A' }}>팀별 실행 상태 · {weekLabel}</p>
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

        {/* ③ 나의 대기 업무 */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-4 bg-[#111111] shrink-0">
            <div className="flex items-center gap-2">
              <ClipboardList size={15} className="shrink-0" style={{ color: '#C5D42A' }} />
              <h2 className="text-sm font-bold text-white">나의 대기 업무</h2>
              {totalPending > 0 && (
                <span className="ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full text-black"
                  style={{ backgroundColor: '#C5D42A' }}>
                  {totalPending}
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: '#555' }}>
              {myName ? `${myName} 기준` : '로그인 필요'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">

            {/* 결재 대기 */}
            {myPendingApprovals.length > 0 && (
              <div>
                <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5 sticky top-0">
                  <ClipboardList size={9} className="text-amber-500" />
                  <span className="text-[9px] font-black text-amber-700 tracking-widest uppercase">결재 대기</span>
                  <span className="ml-auto text-[9px] font-bold text-amber-600">{myPendingApprovals.length}건</span>
                </div>
                {myPendingApprovals.map((trip: any) => (
                  <Link key={trip.id} href={`/trip/${trip.id}`}
                    className="flex items-center gap-2.5 px-4 py-3 border-b border-amber-50/80 bg-amber-50/20 hover:bg-amber-50/60 transition-colors">
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${trip.type === '해외출장' ? 'bg-red-100' : 'bg-orange-100'}`}>
                      {trip.type === '해외출장'
                        ? <Globe size={9} className="text-red-600" />
                        : <MapPin size={9} className="text-orange-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{trip.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{trip.userName}</p>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">대기</span>
                  </Link>
                ))}
              </div>
            )}

            {/* @멘션 협조 요청 */}
            {myMentions.length > 0 && (
              <div>
                <div className="px-4 py-1.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-1.5 sticky top-0">
                  <AtSign size={9} className="text-indigo-400" />
                  <span className="text-[9px] font-black text-indigo-600 tracking-widest uppercase">@멘션</span>
                  <span className="ml-auto text-[9px] font-bold text-indigo-500">{myMentions.length}건</span>
                </div>
                {myMentions.map((a: any) => (
                  <Link key={a.id} href={`/notes/${a.id}/edit`}
                    className="block px-4 py-2.5 border-b border-indigo-50/60 hover:bg-indigo-50/30 transition-colors">
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

            {/* @전체 공지 */}
            {globalAnn.length > 0 && (
              <div>
                <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 sticky top-0">
                  <Megaphone size={9} className="text-slate-400" />
                  <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase">전체공지</span>
                </div>
                {globalAnn.map((a: any) => (
                  <Link key={a.id} href={`/notes/${a.id}/edit`}
                    className="block px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-slate-100 text-slate-500">{a.type}</span>
                      <span className="text-[9px] text-slate-400 ml-auto">{a.date}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-700 truncate">{a.title}</p>
                  </Link>
                ))}
              </div>
            )}

            {/* 모두 없을 때 */}
            {totalPending === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                <ClipboardList size={22} className="text-slate-200 mb-2" />
                <p className="text-xs text-slate-400">대기 중인 업무가 없습니다</p>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
