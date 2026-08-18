'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { eventSummary, eventTypeLabel, parseDealEvent, type DealEventType } from '@/lib/buildup-import/events'

export interface EventRow {
  id: string
  type: string
  quoteNo: string | null
  buildupQuoteId: number
  customerName: string | null
  warpCustomerId: string | null
  payloadJson: string
  status: string
  confirmedBy: string | null
  createdAt: string
}

export default function BuildupEventsClient({ events }: { events: EventRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function confirm(id: string) {
    if (busy) return
    setBusy(id)
    try {
      const res = await fetch(`/api/buildup-events/${id}`, { method: 'PATCH' })
      if (res.ok) router.refresh()
    } finally {
      setBusy(null)
    }
  }

  if (events.length === 0) {
    return <div className="text-sm text-slate-400 py-10 text-center">수신된 이벤트가 없습니다.</div>
  }

  const pending   = events.filter(e => e.status === 'pending')
  const confirmed = events.filter(e => e.status !== 'pending')

  const row = (e: EventRow) => {
    const payload = parseDealEvent(JSON.parse(e.payloadJson))
    const isContract = e.type === 'contract_completed'
    return (
      <div key={e.id} className="flex items-center gap-3 py-2.5 px-3 border-b border-slate-100 text-xs">
        <span className={`shrink-0 px-2 py-0.5 rounded-full font-semibold
          ${isContract ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>
          {eventTypeLabel(e.type as DealEventType)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-slate-700 truncate">{payload ? eventSummary(payload) : e.customerName ?? `견적 #${e.buildupQuoteId}`}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {new Date(e.createdAt).toLocaleString('ko-KR')}
            {e.status !== 'pending' && e.confirmedBy && <> · {e.confirmedBy} 확인</>}
            {e.status === 'pending' && !e.warpCustomerId && <> · <span className="text-amber-600">CRM 미연결 고객 — 「buildup에서 불러오기」로 먼저 연결하세요</span></>}
          </div>
        </div>
        {e.warpCustomerId && (
          <Link href={`/customers/${e.warpCustomerId}`}
            className="shrink-0 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition font-semibold">
            고객 열기
          </Link>
        )}
        {e.status === 'pending' && (
          <button onClick={() => void confirm(e.id)} disabled={busy === e.id}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition font-semibold disabled:opacity-50">
            {busy === e.id ? '처리 중…' : '확인 완료'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xs font-bold text-slate-600 mb-1">
          대기 <span className="text-amber-600">{pending.length}</span>건
        </h2>
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          {pending.length ? pending.map(row)
            : <div className="text-xs text-slate-400 py-4 text-center">대기 중인 이벤트가 없습니다.</div>}
        </div>
      </section>
      {confirmed.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-slate-400 mb-1">처리 완료</h2>
          <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50 opacity-70">
            {confirmed.map(row)}
          </div>
        </section>
      )}
    </div>
  )
}
