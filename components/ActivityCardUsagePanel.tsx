'use client'

import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import CardUsageForm, { useCardOptions, draftToBody } from './CardUsageForm'
import ReceiptLinks from './ReceiptLinks'
import { emptyDraft, draftFromUsage, validateDraft, STATUS_STYLE, type CardUsage, type CardUsageDraft } from '@/lib/cardUsage'

type Item = CardUsageDraft & { status?: string; cardLabel?: string | null; key: string }

// 활동에 연계된 카드/현금 사용내역 입력 패널
//  - activityId 있음(수정 화면): 즉시 API 저장
//  - activityId 없음(신규 화면): pending 목록에 보관 → 활동 저장 직후 상위에서 일괄 등록
export default function ActivityCardUsagePanel({
  activityId, defaultDate, myUserId, pending, setPending, onTotalChange,
}: {
  activityId?:   string
  defaultDate:   string
  myUserId?:     string
  pending:       CardUsageDraft[]
  setPending:    (fn: (prev: CardUsageDraft[]) => CardUsageDraft[]) => void
  onTotalChange: (total: number) => void
}) {
  const { corporateCards, personalCards, setPersonalCards, users } = useCardOptions()
  const [saved,   setSaved]   = useState<CardUsage[]>([])
  const [editing, setEditing] = useState<{ draft: CardUsageDraft; pendingIndex?: number } | null>(null)
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!activityId) return
    fetch(`/api/card-usages?activityId=${activityId}`).then(r => r.ok ? r.json() : []).then(setSaved).catch(() => {})
  }, [activityId])

  const items: Item[] = activityId
    ? saved.map(u => ({ ...draftFromUsage(u), status: u.status, cardLabel: u.cardLabel, key: u.id }))
    : pending.map((d, i) => ({ ...d, key: `p${i}` }))
  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  useEffect(() => { onTotalChange(total) }, [total]) // eslint-disable-line react-hooks/exhaustive-deps

  function cardText(i: Item) {
    if (i.cardLabel) return i.cardLabel
    if (i.payMethod === '법인카드') {
      const c = corporateCards.find(c => c.id === i.corporateCardId)
      return c ? `법인 ${c.holderName} ${c.cardNumberMasked}` : '법인카드'
    }
    if (i.payMethod === '개인카드') {
      const c = personalCards.find(c => c.id === i.personalCardId)
      return c ? `개인 ${c.alias}${c.last4 ? ` ••••${c.last4}` : ''}` : '개인카드'
    }
    return '현금'
  }

  async function commit() {
    if (!editing) return
    const msg = validateDraft(editing.draft)
    if (msg) { setError(msg); return }
    setError('')
    if (!activityId) {
      const idx = editing.pendingIndex
      setPending(prev => idx == null ? [...prev, editing.draft] : prev.map((d, i) => i === idx ? editing.draft : d))
      setEditing(null)
      return
    }
    setBusy(true)
    try {
      const id  = editing.draft.id
      const res = await fetch(id ? `/api/card-usages/${id}` : '/api/card-usages', {
        method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftToBody(editing.draft, activityId)),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '저장 실패'); return }
      setSaved(prev => id ? prev.map(u => u.id === id ? data : u) : [...prev, data])
      setEditing(null)
    } finally { setBusy(false) }
  }

  async function remove(item: Item, index: number) {
    if (!activityId) { setPending(prev => prev.filter((_, i) => i !== index)); return }
    if (!confirm(`${item.merchant} 내역을 삭제하시겠습니까?`)) return
    const res = await fetch(`/api/card-usages/${item.id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? '삭제 실패'); return }
    setSaved(prev => prev.filter(u => u.id !== item.id))
  }

  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={it.key} className="flex items-center gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">{it.category}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 truncate">{it.merchant}</p>
            <p className="text-[11px] text-slate-500 truncate">
              {it.date.slice(5).replace('-', '/')} · {cardText(it)}
              {it.attendees ? ` · 참석: ${it.attendees}` : ''}{it.description ? ` · ${it.description}` : ''}
              <ReceiptLinks receiptUrl={it.receiptUrl} />
            </p>
          </div>
          {it.status && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[it.status] ?? 'bg-slate-100 text-slate-500'}`}>{it.status}</span>
          )}
          <span className="text-sm font-bold text-slate-800 shrink-0">{Number(it.amount).toLocaleString('ko-KR')}원</span>
          {it.status !== '승인' && (
            <div className="flex gap-0.5 shrink-0">
              <button type="button" title="수정"
                onClick={() => { setEditing({ draft: { ...it }, pendingIndex: activityId ? undefined : idx }); setError('') }}
                className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50"><Pencil size={12} /></button>
              <button type="button" title="삭제" onClick={() => remove(it, idx)}
                className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={12} /></button>
            </div>
          )}
        </div>
      ))}

      {editing ? (
        <div className="rounded-xl border border-amber-200 bg-white p-3">
          <CardUsageForm
            draft={editing.draft}
            onChange={p => setEditing(e => e && ({ ...e, draft: { ...e.draft, ...p } }))}
            corporateCards={corporateCards}
            personalCards={personalCards}
            onPersonalCardAdded={c => setPersonalCards(prev => [...prev, c])}
            users={users}
            myUserId={myUserId}
          />
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" onClick={() => { setEditing(null); setError('') }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50">취소</button>
            <button type="button" onClick={commit} disabled={busy}
              className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50">
              {busy ? '저장 중…' : editing.draft.id || editing.pendingIndex != null ? '수정' : '추가'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button"
          onClick={() => { setEditing({ draft: emptyDraft(items[items.length - 1]?.date ?? defaultDate) }); setError('') }}
          className="w-full flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-amber-300 text-xs font-semibold text-amber-700 hover:bg-amber-50">
          <Plus size={12} /> 사용내역 추가 (법인카드 · 개인카드 · 현금)
        </button>
      )}

      {items.length > 0 && (
        <div className="flex justify-end items-center gap-2 pt-1">
          <span className="text-xs text-slate-500">합계</span>
          <span className="text-sm font-bold text-amber-700">{total.toLocaleString('ko-KR')}원</span>
        </div>
      )}
      {!activityId && items.length > 0 && (
        <p className="text-[11px] text-slate-400">💡 활동을 저장하면 사용내역이 함께 등록됩니다. 업무공간 › 법인카드사용에서도 확인할 수 있습니다.</p>
      )}
    </div>
  )
}
