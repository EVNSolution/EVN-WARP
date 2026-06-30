'use client'

import { Deal } from './FunnelBoard'

const PIPELINE = ['리드', '전화상담', '대면상담', '캐피탈 심사', '계약·출고 진행', '출고 완료'] as const

interface Props { deals: Deal[] }

const Bar = ({ pct, color, label }: { pct: number; color: string; label?: string }) => (
  <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
    <div className={`h-full ${color} rounded-full flex items-center pl-2 transition-all`}
      style={{ width: `${Math.max(pct, pct > 0 ? 6 : 0)}%` }}>
      {label && pct > 10 && <span className="text-[9px] font-bold text-white">{label}</span>}
    </div>
  </div>
)

export default function FunnelStats({ deals }: Props) {
  /* ── 단계별 건수 ── */
  const stageCnt = new Map<string, number>()
  for (const d of deals) stageCnt.set(d.stage, (stageCnt.get(d.stage) ?? 0) + 1)

  const total    = deals.length
  const lostCnt  = stageCnt.get('이탈') ?? 0
  const doneCnt  = stageCnt.get('출고 완료') ?? 0

  /* ── 단계 전환율 ── */
  const convRates = PIPELINE.slice(0, -1).map((s, i) => {
    const next = PIPELINE[i + 1]
    const from = stageCnt.get(s) ?? 0
    const to   = stageCnt.get(next) ?? 0
    return { from: s, to: next, fromCnt: from, toCnt: to, pct: from > 0 ? Math.round(to / from * 100) : 0 }
  })

  /* ── 월별 출고 ── */
  const monthlyMap = new Map<string, number>()
  for (const d of deals) {
    if (d.stage !== '출고 완료') continue
    const iso = d.deliveredAt ?? d.createdAt
    const m   = iso.slice(0, 7)
    monthlyMap.set(m, (monthlyMap.get(m) ?? 0) + 1)
  }
  const months    = [...monthlyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const maxMonth  = Math.max(...months.map(([, v]) => v), 1)

  /* ── 이탈 사유 ── */
  const reasonMap = new Map<string, number>()
  for (const d of deals) {
    if (d.stage !== '이탈') continue
    const r = d.lostReason?.trim() || '사유 미입력'
    reasonMap.set(r, (reasonMap.get(r) ?? 0) + 1)
  }
  const reasons   = [...reasonMap.entries()].sort((a, b) => b[1] - a[1])
  const maxReason = Math.max(...reasons.map(([, v]) => v), 1)

  /* ── 담당자별 현황 ── */
  const assigneeMap = new Map<string, { active: number; done: number; lost: number }>()
  for (const d of deals) {
    const a = d.assignee?.trim() || '미배정'
    if (!assigneeMap.has(a)) assigneeMap.set(a, { active: 0, done: 0, lost: 0 })
    const e = assigneeMap.get(a)!
    if (d.stage === '출고 완료') e.done++
    else if (d.stage === '이탈') e.lost++
    else e.active++
  }
  const assignees = [...assigneeMap.entries()]
    .map(([name, s]) => ({ name, ...s, total: s.active + s.done + s.lost }))
    .sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-4">

      {/* 요약 수치 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '전체', value: total, color: 'text-slate-700' },
          { label: '진행 중', value: total - doneCnt - lostCnt, color: 'text-blue-600' },
          { label: '출고 완료', value: doneCnt, color: 'text-green-600' },
          { label: '이탈', value: lostCnt, color: 'text-slate-400',
            sub: total > 0 ? `${Math.round(lostCnt / total * 100)}%` : '' },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
            <p className="text-[10px] text-slate-400 mb-0.5">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>
              {item.value}
              {item.sub && <span className="text-sm font-medium text-slate-400 ml-1">({item.sub})</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* 퍼널 전환율 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-xs font-bold text-slate-700 mb-3">단계별 전환율</h3>
          <div className="space-y-2.5">
            {convRates.map(r => (
              <div key={r.from} className="flex items-center gap-2">
                <div className="flex flex-col w-24 shrink-0">
                  <span className="text-[10px] text-slate-500 truncate">{r.from}</span>
                  <span className="text-[9px] text-slate-300">↓ {r.fromCnt}건</span>
                </div>
                <Bar pct={r.pct} color="bg-indigo-500" label={`${r.pct}%`} />
                <span className="text-[10px] font-bold text-slate-700 w-8 text-right">{r.pct}%</span>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">전체 출고율</span>
              <span className="text-xs font-bold text-green-600">
                {total > 0 ? Math.round(doneCnt / total * 100) : 0}%
                <span className="text-slate-400 font-normal ml-1">({doneCnt}건)</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">전체 이탈율</span>
              <span className="text-xs font-bold text-red-500">
                {total > 0 ? Math.round(lostCnt / total * 100) : 0}%
                <span className="text-slate-400 font-normal ml-1">({lostCnt}건)</span>
              </span>
            </div>
          </div>
        </div>

        {/* 담당자별 현황 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-xs font-bold text-slate-700 mb-3">담당자별 현황</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {['담당자', '진행', '출고', '이탈', '합계'].map(h => (
                  <th key={h} className={`py-1 text-[10px] text-slate-400 font-semibold ${h === '담당자' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignees.map(a => (
                <tr key={a.name} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-1.5 text-[11px] text-slate-700 font-medium">{a.name}</td>
                  <td className="py-1.5 text-[11px] text-right text-blue-600">{a.active}</td>
                  <td className="py-1.5 text-[11px] text-right text-green-600 font-semibold">{a.done}</td>
                  <td className="py-1.5 text-[11px] text-right text-slate-400">{a.lost}</td>
                  <td className="py-1.5 text-[11px] text-right text-slate-700 font-bold">{a.total}</td>
                </tr>
              ))}
              {assignees.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-[10px] text-slate-300">데이터 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 월별 출고 추이 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-xs font-bold text-slate-700 mb-3">월별 출고 현황</h3>
          {months.length === 0
            ? <p className="text-[10px] text-slate-300 text-center py-6">출고 데이터 없음</p>
            : <div className="space-y-2">
                {months.map(([m, cnt]) => (
                  <div key={m} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 shrink-0 w-14">
                      {m.slice(0, 4)}년{m.slice(5, 7)}월
                    </span>
                    <Bar pct={cnt / maxMonth * 100} color="bg-green-500" label={String(cnt)} />
                    <span className="text-[10px] font-bold text-slate-600 w-6 text-right">{cnt}</span>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* 이탈 사유 분석 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-xs font-bold text-slate-700 mb-3">
            이탈 사유 분석
            <span className="text-slate-400 font-normal ml-1">({lostCnt}건)</span>
          </h3>
          {reasons.length === 0
            ? <p className="text-[10px] text-slate-300 text-center py-6">이탈 데이터 없음</p>
            : <div className="space-y-2">
                {reasons.slice(0, 12).map(([reason, cnt]) => (
                  <div key={reason} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 shrink-0 w-24 truncate" title={reason}>{reason}</span>
                    <Bar pct={cnt / maxReason * 100} color="bg-red-400" label={String(cnt)} />
                    <span className="text-[10px] font-bold text-slate-600 w-6 text-right">{cnt}</span>
                  </div>
                ))}
                {reasons.length > 12 && (
                  <p className="text-[9px] text-slate-300 text-right pt-1">외 {reasons.length - 12}개 사유</p>
                )}
              </div>
          }
        </div>

      </div>
    </div>
  )
}
