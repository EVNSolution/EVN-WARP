// 주간업무보고 2단(실적 / 계획) — /weekly 와 /weekly-report 공용 (서버 컴포넌트)
import Link from 'next/link'
import { CheckCircle, Clock, Layers } from 'lucide-react'
import { stratColor, WEEKLY_STATUS_BADGE as STATUS_BADGE } from '@/lib/a3'
import { collectReportItems, type ReportItem, type TeamEntry, type WeeklyReport } from '@/lib/weeklyReport'

function ReportColumn({ report, entries, kind, showTeamHeader }: {
  report: WeeklyReport; entries: readonly TeamEntry[]; kind: 'this' | 'next'; showTeamHeader: boolean
}) {
  const buckets = collectReportItems(report, entries, kind)
  const isThis  = kind === 'this'
  const completed = isThis ? report.thisIsCompleted : report.nextIsCompleted

  const renderLeafRow = (ri: ReportItem, dotCls: string, num: number) => {
    const { leaf, update, taskActs, lines } = ri
    return (
      <div key={leaf.id} className="pl-9 pr-4 py-1.5 break-inside-avoid">
        <div className="flex items-center gap-2 mb-1 pb-1 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-400 shrink-0">{num})</span>
          <span className="text-xs font-bold text-slate-800 flex-1 truncate">{leaf.title}</span>
          {isThis && update && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${STATUS_BADGE[update.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {update.status}
            </span>
          )}
        </div>
        <div className="pl-3 space-y-0.5">
          {taskActs.map(act => (
            <Link key={act.id} href={`/notes/${act.id}/edit`}
              className="flex items-start gap-1.5 text-xs text-slate-600 hover:bg-slate-50 rounded px-1 -mx-1 transition-colors">
              <span className="shrink-0 text-xs" style={{ color: dotCls }}>●</span>
              <span>
                <span className="hover:underline hover:text-indigo-600">{act.title}</span>
                <span className="ml-1 text-slate-400">({act.userName ?? '담당자 미상'}, {+act.date.slice(5, 7)}/{+act.date.slice(8, 10)})</span>
              </span>
            </Link>
          ))}
        </div>
        {lines.length > 0 && (
          <div className={`pl-3 ${taskActs.length > 0 ? 'mt-1 pt-1 border-t border-slate-50' : ''} space-y-0.5`}>
            {lines.map((line, i) => (
              <div key={i} className="flex items-start gap-1 text-xs text-slate-600">
                <span className="shrink-0 text-slate-400">-</span><span>{line}</span>
              </div>
            ))}
          </div>
        )}
        {isThis && taskActs.length === 0 && lines.length === 0 && update?.completed && (
          <p className="pl-3 text-xs text-slate-700 leading-relaxed">{update.completed}</p>
        )}
      </div>
    )
  }

  /* 팀 안에서 팀전략 단위로 묶어서 렌더 — 팀전략 라벨을 한 번 보여주고 그 아래 세부전략과제들을 번호로 나열 */
  const renderTeamLeaves = (items: ReportItem[], dot: string) => {
    const out: React.ReactNode[] = []
    let i = 0
    while (i < items.length) {
      const { parentTask } = items[i]
      const group: ReportItem[] = []
      while (i < items.length && items[i].parentTask.id === parentTask.id) { group.push(items[i]); i++ }
      out.push(
        <div key={`pt-${parentTask.id}`} className="pl-8 pr-4 py-1 flex items-center gap-1.5 bg-indigo-50/70">
          <Layers size={11} className="text-indigo-400 shrink-0" />
          <span className="text-[9px] font-bold text-indigo-500 align-middle">[팀과제]</span>
          <span className="text-[11px] text-indigo-900/70 align-middle">{parentTask.title}</span>
        </div>
      )
      group.forEach((ri, idx) => out.push(renderLeafRow(ri, dot, idx + 1)))
    }
    return out
  }

  const totalCount = [...buckets.values()].reduce((s, b) => s + b.length, 0)
  const sortedKeys = [...buckets.keys()].sort((a, b) => a === '기타' ? 1 : b === '기타' ? -1 : a.localeCompare(b))

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className={`px-5 py-3 border-b ${isThis ? 'border-indigo-100 bg-indigo-50/60' : 'border-slate-100 bg-slate-50/70'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isThis ? <CheckCircle size={14} className="text-indigo-500" /> : <Clock size={14} className="text-slate-400" />}
            <h2 className={`text-sm font-bold ${isThis ? 'text-indigo-900' : 'text-slate-700'}`}>
              {completed ? 'Weekly Completed Works' : 'Weekly Planned Works'}
            </h2>
          </div>
          <span className={`text-xs ${isThis ? 'text-indigo-400' : 'text-slate-400'}`}>{isThis ? report.weekDateRange : report.nextWeekDateRange}</span>
        </div>
      </div>
      <div className="divide-y divide-slate-100" style={{ minHeight: '100px' }}>
        {totalCount === 0 ? (
          <div className="flex items-center justify-center h-20">
            <p className="text-xs text-slate-400">{isThis ? '이번 주 완료사항이 없습니다.' : '차주 계획이 없습니다.'}</p>
          </div>
        ) : sortedKeys.flatMap(key => {
          const items = buckets.get(key)!
          if (items.length === 0) return []
          const hdr = key === '기타' ? 'bg-slate-600' : stratColor(key).bold
          const dot = key === '기타' ? '#94a3b8' : stratColor(key).hex
          /* 섹션 헤더 레이블: "{letter}. {전략명}" or "기타 과제" */
          const parentTitle = items[0]?.parentTask.parent?.title ?? items[0]?.parentTask.title ?? ''
          const headerLabel = key !== '기타' && parentTitle ? `${key}. ${parentTitle}` : '기타 과제'
          /* 팀별 서브그룹 */
          const teamOrder: string[] = []
          const byTeam = new Map<string, ReportItem[]>()
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
              ...(showTeamHeader ? [
                <div key={`th-${key}-${tn}`} className="px-4 py-1.5 bg-slate-100 border-b border-slate-200">
                  <span className="text-xs font-extrabold text-slate-800 tracking-tight">{tn}</span>
                </div>,
              ] : []),
              ...renderTeamLeaves(byTeam.get(tn)!, dot),
            ]),
          ]
        })}
      </div>
    </div>
  )
}

export default function WeeklyReportColumns({ report, entries, showTeamHeader = true }: {
  report: WeeklyReport; entries: readonly TeamEntry[]; showTeamHeader?: boolean
}) {
  return (
    <section className="grid grid-cols-2 gap-4 mb-4">
      <ReportColumn report={report} entries={entries} kind="this" showTeamHeader={showTeamHeader} />
      <ReportColumn report={report} entries={entries} kind="next" showTeamHeader={showTeamHeader} />
    </section>
  )
}
