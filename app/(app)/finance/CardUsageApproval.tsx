'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Download, X } from 'lucide-react'
import { CARD_USAGE_CATEGORIES, STATUS_STYLE, type CardUsage } from '@/lib/cardUsage'
import ReceiptLinks from '@/components/ReceiptLinks'

const FILTERS = ['', '신청', '승인', '반려'] as const

function won(n: number) { return n.toLocaleString('ko-KR') + '원' }

// 카드/현금 사용내역 결재 + 기간 집계 (재무/회계)
export default function CardUsageApproval({ initialFrom, initialTo }: { initialFrom: string; initialTo: string }) {
  const [from, setFrom]     = useState(initialFrom)
  const [to, setTo]         = useState(initialTo)
  const [status, setStatus] = useState<typeof FILTERS[number]>('신청')
  const [rows, setRows]     = useState<CardUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ scope: 'all', from, to, ...(status ? { status } : {}) })
      const res = await fetch(`/api/card-usages?${qs}`)
      setRows(res.ok ? await res.json() : [])
    } finally { setLoading(false) }
  }, [from, to, status])
  useEffect(() => { load() }, [load])

  async function decide(id: string, next: '승인' | '반려') {
    const approverNote = next === '반려' ? (prompt('반려 사유를 입력해주세요 (선택)') ?? '') : ''
    setProcessingId(id)
    try {
      const res = await fetch(`/api/card-usages/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, approverNote }),
      })
      if (res.ok) {
        const updated = await res.json()
        setRows(prev => status === '' ? prev.map(r => r.id === id ? { ...r, ...updated } : r) : prev.filter(r => r.id !== id))
      }
    } finally { setProcessingId(null) }
  }

  const total = rows.reduce((s, r) => s + r.amount, 0)
  const byCategory = CARD_USAGE_CATEGORIES.map(c => ({ name: c, total: rows.filter(r => r.category === c).reduce((s, r) => s + r.amount, 0) }))
    .filter(c => c.total > 0)
  const byCard = Object.values(rows.reduce<Record<string, { name: string; total: number; count: number }>>((acc, r) => {
    const k = r.cardLabel ?? r.payMethod
    acc[k] ??= { name: k, total: 0, count: 0 }
    acc[k].total += r.amount; acc[k].count += 1
    return acc
  }, {})).sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">시작일</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">종료일</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map(f => (
            <button key={f || 'all'} onClick={() => setStatus(f)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition ${status === f ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
              {f || '전체'}
            </button>
          ))}
        </div>
        <p className="ml-auto text-sm text-slate-500">{rows.length}건 · <b className="text-slate-800">{won(total)}</b></p>
        <a href={`/api/card-usages/export?${new URLSearchParams({ from, to, ...(status ? { status } : {}) })}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition">
          <Download size={13} /> 엑셀 다운로드
        </a>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-sm font-bold text-slate-700 mb-3">해당업무별</p>
            <div className="space-y-1.5">
              {byCategory.map(c => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{c.name}</span>
                  <span className="tabular-nums font-semibold text-slate-700">{won(c.total)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-sm font-bold text-slate-700 mb-3">카드별</p>
            <div className="space-y-1.5">
              {byCard.map(c => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 truncate">{c.name}</span>
                  <span className="tabular-nums font-semibold text-slate-700 shrink-0">{won(c.total)} <span className="text-xs text-slate-400">({c.count}건)</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <p className="text-xs text-slate-400 text-center py-10">불러오는 중...</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-10">해당하는 사용내역이 없습니다.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map(r => (
              <div key={r.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{r.category}</span>
                    <span className="text-sm font-semibold text-slate-800">{r.merchant}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[r.status] ?? 'bg-slate-100 text-slate-500'}`}>{r.status}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{r.cardLabel ?? r.payMethod}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {r.date} · {r.userName ?? '알 수 없음'}
                    {r.attendees ? ` · 참석: ${r.attendees}` : ''}
                    {r.description ? ` · ${r.description}` : ''}
                    <ReceiptLinks receiptUrl={r.receiptUrl} />
                  </p>
                  {r.activityId ? (
                    <Link href={`/notes/${r.activityId}/edit`} className="text-[11px] text-indigo-500 hover:underline">활동: {r.activityTitle ?? '연계 활동'}</Link>
                  ) : (
                    <span className="text-[11px] text-slate-300">단독 사용</span>
                  )}
                  {r.status === '반려' && r.approverNote && (
                    <p className="text-xs text-red-500 mt-0.5">반려사유: {r.approverNote}</p>
                  )}
                </div>
                <p className="text-sm font-bold text-slate-800 tabular-nums shrink-0">{won(r.amount)}</p>
                {r.status === '신청' && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => decide(r.id, '승인')} disabled={processingId === r.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition">
                      <Check size={11} /> 승인
                    </button>
                    <button onClick={() => decide(r.id, '반려')} disabled={processingId === r.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition">
                      <X size={11} /> 반려
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
