'use client'

import { useEffect, useRef, useState } from 'react'
import { Paperclip, Plus, X } from 'lucide-react'
import { CARD_USAGE_CATEGORIES, PAY_METHODS, RECEIPT_PAY_METHODS, type CardUsageCategory, type CardUsageDraft } from '@/lib/cardUsage'

export type CorporateCardOption = { id: string; holderName: string; cardNumberMasked: string; userId: string | null; userName: string | null }
export type PersonalCardOption  = { id: string; alias: string; last4: string | null }
type UserOption = { id: string; name: string | null; employmentType?: string | null }

// 법인카드·내 개인카드·사용자 목록 로드
export function useCardOptions() {
  const [corporateCards, setCorporateCards] = useState<CorporateCardOption[]>([])
  const [personalCards,  setPersonalCards]  = useState<PersonalCardOption[]>([])
  const [users,          setUsers]          = useState<UserOption[]>([])
  useEffect(() => {
    fetch('/api/corporate-cards').then(r => r.json()).then(setCorporateCards).catch(() => {})
    fetch('/api/personal-cards').then(r => r.json()).then(setPersonalCards).catch(() => {})
    fetch('/api/users').then(r => r.json()).then(setUsers).catch(() => {})
  }, [])
  return { corporateCards, personalCards, setPersonalCards, users }
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300'

export default function CardUsageForm({
  draft, onChange, corporateCards, personalCards, onPersonalCardAdded, users, myUserId,
}: {
  draft:               CardUsageDraft
  onChange:            (patch: Partial<CardUsageDraft>) => void
  corporateCards:      CorporateCardOption[]
  personalCards:       PersonalCardOption[]
  onPersonalCardAdded: (card: PersonalCardOption) => void
  users:               UserOption[]
  myUserId?:           string
}) {
  const [addingCard, setAddingCard] = useState(false)
  const [newAlias,   setNewAlias]   = useState('')
  const [newLast4,   setNewLast4]   = useState('')
  const [cardError,  setCardError]  = useState('')
  const [attendeePick, setAttendeePick] = useState('')
  const [uploading,    setUploading]    = useState(false)
  const [receiptError, setReceiptError] = useState('')
  const receiptInputRef = useRef<HTMLInputElement>(null)
  const receipts = draft.receiptUrl ? draft.receiptUrl.split('|').filter(Boolean) : []

  // 영수증 업로드 — 금액이 비어 있으면 OCR 금액으로 채움
  async function uploadReceipt(file: File) {
    setUploading(true); setReceiptError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/card-usages/receipt', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setReceiptError(data.error ?? '업로드 실패'); return }
      onChange({
        receiptUrl: [...receipts, data.url].join('|'),
        ...(!draft.amount && data.amount ? { amount: String(Math.round(data.amount)) } : {}),
      })
    } catch { setReceiptError('업로드 실패') }
    finally { setUploading(false) }
  }

  // 법인카드 선택 시 본인 배정 카드를 기본값으로
  useEffect(() => {
    if (draft.payMethod !== '법인카드' || draft.corporateCardId || !myUserId) return
    const mine = corporateCards.find(c => c.userId === myUserId)
    if (mine) onChange({ corporateCardId: mine.id })
  }, [draft.payMethod, draft.corporateCardId, corporateCards, myUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 개인카드 선택 시 카드가 하나뿐이면 자동 선택
  useEffect(() => {
    if (draft.payMethod !== '개인카드' || draft.personalCardId || personalCards.length !== 1) return
    onChange({ personalCardId: personalCards[0].id })
  }, [draft.payMethod, draft.personalCardId, personalCards]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addPersonalCard() {
    if (!newAlias.trim()) { setCardError('카드 별칭을 입력해주세요.'); return }
    const res  = await fetch('/api/personal-cards', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: newAlias, last4: newLast4 }),
    })
    const data = await res.json()
    if (!res.ok) { setCardError(data.error ?? '등록 실패'); return }
    onPersonalCardAdded(data)
    onChange({ personalCardId: data.id })
    setAddingCard(false); setNewAlias(''); setNewLast4(''); setCardError('')
  }

  const attendeeList = draft.attendees.split(',').map(s => s.trim()).filter(Boolean)
  function addAttendee(name: string) {
    const n = name.trim()
    if (!n || attendeeList.includes(n)) return
    onChange({ attendees: [...attendeeList, n].join(', ') })
  }

  return (
    <div className="space-y-2.5">
      {/* 일자 · 금액 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">일자</label>
          <input type="date" value={draft.date} onChange={e => onChange({ date: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">금액 (원)</label>
          <input type="text" inputMode="numeric"
            value={draft.amount ? Number(draft.amount).toLocaleString('ko-KR') : ''}
            onChange={e => { const raw = e.target.value.replace(/,/g, ''); if (raw === '' || /^\d+$/.test(raw)) onChange({ amount: raw }) }}
            placeholder="0" className={`${inputCls} text-right font-semibold`} />
        </div>
      </div>

      {/* 사용카드 */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1">사용카드</label>
        <div className="flex gap-1.5 mb-1.5">
          {PAY_METHODS.map(m => (
            <button key={m} type="button" onClick={() => onChange({ payMethod: m })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                draft.payMethod === m ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
              }`}>
              {m}
            </button>
          ))}
        </div>
        {draft.payMethod === '법인카드' && (
          <select value={draft.corporateCardId} onChange={e => onChange({ corporateCardId: e.target.value })} className={inputCls}>
            <option value="">법인카드 선택</option>
            {corporateCards.map(c => (
              <option key={c.id} value={c.id}>{c.holderName} {c.cardNumberMasked}{c.userName ? ` · ${c.userName}` : ''}</option>
            ))}
          </select>
        )}
        {draft.payMethod === '개인카드' && (
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <select value={draft.personalCardId} onChange={e => onChange({ personalCardId: e.target.value })} className={inputCls}>
                <option value="">{personalCards.length ? '내 개인카드 선택' : '등록된 개인카드가 없습니다'}</option>
                {personalCards.map(c => (
                  <option key={c.id} value={c.id}>{c.alias}{c.last4 ? ` ••••${c.last4}` : ''}</option>
                ))}
              </select>
              <button type="button" onClick={() => setAddingCard(v => !v)}
                className="shrink-0 flex items-center gap-1 px-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100">
                <Plus size={12} /> 개인카드 추가
              </button>
            </div>
            {addingCard && (
              <div className="flex gap-1.5 items-center p-2 rounded-lg bg-amber-50/60 border border-amber-100">
                <input value={newAlias} onChange={e => setNewAlias(e.target.value)} placeholder="별칭 (예: 신한 개인)" className={inputCls} />
                <input value={newLast4} onChange={e => setNewLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric" placeholder="뒤 4자리" className={`${inputCls} w-24 shrink-0`} />
                <button type="button" onClick={addPersonalCard}
                  className="shrink-0 px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700">등록</button>
              </div>
            )}
            {cardError && <p className="text-[11px] text-red-500">{cardError}</p>}
          </div>
        )}
      </div>

      {/* 해당업무 */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1">해당업무</label>
        <select value={draft.category} onChange={e => onChange({ category: e.target.value as CardUsageCategory })} className={inputCls}>
          {CARD_USAGE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* 사용처 */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1">사용처</label>
        <input value={draft.merchant} onChange={e => onChange({ merchant: e.target.value })} placeholder="상호명" className={inputCls} />
      </div>

      {/* 참석자 */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1">참석자</label>
        {attendeeList.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {attendeeList.map(n => (
              <span key={n} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-xs text-slate-700">
                {n}
                <button type="button" onClick={() => onChange({ attendees: attendeeList.filter(x => x !== n).join(', ') })}
                  className="text-slate-400 hover:text-red-500"><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <select value="" onChange={e => addAttendee(e.target.value)} className={inputCls}>
            <option value="">사내 인원 선택</option>
            {users.filter(u => u.name && !attendeeList.includes(u.name)).map(u => (
              <option key={u.id} value={u.name!}>{u.name}</option>
            ))}
          </select>
          <input value={attendeePick} onChange={e => setAttendeePick(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAttendee(attendeePick); setAttendeePick('') } }}
            placeholder="외부 참석자 (Enter)" className={inputCls} />
        </div>
      </div>

      {/* 사용내용 */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1">사용내용</label>
        <input value={draft.description} onChange={e => onChange({ description: e.target.value })}
          placeholder="예: 고객사 미팅 후 식사" className={inputCls} />
      </div>

      {/* 영수증 — 개인카드·현금만 */}
      {RECEIPT_PAY_METHODS.has(draft.payMethod) && (
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">영수증</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {receipts.map((url, i) => (
              <span key={url} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs">
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">📄 영수증 {i + 1}</a>
                <button type="button" onClick={() => onChange({ receiptUrl: receipts.filter(u => u !== url).join('|') })}
                  className="text-slate-300 hover:text-red-500"><X size={10} /></button>
              </span>
            ))}
            <button type="button" onClick={() => receiptInputRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:border-amber-400 hover:text-amber-700 disabled:opacity-50">
              <Paperclip size={12} /> {uploading ? '업로드 중…' : '영수증 첨부'}
            </button>
          </div>
          <input ref={receiptInputRef} type="file" accept="image/*,application/pdf" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadReceipt(f); e.target.value = '' }} />
          {receiptError && <p className="text-[11px] text-red-500 mt-1">{receiptError}</p>}
          <p className="text-[10px] text-slate-400 mt-1">사진을 올리면 금액이 비어 있을 때 자동으로 채워집니다.</p>
        </div>
      )}
    </div>
  )
}

// 저장용 요청 본문
export function draftToBody(d: CardUsageDraft, activityId?: string | null) {
  return {
    date: d.date, payMethod: d.payMethod,
    corporateCardId: d.payMethod === '법인카드' ? d.corporateCardId : null,
    personalCardId:  d.payMethod === '개인카드' ? d.personalCardId  : null,
    merchant: d.merchant, attendees: d.attendees, category: d.category,
    description: d.description, amount: Number(d.amount),
    receiptUrl: RECEIPT_PAY_METHODS.has(d.payMethod) ? d.receiptUrl : null,
    ...(activityId !== undefined ? { activityId } : {}),
  }
}
