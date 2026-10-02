import Link from 'next/link'
import { getWeekId } from '@/lib/week'
import { loadWeeklyReport, teamSummary, type WeeklyReport } from '@/lib/weeklyReport'
import WeeklyReportColumns from '@/components/WeeklyReportColumns'
import WeeklySlideShell, { AutoPrint } from '@/components/WeeklySlideShell'

export const dynamic = 'force-dynamic'

type SearchParams = { week?: string; team?: string; print?: string }

// 첫 장: 전사 요약 — 팀별 실적/계획 과제·활동 건수
function SummarySlide({ report, week }: { report: WeeklyReport; week: string }) {
  const rows = teamSummary(report)
  const sum = rows.reduce((s, r) => ({
    tt: s.tt + r.this.tasks, ta: s.ta + r.this.activities, nt: s.nt + r.next.tasks, na: s.na + r.next.activities,
  }), { tt: 0, ta: 0, nt: 0, na: 0 })
  const th = 'px-5 py-3 text-xs font-bold text-slate-500 text-right'
  const td = 'px-5 py-3.5 text-right tabular-nums'
  return (
    <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-5 py-3 text-xs font-bold text-slate-500 text-left">팀</th>
            <th className={th}>실적 과제<br /><span className="font-normal text-slate-400">{report.weekDateRange}</span></th>
            <th className={th}>실적 활동</th>
            <th className={th}>계획 과제<br /><span className="font-normal text-slate-400">{report.nextWeekDateRange}</span></th>
            <th className={th}>계획 활동</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(r => (
            <tr key={r.teamId} className="hover:bg-slate-50">
              <td className="px-5 py-3.5">
                <Link href={`/weekly-report?week=${week}&team=${r.teamId}`} className="text-base font-extrabold text-slate-800 hover:text-indigo-600">
                  {r.teamName}
                </Link>
              </td>
              <td className={`${td} text-lg font-bold text-indigo-700`}>{r.this.tasks}</td>
              <td className={`${td} text-slate-500`}>{r.this.activities}</td>
              <td className={`${td} text-lg font-bold text-slate-700`}>{r.next.tasks}</td>
              <td className={`${td} text-slate-500`}>{r.next.activities}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-800 text-white">
            <td className="px-5 py-3 text-sm font-bold">합계</td>
            <td className={`${td} font-bold`}>{sum.tt}</td>
            <td className={td}>{sum.ta}</td>
            <td className={`${td} font-bold`}>{sum.nt}</td>
            <td className={td}>{sum.na}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default async function WeeklyReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { week: weekParam, team, print } = await searchParams
  const week   = weekParam && /^\d{4}-W\d{2}$/.test(weekParam) ? weekParam : getWeekId(new Date())
  const report = await loadWeeklyReport(week)
  const teams  = report.teamEntries
  const subtitle = `${report.weekLabel} · 실적 ${report.weekDateRange} / 계획 ${report.nextWeekDateRange}`

  // ── 인쇄/PDF: 요약 + 팀별 한 쪽씩 (A4 가로) ──
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
        {sheet('summary', '전사 주간업무 요약', <SummarySlide report={report} week={week} />)}
        {teams.map(entry => sheet(entry[0], entry[1].teamName, <WeeklyReportColumns report={report} entries={[entry]} showTeamHeader={false} />))}
        <AutoPrint />
      </div>
    )
  }

  // ── 슬라이드쇼: 0 = 전사 요약, 1..n = 팀 ──
  const pages = [null, ...teams.map(([tid]) => tid)]
  const idx   = Math.max(0, team ? pages.indexOf(team) : 0)
  const href  = (i: number) => `/weekly-report?week=${week}${pages[i] ? `&team=${pages[i]}` : ''}`
  const entry = idx > 0 ? teams[idx - 1] : null

  return (
    <WeeklySlideShell
      title={entry ? entry[1].teamName : '전사 주간업무 요약'}
      subtitle={subtitle}
      page={idx + 1}
      total={pages.length}
      prevHref={idx > 0 ? href(idx - 1) : null}
      nextHref={idx < pages.length - 1 ? href(idx + 1) : null}
      firstHref={href(0)}
      lastHref={href(pages.length - 1)}
      closeHref={`/weekly?week=${week}`}
      printHref={`/weekly-report?week=${week}&print=1`}
    >
      {entry
        ? <WeeklyReportColumns report={report} entries={[entry]} showTeamHeader={false} />
        : <SummarySlide report={report} week={week} />}
    </WeeklySlideShell>
  )
}
