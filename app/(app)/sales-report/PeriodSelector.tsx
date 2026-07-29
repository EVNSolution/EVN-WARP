'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

const PRESETS = [
  { label: '오늘',    key: 'today' },
  { label: '이번 주', key: 'week' },
  { label: '이번 달', key: 'month' },
  { label: '올해',    key: 'year' },
]

interface Props { from: string; to: string; period: string; view: string; mode: string }

export default function PeriodSelector({ from, to, view, mode }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [rangeFrom, setRangeFrom] = useState(from)
  const [rangeTo,   setRangeTo]   = useState(to)

  function go(f: string, t: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', 'custom')
    params.set('from', f)
    params.set('to', t)
    router.push(`/sales-report?${params.toString()}`)
  }

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`/sales-report?${params.toString()}`)
  }

  function applyPreset(presetKey: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', presetKey)
    params.delete('from')
    params.delete('to')
    router.push(`/sales-report?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 w-full">
      {/* 좌측: 기간 지정 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date" value={rangeFrom}
          onChange={e => setRangeFrom(e.target.value)}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-700"
        />
        <span className="text-xs text-slate-400">~</span>
        <input
          type="date" value={rangeTo}
          onChange={e => setRangeTo(e.target.value)}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-700"
        />
        <button
          onClick={() => go(rangeFrom, rangeTo)}
          className="px-3 py-1.5 bg-slate-700 text-white text-xs font-semibold rounded-lg hover:bg-slate-900 transition"
        >
          조회
        </button>
        <div className="flex items-center gap-2 ml-1 text-[11px] text-slate-400">
          {PRESETS.map((p, i) => (
            <span key={p.key} className="flex items-center gap-2">
              {i > 0 && <span className="text-slate-200">·</span>}
              <button onClick={() => applyPreset(p.key)} className="hover:text-indigo-600 hover:underline transition">
                {p.label}
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* 우측: 뷰 토글 */}
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
          {([['actual', '실적', 'bg-indigo-600'], ['plan', '계획', 'bg-amber-500']] as const).map(([m, label, activeBg]) => (
            <button
              key={m}
              onClick={() => setParam('mode', m)}
              className={`px-3 py-1.5 text-xs font-semibold transition
                ${mode === m ? `${activeBg} text-white` : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
          {([['summary', '전체'], ['assignee', '영업담당자별']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setParam('view', v)}
              className={`px-3 py-1.5 text-xs font-semibold transition
                ${view === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
