'use client'

import { useState, useEffect, useRef } from 'react'
import { PipelineDeal } from './PipelineView'
import { formatPhone } from '@/lib/format'
import AgentPicker from './AgentPicker'
import AssigneePicker from './AssigneePicker'

/* ── 리드 발굴경로 (고객 유입경로와 별도 관리) ── */
const LEAD_SOURCES = ['소개', '자체발굴', '인바운드', 'SNS', '전시회', '기타', '소개인']
const CUST_SOURCES = ['소개', '온라인', '전시장/이벤트', '직접방문', '기타']

type Segment = 'B2C' | 'B2B'
type CustomerHit = {
  id: string
  name: string
  phone: string | null
  companyName: string | null
  soleBusinessName: string | null
  customerSegment: string | null
  status: string
}
type Step = 'search' | 'create' | 'lead'

interface Props {
  onClose: () => void
  onCreated: (deal: PipelineDeal) => void
}

export default function NewDealModal({ onClose, onCreated }: Props) {
  const [step,   setStep]   = useState<Step>('search')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  /* ── Step 1: 고객 검색 ── */
  const [query,        setQuery]        = useState('')
  const [searchMode,   setSearchMode]   = useState<'name' | 'phone' | 'company'>('name')
  const [searchResult, setSearchResult] = useState<CustomerHit[]>([])
  const [searching,    setSearching]    = useState(false)
  const [didSearch,    setDidSearch]    = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Step 1b: 신규 고객 등록 ── */
  const [newName,    setNewName]    = useState('')
  const [newPhone,   setNewPhone]   = useState('')
  const [newSegment, setNewSegment] = useState<Segment>('B2C')
  const [newSource,  setNewSource]  = useState('')

  /* ── 선택된 고객 ── */
  const [customer, setCustomer] = useState<CustomerHit | null>(null)

  /* ── Step 2: 리드 정보 ── */
  const [dealSource,       setDealSource]       = useState('')
  const [agentValue,       setAgentValue]       = useState<{ id: string; name: string } | null>(null)
  const [assignee,         setAssignee]         = useState('')
  const [memo,             setMemo]             = useState('')
  const [intentChecked,    setIntentChecked]    = useState(false)
  const [intentNote,       setIntentNote]       = useState('')
  const [showNewAgent,     setShowNewAgent]     = useState(false)
  const [newAgentName,     setNewAgentName]     = useState('')
  const [newAgentPhone,    setNewAgentPhone]    = useState('')
  const [newAgentCompany,  setNewAgentCompany]  = useState('')
  const [newAgentType,     setNewAgentType]     = useState<'내부' | '외부'>('외부')
  const [savingAgent,      setSavingAgent]      = useState(false)

  /* 고객 검색 디바운스 */
  useEffect(() => {
    if (step !== 'search') return
    const q = query.trim()
    if (!q) { setSearchResult([]); setDidSearch(false); return }
    if (searchMode === 'phone' && q.replace(/\D/g, '').length < 4) {
      setSearchResult([]); setDidSearch(false); return
    }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res  = await fetch(`/api/customers?q=${encodeURIComponent(q)}&mode=${searchMode}`)
        const list: CustomerHit[] = await res.json()
        setSearchResult(list.slice(0, 6))
        setDidSearch(true)
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [query, searchMode, step])

  const selectCustomer = (c: CustomerHit) => {
    setCustomer(c)
    setStep('lead')
  }

  const switchMode = (mode: 'name' | 'phone' | 'company') => {
    setSearchMode(mode)
    setQuery('')
    setSearchResult([])
    setDidSearch(false)
  }

  const highlightPhone = (phone: string | null, q: string) => {
    if (!phone || !q) return phone ?? '—'
    const match = phone.match(new RegExp(q.replace(/\D/g, '').split('').join('-?')))
    if (!match || match.index === undefined) return phone
    const s = match.index, e = s + match[0].length
    return (
      <>
        {phone.slice(0, s)}
        <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5 not-italic font-bold">{phone.slice(s, e)}</mark>
        {phone.slice(e)}
      </>
    )
  }

  /* 신규 고객 등록 */
  const handleCreateCustomer = async () => {
    if (!newName.trim()) { setError('이름은 필수입니다.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:            newName.trim(),
          phone:           newPhone  || null,
          customerSegment: newSegment,
          source:          newSource || null,
          collectedAt:     new Date().toISOString(),
        }),
      })
      if (!res.ok) { const j = await res.json(); setError(j.error ?? '등록 실패'); setSaving(false); return }
      const c = await res.json()
      setCustomer({ id: c.id, name: c.name, phone: c.phone, companyName: c.companyName ?? null, soleBusinessName: c.soleBusinessName ?? null, customerSegment: c.customerSegment, status: c.status })
      setStep('lead')
    } catch {
      setError('네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  /* 리드 등록 */
  const handleCreateLead = async () => {
    if (!customer) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId:      customer.id,
          name:            customer.name,
          phone:           customer.phone           || null,
          customerSegment: customer.customerSegment || null,
          companyName:     customer.companyName     || null,
          source:          dealSource               || null,
          agentId:         agentValue?.id           || null,
          assignee:        assignee                 || null,
          memo:            memo                     || null,
          stageCode:       '1-1',
          salesStatus:     '진행중',
          collectedAt:     new Date().toISOString(),
          checklistJson:   JSON.stringify({
            ...(intentChecked ? { '1-1-0': true } : {}),
            ...(intentNote.trim() ? { '1-1-0-note': intentNote.trim() } : {}),
          }),
        }),
      })
      if (!res.ok) { const j = await res.json(); setError(j.error ?? '등록 실패'); setSaving(false); return }
      const deal = await res.json()
      onCreated({
        id:              deal.id,
        stageCode:       deal.stageCode       ?? '1-1',
        salesStatus:     deal.salesStatus     ?? '진행중',
        name:            deal.name,
        phone:           deal.phone,
        source:          deal.source,
        collectedAt:     deal.collectedAt,
        assignee:        deal.assignee,
        memo:            deal.memo,
        checklistJson:   null,
        customerSegment: deal.customerSegment ?? customer.customerSegment,
        companyName:     deal.companyName,
      })
      onClose()
    } catch {
      setError('네트워크 오류')
      setSaving(false)
    }
  }

  /* 신규 Agent 등록 */
  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return
    setSavingAgent(true)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    newAgentName.trim(),
          phone:   newAgentPhone   || null,
          company: newAgentCompany || null,
          type:    newAgentType,
        }),
      })
      if (res.ok || res.status === 409) {
        const data = await res.json()
        const agent = res.status === 409 ? data.agent : data
        setAgentValue({ id: agent.id, name: agent.name })
        setShowNewAgent(false)
        setNewAgentName(''); setNewAgentPhone(''); setNewAgentCompany('')
      }
    } finally {
      setSavingAgent(false)
    }
  }

  const stepMeta = {
    search: { badge: '1단계', title: '고객 찾기',     sub: '먼저 고객을 검색하세요' },
    create: { badge: '1-1단계', title: '신규 고객 등록', sub: '리드 추가 전 고객 정보를 먼저 저장합니다' },
    lead:   { badge: '2단계', title: '리드 정보 입력', sub: '선택된 고객으로 영업 기회를 생성합니다' },
  }[step]

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* 헤더 */}
        <div className="shrink-0 px-6 pt-6 pb-5 relative"
          style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}>
          <button onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition text-xl leading-none">
            ×
          </button>

          {/* 단계 인디케이터 */}
          <div className="flex items-center gap-1.5 mb-3">
            {(['search', 'lead'] as Step[]).map((s, i) => {
              const active = step === s || (step === 'create' && s === 'search')
              const done   = step === 'lead' && s === 'search'
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition
                    ${done   ? 'bg-green-400 text-white' :
                      active ? 'bg-white text-slate-800' : 'bg-white/15 text-white/40'}`}>
                    {done ? '✓' : i + 1}
                  </div>
                  {i === 0 && <div className="w-8 h-px bg-white/20" />}
                </div>
              )
            })}
          </div>

          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-0.5">{stepMeta.badge}</p>
          <p className="text-white font-bold text-lg">{stepMeta.title}</p>
          <p className="text-white/40 text-xs mt-0.5">{stepMeta.sub}</p>
        </div>

        {/* ═══════ STEP 1: 고객 검색 ═══════ */}
        {step === 'search' && (
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

            {/* 검색 모드 탭 */}
            <div className="flex border border-slate-200 rounded-xl overflow-hidden">
              {(['name', 'phone', 'company'] as const).map(m => (
                <button key={m} onClick={() => switchMode(m)}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors
                    ${searchMode === m ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                  {m === 'name' ? '이름' : m === 'phone' ? '전화번호' : '법인명'}
                </button>
              ))}
            </div>

            {/* 검색 입력 */}
            <div className="relative">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={searchMode === 'phone' ? '뒷자리 4자리 이상 (숫자만)' : searchMode === 'company' ? '법인명 입력...' : '고객 이름 입력...'}
                inputMode={searchMode === 'phone' ? 'numeric' : 'text'}
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              )}
            </div>

            {/* 검색 결과 */}
            {searchResult.length > 0 && (
              <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                {searchResult.map(c => (
                  <button key={c.id} onClick={() => selectCustomer(c)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {searchMode === 'phone'
                          ? highlightPhone(c.phone, query)
                          : searchMode === 'company'
                            ? (c.phone ?? '연락처 없음')
                            : (() => {
                                const bizName = c.companyName ?? c.soleBusinessName
                                return (bizName ? `${bizName} · ` : '') + (c.phone ?? '연락처 없음')
                              })()}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 shrink-0">선택 →</span>
                  </button>
                ))}
              </div>
            )}

            {/* 결과 없음 */}
            {didSearch && !searching && searchResult.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-amber-800 mb-1">일치하는 고객이 없습니다</p>
                <p className="text-xs text-amber-600">신규 고객을 먼저 등록한 후 리드를 추가해 주세요</p>
              </div>
            )}

            {/* 검색 전 안내 */}
            {!query && (
              <div className="text-center py-8 text-slate-400">
                <p className="text-4xl mb-3">🔍</p>
                <p className="text-sm font-medium text-slate-500">고객을 먼저 검색하세요</p>
                <p className="text-xs mt-1">이름 또는 전화번호로 기존 고객을 찾을 수 있습니다</p>
              </div>
            )}

            {/* 신규 등록 버튼 */}
            <div className="mt-auto pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center mb-2">검색 결과에 고객이 없으신가요?</p>
              <button onClick={() => { setStep('create'); setError('') }}
                className="w-full py-2.5 text-sm font-bold rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 transition">
                + 신규 고객 등록 후 리드 추가
              </button>
            </div>
          </div>
        )}

        {/* ═══════ STEP 1b: 신규 고객 등록 ═══════ */}
        {step === 'create' && (
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

            {/* B2C / B2B */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">고객 유형</label>
              <div className="flex border border-slate-200 rounded-xl overflow-hidden">
                {(['B2C', 'B2B'] as Segment[]).map(s => (
                  <button key={s} onClick={() => setNewSegment(s)}
                    className={`flex-1 py-2.5 text-xs font-bold transition-colors
                      ${newSegment === s ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                    {s === 'B2C' ? 'B2C 개인고객' : 'B2B 법인고객'}
                  </button>
                ))}
              </div>
            </div>

            {/* 이름 */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                고객명 <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={newSegment === 'B2B' ? '담당자 이름' : '고객 이름'}
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>

            {/* 연락처 */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">연락처</label>
              <input
                value={newPhone}
                onChange={e => setNewPhone(formatPhone(e.target.value))}
                placeholder="010-0000-0000"
                inputMode="numeric"
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            {/* 고객 유입경로 */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">고객 유입경로</label>
              <div className="flex gap-2 flex-wrap">
                {CUST_SOURCES.map(s => (
                  <button key={s} type="button"
                    onClick={() => setNewSource(newSource === s ? '' : s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                      ${newSource === s
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2.5">
              차량·화주 정보 등 상세 정보는 고객 등록 후 고객 상세 페이지에서 추가할 수 있습니다.
            </p>
          </div>
        )}

        {/* ═══════ STEP 2: 리드 정보 ═══════ */}
        {step === 'lead' && customer && (
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

            {/* 선택된 고객 카드 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {customer.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold text-slate-800">{customer.name}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
                    {customer.customerSegment ?? 'B2C'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{customer.phone ?? '연락처 없음'}</p>
              </div>
              <button
                onClick={() => { setCustomer(null); setStep('search'); setQuery(''); setSearchResult([]); setDidSearch(false) }}
                className="text-xs text-blue-500 hover:text-blue-700 font-semibold shrink-0">
                변경
              </button>
            </div>

            {/* 배송업 의향확인 (1-1-0) */}
            <div className="border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                미성숙 리드 확인 항목
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={intentChecked}
                  onChange={e => setIntentChecked(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 accent-slate-700 cursor-pointer"
                />
                <span className={`text-sm font-semibold transition-colors ${intentChecked ? 'text-slate-800' : 'text-slate-400'}`}>
                  배송업 의향확인
                </span>
              </label>
              {intentChecked && (
                <div className="flex gap-3">
                  <div className="w-4 shrink-0" />
                  <input
                    autoFocus
                    value={intentNote}
                    onChange={e => setIntentNote(e.target.value)}
                    placeholder="확인 방법 입력 (예: 전화 통화, 대면 상담 등)"
                    className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              )}
            </div>

            {/* 리드 발굴경로 */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">리드 발굴경로</label>
              <div className="flex gap-2 flex-wrap">
                {LEAD_SOURCES.map(s => (
                  <button key={s} type="button"
                    onClick={() => { setDealSource(dealSource === s ? '' : s); if (s !== '소개인') { setAgentValue(null); setShowNewAgent(false) } }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                      ${dealSource === s
                        ? s === '소개인'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {s}
                  </button>
                ))}
              </div>

              {/* 소개인 선택 시 AgentPicker 표시 */}
              {dealSource === '소개인' && (
                <div className="mt-3 space-y-2">
                  <AgentPicker
                    value={agentValue}
                    onChange={setAgentValue}
                    onCreateNew={name => { setNewAgentName(name); setShowNewAgent(true) }}
                  />

                  {/* 신규 Agent 인라인 등록 폼 */}
                  {showNewAgent && (
                    <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/50 space-y-3">
                      <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">새 소개인 등록</p>

                      {/* 내부 / 외부 선택 */}
                      <div className="flex gap-1.5">
                        {(['내부', '외부'] as const).map(t => (
                          <button key={t} type="button"
                            onClick={() => setNewAgentType(t)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                              ${newAgentType === t
                                ? t === '내부' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-teal-600 text-white border-teal-600'
                                : 'bg-white border-slate-200 text-slate-500'}`}>
                            {t === '내부' ? '🏢 내부 임직원' : '🤝 외부인'}
                          </button>
                        ))}
                      </div>

                      <input value={newAgentName} onChange={e => setNewAgentName(e.target.value)}
                        placeholder="이름 *" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      <input value={newAgentPhone} onChange={e => setNewAgentPhone(e.target.value)}
                        placeholder="연락처" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      {newAgentType === '외부' && (
                        <input value={newAgentCompany} onChange={e => setNewAgentCompany(e.target.value)}
                          placeholder="소속 회사" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      )}

                      <div className="flex gap-2">
                        <button type="button" onClick={() => setShowNewAgent(false)}
                          className="flex-1 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-white transition">
                          취소
                        </button>
                        <button type="button" onClick={handleCreateAgent} disabled={savingAgent || !newAgentName.trim()}
                          className="flex-1 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {savingAgent
                            ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />등록 중</>
                            : '소개인 등록'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 담당 영업사원 */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">담당 영업사원</label>
              <AssigneePicker
                value={assignee}
                onChange={setAssignee}
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">메모</label>
              <textarea
                value={memo}
                rows={3}
                onChange={e => setMemo(e.target.value)}
                placeholder="첫 상담 내용, 고객 니즈 등"
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
        )}

        {/* ═══════ 하단 버튼 ═══════ */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4 flex items-center justify-between bg-white">
          {step === 'search' && (
            <>
              <button onClick={onClose}
                className="px-5 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                취소
              </button>
              <span className="text-xs text-slate-400">고객을 선택하면 다음 단계로 이동합니다</span>
            </>
          )}

          {step === 'create' && (
            <>
              <button onClick={() => { setStep('search'); setError('') }}
                className="px-5 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                ← 뒤로
              </button>
              <button onClick={handleCreateCustomer} disabled={saving}
                className="px-6 py-2 text-sm font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-50 flex items-center gap-2">
                {saving
                  ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />등록 중...</>
                  : '고객 등록 후 리드 추가 →'}
              </button>
            </>
          )}

          {step === 'lead' && (
            <>
              <button onClick={() => { setCustomer(null); setStep('search'); setError('') }}
                className="px-5 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                ← 뒤로
              </button>
              <button onClick={handleCreateLead} disabled={saving}
                className="px-6 py-2 text-sm font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition disabled:opacity-50 flex items-center gap-2">
                {saving
                  ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />등록 중...</>
                  : '리드 등록'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
