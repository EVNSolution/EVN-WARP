'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CreditCard, X, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import CardUsageForm, { useCardOptions, draftToBody } from './CardUsageForm'
import { emptyDraft, draftFromUsage, validateDraft, STATUS_STYLE, type CardUsage, type CardUsageDraft } from '@/lib/cardUsage'

function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` }
}
function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function CardUsageModal({
  todayStr, myUserId, canViewAll, onClose,
}: {
  todayStr:   string
  myUserId?:  string
  canViewAll: boolean
  onClose:    () => void
}) {
  const { corporateCards, personalCards, setPersonalCards, users } = useCardOptions()
  const [draft,  setDraft]  = useState<CardUsageDraft>(() => emptyDraft(todayStr))
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const [month, setMonth] = useState(todayStr.slice(0, 7))
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [rows,  setRows]  = useState<CardUsage[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = monthRange(month)
    try {
      const res = await fetch(`/api/card-usages?from=${from}&to=${to}${scope === 'all' ? '&scope=all' : ''}`)
      setRows(res.ok ? await res.json() : [])
    } finally { setLoading(false) }
  }, [month, scope])
  useEffect(() => { load() }, [load])

  async function save() {
    const msg = validateDraft(draft)
    if (msg) { setError(msg); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(draft.id ? `/api/card-usages/${draft.id}` : '/api/card-usages', {
        method: draft.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftToBody(draft)),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '저장 실패'); return }
      setDraft(emptyDraft(draft.date))
      if (draft.date.slice(0, 7) !== month) setMonth(draft.date.slice(0, 7))
      else load()
    } finally { setSaving(false) }
  }

  async function remove(u: CardUsage) {
    if (!confirm(`${u.date} ${u.merchant} 내역을 삭제하시겠습니까?`)) return
    const res = await fetch(`/api/card-usages/${u.id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? '삭제 실패'); return }
    if (draft.id === u.id) setDraft(emptyDraft(todayStr))
    load()
  }

  const total = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 bg-amber-50 border-b border-amber-100">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-amber-700" />
            <h2 className="text-sm font-bold text-amber-800">법인카드사용</h2>
            <span className="text-[11px] text-amber-700/70">활동과 연계되지 않은 사용 등록 · 활동 중 사용분은 활동추가 › 비용에서 입력</span>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/70 hover:bg-white transition-colors">
            <X size={14} className="text-slate-500" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row min-h-0 flex-1 overflow-y-auto md:overflow-hidden">
          {/* 입력 */}
          <div className="md:w-[380px] shrink-0 p-5 border-b md:border-b-0 md:border-r border-slate-100 md:overflow-y-auto">
            <p className="text-xs font-bold text-slate-700 mb-3">{draft.id ? '내역 수정' : '새 사용 등록'}</p>
            <CardUsageForm
              draft={draft}
              onChange={p => setDraft(d => ({ ...d, ...p }))}
              corporateCards={corporateCards}
              personalCards={personalCards}
              onPersonalCardAdded={c => setPersonalCards(prev => [...prev, c])}
              users={users}
              myUserId={myUserId}
            />
            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
            <div className="flex gap-2 mt-4">
              {draft.id && (
                <button type="button" onClick={() => { setDraft(emptyDraft(todayStr)); setError('') }}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">취소</button>
              )}
              <button type="button" onClick={save} disabled={saving}
                className="flex-1 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">
                {saving ? '저장 중…' : draft.id ? '수정 저장' : '등록'}
              </button>
            </div>
          </div>

          {/* 목록 */}
          <div className="flex-1 min-w-0 flex flex-col md:overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <button onClick={() => setMonth(m => shiftMonth(m, -1))} className="p-1 rounded hover:bg-slate-100"><ChevronLeft size={14} /></button>
              <span className="text-sm font-bold text-slate-700 w-20 text-center">{month.replace('-', '.')}</span>
              <button onClick={() => setMonth(m => shiftMonth(m, 1))} className="p-1 rounded hover:bg-slate-100"><ChevronRight size={14} /></button>
              {canViewAll && (
                <div className="flex ml-2 rounded-lg border border-slate-200 overflow-hidden">
                  {(['mine', 'all'] as const).map(s => (
                    <button key={s} onClick={() => setScope(s)}
                      className={`px-2.5 py-1 text-[11px] font-semibold ${scope === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-500'}`}>
                      {s === 'mine' ? '내 내역' : '전체'}
                    </button>
                  ))}
                </div>
              )}
              <span className="ml-auto text-xs text-slate-500">{rows.length}건 · <b className="text-amber-700">{total.toLocaleString('ko-KR')}원</b></span>
            </div>
            <div className="flex-1 md:overflow-y-auto px-5 py-3 space-y-2">
              {loading ? (
                <p className="text-xs text-slate-400 text-center py-10">불러오는 중...</p>
              ) : rows.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">이 달의 사용내역이 없습니다.</p>
              ) : rows.map(u => {
                const editable = u.userId === myUserId && u.status !== '승인'
                return (
                  <div key={u.id} className={`rounded-lg border px-3 py-2.5 ${draft.id === u.id ? 'border-amber-300 bg-amber-50/50' : 'border-slate-100'}`}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-slate-400">{u.date.slice(5).replace('-', '/')}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{u.category}</span>
                          <span className="text-sm font-semibold text-slate-800 truncate">{u.merchant}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[u.status] ?? 'bg-slate-100 text-slate-500'}`}>{u.status}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {u.cardLabel}
                          {scope === 'all' && u.userName ? ` · ${u.userName}` : ''}
                          {u.attendees ? ` · 참석: ${u.attendees}` : ''}
                          {u.description ? ` · ${u.description}` : ''}
                        </p>
                        {u.activityId && (
                          <Link href={`/notes/${u.activityId}/edit`} className="inline-block mt-0.5 text-[10px] text-indigo-500 hover:underline">
                            활동: {u.activityTitle ?? '연계 활동'}
                          </Link>
                        )}
                        {u.status === '반려' && u.approverNote && (
                          <p className="text-[11px] text-red-500 mt-0.5">반려사유: {u.approverNote}</p>
                        )}
                      </div>
                      <span className="text-sm font-bold text-slate-800 shrink-0">{u.amount.toLocaleString('ko-KR')}원</span>
                      {editable && (
                        <div className="flex gap-0.5 shrink-0">
                          <button onClick={() => { setDraft(draftFromUsage(u)); setError('') }} title="수정"
                            className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50"><Pencil size={12} /></button>
                          <button onClick={() => remove(u)} title="삭제"
                            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={12} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
