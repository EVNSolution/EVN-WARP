import { getWeekId } from '@/lib/week'
import { loadWeeklyReport } from '@/lib/weeklyReport'
import WeeklyReportColumns from '@/components/WeeklyReportColumns'
import WeeklySlideShell, { AutoPrint } from '@/components/WeeklySlideShell'

export const dynamic = 'force-dynamic'

type SearchParams = { week?: string; team?: string; print?: string }

export default async function WeeklyReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { week: weekParam, team, print } = await searchParams
  const week   = weekParam && /^\d{4}-W\d{2}$/.test(weekParam) ? weekParam : getWeekId(new Date())
  const report = await loadWeeklyReport(week)
  const teams  = report.teamEntries
  const subtitle = `${report.weekLabel} · 실적 ${report.weekDateRange} / 계획 ${report.nextWeekDateRange}`

  // ── 인쇄/PDF: 팀별 한 쪽씩 (A4 가로) ──
  if (print) {
    const sheet = (key: string, title: string, body: React.ReactNode) => (
      <section key={key} className="report-sheet">
        <div className="flex items-end justify-between px-6 py-3 mb-3 rounded-lg" style={{ backgroundColor: '#111111' }}>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-white/50">EV&amp;Solution · WARP 주간업무 보고</p>
            <h1 className="text-xl font-black text-white">{title}</h1>
          </div>
          <p className="text-xs font-semibold" style={{ color: '#C5D42A' }}>{subtitle}</p>
        </div>
        {body}
      </section>
    )
    return (
      <div className="bg-white p-4">
        <style>{`
          @page { size: A4 landscape; margin: 8mm; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .report-sheet { break-after: page; }
          .report-sheet:last-child { break-after: auto; }
          @media screen { .report-sheet { max-width: 1400px; margin: 0 auto 32px; } }
          @media print { .no-print { display: none !important; } .shadow-sm { box-shadow: none !important; } }
        `}</style>
        <p className="no-print text-center text-xs text-slate-400 mb-4">인쇄 대화상자에서 대상을 「PDF로 저장」으로 고르면 PDF 파일로 받을 수 있습니다.</p>
        {teams.map(entry => sheet(entry[0], entry[1].teamName, <WeeklyReportColumns report={report} entries={[entry]} showTeamHeader={false} />))}
        <AutoPrint />
      </div>
    )
  }

  // ── 슬라이드쇼: 팀당 한 장 (팀 미지정·잘못된 팀이면 첫 팀) ──
  if (teams.length === 0) {
    return <p className="p-10 text-center text-sm text-slate-400">표시할 팀 과제가 없습니다.</p>
  }
  const idx   = Math.max(0, teams.findIndex(([tid]) => tid === team))
  const href  = (i: number) => `/weekly-report?week=${week}&team=${teams[i][0]}`
  const entry = teams[idx]

  return (
    <WeeklySlideShell
      title={entry[1].teamName}
      subtitle={subtitle}
      page={idx + 1}
      total={teams.length}
      prevHref={idx > 0 ? href(idx - 1) : null}
      nextHref={idx < teams.length - 1 ? href(idx + 1) : null}
      firstHref={href(0)}
      lastHref={href(teams.length - 1)}
      closeHref={`/weekly?week=${week}`}
      printHref={`/weekly-report?week=${week}&print=1`}
    >
      <WeeklyReportColumns report={report} entries={[entry]} showTeamHeader={false} />
    </WeeklySlideShell>
  )
}
