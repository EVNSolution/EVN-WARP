'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

const PERIODS = [
  { label: '이번 주',  key: 'week' },
  { label: '이번 달',  key: 'month' },
  { label: '올해',     key: 'year' },
  { label: '직접 입력', key: 'custom' },
]

interface Props { from: string; to: string; period: string }

export default function PeriodSelector({ from, to, period }: Props) {
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

  function applyCustom() {
    go('custom', customFrom, customTo)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PERIODS.map(p => (
        <button
          key={p.key}
          onClick={() => { if (p.key !== 'custom') go(p.key) }}
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
  )
}
