'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

const PERIODS = [
  { label: '오늘',     key: 'today' },
  { label: '이번 주',  key: 'week' },
  { label: '이번 달',  key: 'month' },
  { label: '올해',     key: 'year' },
  { label: '기간 지정', key: 'custom' },
]

interface Props { from: string; to: string; period: string; view: string }

export default function PeriodSelector({ from, to, period, view }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo,   setCustomTo]   = useState(to)

  function go(p: string, f?: string, t?: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', p)
    if (f) params.set('from', f)
    if (t) params.set('to', t)
    router.push(`/sales-report?${params.toString()}`)
  }

  function setView(v: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', v)
    router.push(`/sales-report?${params.toString()}`)
  }

  function applyCustom() {
    go('custom', customFrom, customTo)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* 기간 선택 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => go(p.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition
              ${period === p.key
                ? 'bg-slate-800 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'}`}
          >
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <div className="flex items-center gap-1.5 ml-1">
            <input
              type="date" value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-700"
            />
            <span className="text-xs text-slate-400">~</span>
            <input
              type="date" value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-700"
            />
            <button
              onClick={applyCustom}
              className="px-3 py-1.5 bg-slate-700 text-white text-xs font-semibold rounded-lg hover:bg-slate-900 transition"
            >
              조회
            </button>
          </div>
        )}
      </div>

      {/* 구분선 */}
      <div className="w-px h-5 bg-slate-200 hidden sm:block" />

      {/* 뷰 토글 */}
      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
        {([['summary', '전체'], ['assignee', '담당자별']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 text-xs font-semibold transition
              ${view === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
