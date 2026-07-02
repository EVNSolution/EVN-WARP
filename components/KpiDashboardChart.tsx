'use client'

import { useState } from 'react'

const EVN_GREEN = '#C5D42A'
const MONTHS    = ['1','2','3','4','5','6','7','8','9','10','11','12']
const BAR_H        = 104  // 월별 차트 높이(px)
const ANNUAL_BAR_H = 156  // 연간 차트 높이(px, 월별 × 1.5)

interface Entry  { month: number; target: number | null; actual: number | null }
interface KpiRow {
  id: string; label: string; unit: string | null
  category: string; index: number; annualTarget: number | null
  entries: Entry[]
}

function fmt(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (v >= 10_000)      return `${Math.round(v / 10_000)}만`
  return v.toLocaleString()
}

function niceMax(vals: number[]): number {
  const pos = vals.filter(v => v > 0)
  if (!pos.length) return 1
  const raw = Math.max(...pos) * 1.15
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const n   = raw / mag
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag
}

function rateColor(rate: number | null): string {
  if (rate == null) return '#94a3b8'
  if (rate >= 100)  return EVN_GREEN
  if (rate >= 80)   return '#475569'
  if (rate >= 60)   return '#f59e0b'
  return '#ef4444'
}

/* ── 12개월 바차트 ── */
function MonthlyBars({ entries, currentMonth }: { entries: Entry[]; currentMonth: number }) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const e = entries.find(en => en.month === i + 1)
    return { month: i + 1, target: e?.target ?? 0, actual: e?.actual ?? null }
  })
  const maxVal = niceMax(months.flatMap(m => [m.target, m.actual ?? 0]))

  return (
    <div className="mt-2">
      <div className="flex items-end gap-px" style={{ height: BAR_H }}>
        {months.map(({ month, target, actual }) => {
          const tPct  = (target / maxVal) * 100
          const aPct  = actual != null ? (actual / maxVal) * 100 : 0
          const isCur = month === currentMonth
          const ok    = actual != null && target > 0 && actual >= target
          return (
            <div key={month}
              className="flex-1 flex items-end justify-center gap-px"
              style={{
                height: '100%',
                backgroundColor: isCur ? `${EVN_GREEN}18` : undefined,
                borderRadius: 2,
              }}>
              {/* 목표 막대 */}
              <div className="w-[42%] flex flex-col justify-end" style={{ height: '100%' }}>
                <div className="w-full rounded-t-sm"
                  style={{
                    height: `${tPct}%`,
                    minHeight: target > 0 ? 1 : 0,
                    backgroundColor: isCur ? '#7ca300' : '#94a3b8',
                  }} />
              </div>
              {/* 실적 막대 */}
              <div className="w-[42%] flex flex-col justify-end" style={{ height: '100%' }}>
                {actual != null
                  ? <div className="w-full rounded-t-sm"
                      style={{
                        height: `${aPct}%`,
                        minHeight: actual > 0 ? 1 : 0,
                        backgroundColor: ok ? EVN_GREEN : '#ef4444',
                      }} />
                  : null}
              </div>
            </div>
          )
        })}
      </div>
      {/* X축 */}
      <div className="flex gap-px mt-0.5">
        {MONTHS.map((m, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[8px] leading-none"
              style={{ color: i + 1 === currentMonth ? '#7a9200' : '#cbd5e1', fontWeight: i + 1 === currentMonth ? 700 : 400 }}>
              {m}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 연간 바차트 (연간목표 vs YTD) ── */
function AnnualBars({ annualTgt, ytd }: { annualTgt: number; ytd: number }) {
  const maxVal = niceMax([annualTgt, ytd])
  const tPct   = (annualTgt / maxVal) * 100
  const aPct   = (ytd       / maxVal) * 100
  const ok     = annualTgt > 0 && ytd >= annualTgt
  const BAR_W  = 28   // px, 두 바만 있으므로 좀 굵게

  return (
    <div className="mt-2 flex items-end gap-3">
      {/* Y축 레이블 */}
      <div className="flex flex-col justify-between text-right shrink-0" style={{ width: 32, height: ANNUAL_BAR_H }}>
        <span className="text-[8px] text-slate-300 leading-none">{fmt(maxVal)}</span>
        <span className="text-[8px] text-slate-300 leading-none">0</span>
      </div>

      {/* 막대 영역 */}
      <div className="flex items-end gap-2" style={{ height: ANNUAL_BAR_H }}>
        {/* 연간 목표 */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-end" style={{ height: ANNUAL_BAR_H }}>
            <div className="rounded-t-sm"
              style={{ width: BAR_W, height: `${tPct}%`, minHeight: annualTgt > 0 ? 2 : 0, backgroundColor: '#64748b' }} />
          </div>
          <span className="text-[9px] text-slate-400 whitespace-nowrap">연간 목표</span>
        </div>
        {/* YTD 실적 */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-end" style={{ height: ANNUAL_BAR_H }}>
            <div className="rounded-t-sm"
              style={{
                width: BAR_W,
                height: `${aPct}%`,
                minHeight: ytd > 0 ? 2 : 0,
                backgroundColor: ok ? EVN_GREEN : '#ef4444',
              }} />
          </div>
          <span className="text-[9px] text-slate-400 whitespace-nowrap">YTD 실적</span>
        </div>
      </div>

      {/* 수치 */}
      <div className="flex flex-col justify-end gap-1 pb-5 text-[10px] text-slate-500">
        <span>목표 <span className="font-bold text-slate-700">{annualTgt > 0 ? fmt(annualTgt) : '—'}</span></span>
        <span>실적 <span className="font-bold" style={{ color: rateColor(annualTgt > 0 ? Math.round(ytd / annualTgt * 100) : null) }}>{fmt(ytd)}</span></span>
      </div>
    </div>
  )
}

/* ── 메인 컴포넌트 ── */
export default function KpiDashboardChart({
  kpis, currentMonth,
}: {
  kpis: KpiRow[]; currentMonth: number
}) {
  const [view, setView] = useState<'monthly' | 'annual'>('monthly')

  if (kpis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-1 text-center px-6">
        <p className="text-sm text-slate-400">등록된 전사 KPI가 없습니다.</p>
        <p className="text-xs text-slate-400">상단 <span className="font-semibold" style={{ color: '#7a9200' }}>KPI 입력</span> 버튼을 눌러 추가하세요.</p>
      </div>
    )
  }

  return (
    <div>
      {/* 토글 */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <span className="text-[10px] text-slate-400 font-medium">
          {view === 'monthly' ? `${currentMonth}월 기준 · 목표 vs 실적` : '연간 목표 vs YTD 누적'}
        </span>
        <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
          {(['monthly', 'annual'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                view === v ? 'text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
              style={view === v ? { backgroundColor: EVN_GREEN } : {}}>
              {v === 'monthly' ? '월별' : '연간'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI 세로 목록 */}
      <div className="divide-y divide-slate-100">
        {kpis.map((kpi, idx) => {
          const thisEntry  = kpi.entries.find(e => e.month === currentMonth)
          const mTarget    = thisEntry?.target ?? 0
          const mActual    = thisEntry?.actual ?? null
          const mRate      = mTarget > 0 && mActual != null ? Math.round(mActual / mTarget * 100) : null

          const ytd        = kpi.entries.filter(e => e.month <= currentMonth).reduce((s, e) => s + (e.actual ?? 0), 0)
          const annualTgt  = kpi.annualTarget ?? kpi.entries.reduce((s, e) => s + (e.target ?? 0), 0)
          const annualRate = annualTgt > 0 ? Math.round(ytd / annualTgt * 100) : null

          const displayRate = view === 'monthly' ? mRate : annualRate

          return (
            <div key={kpi.id} className="px-5 pt-4 pb-3">
              {/* KPI 헤더 */}
              <div className="flex items-center gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-black"
                  style={{ backgroundColor: EVN_GREEN }}>
                  {idx + 1}
                </span>
                <span className="flex-1 text-xs font-bold text-slate-800 truncate">{kpi.label}</span>
                {kpi.unit && <span className="text-[10px] text-slate-400 shrink-0">({kpi.unit})</span>}
                <span className="shrink-0 text-sm font-black tabular-nums" style={{ color: rateColor(displayRate) }}>
                  {displayRate != null ? `${displayRate}%` : '—'}
                </span>
              </div>

              {/* 월별 이달 수치 */}
              {view === 'monthly' && (
                <div className="flex gap-3 mt-1.5 text-[10px] text-slate-500">
                  <span>{currentMonth}월 목표 <span className="font-bold text-slate-700">{mTarget > 0 ? fmt(mTarget) : '—'}</span></span>
                  <span className="text-slate-300">|</span>
                  <span>실적 <span className="font-bold" style={{ color: mActual != null ? rateColor(mRate) : '#94a3b8' }}>
                    {mActual != null ? fmt(mActual) : '미입력'}
                  </span></span>
                </div>
              )}

              {/* 차트 */}
              {view === 'monthly'
                ? <MonthlyBars entries={kpi.entries} currentMonth={currentMonth} />
                : <AnnualBars  annualTgt={annualTgt} ytd={ytd} />
              }
            </div>
          )
        })}
      </div>

      {/* 범례 */}
      {(() => {
        const items = view === 'monthly'
          ? [{ color: '#94a3b8', label: '목표' }, { color: '#ef4444', label: '실적(미달)' }, { color: EVN_GREEN, label: '실적(달성)' }]
          : [{ color: '#64748b', label: '연간목표' }, { color: '#ef4444', label: 'YTD(미달)' }, { color: EVN_GREEN, label: 'YTD(달성)' }]
        return (
          <div className="flex items-center gap-4 px-5 py-2.5 border-t border-slate-100 bg-slate-50/60">
            {items.map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
