'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { PIPELINE, getStatusColor } from '@/lib/pipeline'
import NewDealModal from './NewDealModal'

export interface PipelineDeal {
  id: string
  stageCode: string
  salesStatus: string
  name: string
  phone: string | null
  source: string | null
  collectedAt: string | null
  assignee: string | null
  memo: string | null
  checklistJson: string | null
  customerSegment?: string | null
  email?: string | null
  gender?: string | null
  maritalStatus?: string | null
  childrenCount?: number | null
  companyName?: string | null
  cargoType?: string | null
  deliveryRegion?: string | null
  purchaseTiming?: string | null
  productName?: string | null
  lostReason?: string | null
  recentMeetings?: { type: string; meetingAt: string }[]
  industry?: string | null
  shipperName?: string | null
  deliveryCity?: string | null
  deliveryDist?: string | null
}

interface Props {
  deals: PipelineDeal[]
  salesTarget: number | null
  linkedKpiLabel: string | null
}

/* ── 컬럼 설정 타입 ── */
type W = 'sm' | 'md' | 'lg'
const W_PX: Record<W, number> = { sm: 72, md: 120, lg: 196 }
interface ColCfg { key: string; visible: boolean; width: W }
interface ColDef { key: string; label: string; dw: W }

const LEAD_DEFS: ColDef[] = [
  { key: 'name',           label: '이름',       dw: 'md' },
  { key: 'summary',        label: '고객 요약',  dw: 'md' },
  { key: 'phone',          label: '연락처',     dw: 'md' },
  { key: 'stage',          label: '단계 변경',  dw: 'lg' },
  { key: 'purchaseTiming', label: '구매예상',   dw: 'sm' },
  { key: 'source',         label: '유입경로',   dw: 'sm' },
  { key: 'collectedAt',    label: '수집일',     dw: 'sm' },
  { key: 'assignee',       label: '담당자',     dw: 'sm' },
  { key: 'meetings',       label: '최근 미팅',  dw: 'lg' },
  { key: 'productName',    label: '모델명',     dw: 'md' },
  { key: 'lostReason',    label: '이탈원인',   dw: 'md' },
  { key: 'memo',           label: '메모',       dw: 'lg' },
  { key: 'record',         label: '기록',       dw: 'sm' },
  { key: 'detail',         label: '상세',       dw: 'sm' },
]

const CRM_DEFS: ColDef[] = [
  { key: 'name',           label: '이름',     dw: 'md' },
  { key: 'phone',          label: '연락처',   dw: 'md' },
  { key: 'email',          label: '이메일',   dw: 'md' },
  { key: 'gender',         label: '성별',     dw: 'sm' },
  { key: 'maritalStatus',  label: '결혼',     dw: 'sm' },
  { key: 'childrenCount',  label: '자녀',     dw: 'sm' },
  { key: 'cargoType',      label: '화물종류', dw: 'sm' },
  { key: 'deliveryRegion', label: '배송지역', dw: 'sm' },
  { key: 'companyName',    label: '회사명',   dw: 'md' },
  { key: 'detail',         label: '상세',     dw: 'sm' },
]

const LS_LEAD = 'warp-lead-cols-v1'
const LS_CRM  = 'warp-crm-cols-v1'

function mkCfg(defs: ColDef[]): ColCfg[] {
  return defs.map(d => ({ key: d.key, visible: true, width: d.dw }))
}

function parseCfg(raw: string | null, defs: ColDef[]): ColCfg[] {
  if (!raw) return mkCfg(defs)
  try {
    const saved: ColCfg[] = JSON.parse(raw)
    const defSet   = new Set(defs.map(d => d.key))
    const savedSet = new Set(saved.map(c => c.key))
    return [
      ...saved.filter(c => defSet.has(c.key)),
      ...defs.filter(d => !savedSet.has(d.key)).map(d => ({ key: d.key, visible: true, width: d.dw })),
    ]
  } catch { return mkCfg(defs) }
}

/* ── 컬럼 설정 패널 ── */
function ColSettingsPanel({
  cols, defs, onChange, onClose,
}: {
  cols: ColCfg[]
  defs: ColDef[]
  onChange: (cfg: ColCfg[]) => void
  onClose: () => void
}) {
  const ref    = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<string | null>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [onClose])

  const label = (key: string) => defs.find(d => d.key === key)?.label ?? key

  const upd = (key: string, patch: Partial<ColCfg>) =>
    onChange(cols.map(c => c.key === key ? { ...c, ...patch } : c))

  const move = (from: string, to: string) => {
    if (from === to) return
    const arr = [...cols]
    const fi = arr.findIndex(c => c.key === from)
    const ti = arr.findIndex(c => c.key === to)
    const [item] = arr.splice(fi, 1)
    arr.splice(ti, 0, item)
    onChange(arr)
  }

  return (
    <div ref={ref}
      className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden"
      style={{ width: 296 }}>
      {/* 헤더 */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">컬럼 설정</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition text-base leading-none">✕</button>
      </div>
      <p className="px-4 py-1.5 text-[10px] text-slate-400 bg-slate-50 border-b border-slate-100">
        드래그 순서 변경 · ● 표시/숨김 · S/M/L 넓이 조정
      </p>

      {/* 컬럼 목록 */}
      <div className="py-1 max-h-72 overflow-y-auto">
        {cols.map(c => (
          <div key={c.key}
            draggable
            onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDrag(c.key) }}
            onDragOver={e => e.preventDefault()}
            onDrop={() => { if (drag) move(drag, c.key); setDrag(null) }}
            onDragEnd={() => setDrag(null)}
            className={`flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors select-none
              ${drag === c.key ? 'opacity-30' : ''}`}>
            {/* 드래그 핸들 */}
            <span className="text-slate-300 cursor-grab text-sm">⠿</span>
            {/* 표시 토글 */}
            <button onClick={() => upd(c.key, { visible: !c.visible })}
              className={`text-sm transition font-bold ${c.visible ? 'text-blue-500' : 'text-slate-300'}`}>
              {c.visible ? '●' : '○'}
            </button>
            {/* 이름 */}
            <span className={`flex-1 text-xs ${c.visible ? 'text-slate-700 font-medium' : 'text-slate-300 line-through'}`}>
              {label(c.key)}
            </span>
            {/* 넓이 S/M/L */}
            <div className="flex gap-0.5">
              {(['sm', 'md', 'lg'] as W[]).map(w => (
                <button key={w} onClick={() => upd(c.key, { width: w })}
                  className={`w-6 h-5 rounded text-[9px] font-bold transition
                    ${c.width === w ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
                  {w === 'sm' ? 'S' : w === 'md' ? 'M' : 'L'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 푸터 */}
      <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
        <button onClick={() => onChange(mkCfg(defs))}
          className="text-[11px] text-slate-400 hover:text-red-500 transition">
          기본값 초기화
        </button>
        <span className="text-[10px] text-slate-300">
          {cols.filter(c => c.visible).length}/{cols.length} 표시 중
        </span>
      </div>
    </div>
  )
}

/* ── 빠른 미팅 기록 모달 ── */
function QuickMeetingModal({
  deal, onClose, onSaved,
}: {
  deal: PipelineDeal
  onClose: () => void
  onSaved: (meeting: { type: string; meetingAt: string }) => void
}) {
  const leadName = (deal.customerSegment === 'B2B' && deal.companyName) ? deal.companyName : deal.name

  const now = new Date()
  const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

  const [type,       setType]       = useState('통화')
  const [meetingAt,  setMeetingAt]  = useState(localIso)
  const [duration,   setDuration]   = useState('')
  const [content,    setContent]    = useState('')
  const [result,     setResult]     = useState('')
  const [nextAction, setNextAction] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [expTransport, setExpTransport] = useState('')
  const [expAccomm,    setExpAccomm]    = useState('')
  const [expMeal,      setExpMeal]      = useState('')
  const [expOther,     setExpOther]     = useState('')
  const [expNote,      setExpNote]      = useState('')

  const handleSave = async () => {
    if (!content.trim()) { setError('미팅 내용을 입력해 주세요.'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${deal.id}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          meetingAt:        meetingAt ? new Date(meetingAt).toISOString() : undefined,
          duration:         duration ? Number(duration) : null,
          content:          content.trim()    || null,
          result:           result.trim()     || null,
          nextAction:       nextAction.trim() || null,
          expenseTransport: expTransport ? Number(expTransport) : null,
          expenseAccomm:    expAccomm    ? Number(expAccomm)    : null,
          expenseMeal:      expMeal      ? Number(expMeal)      : null,
          expenseOther:     expOther     ? Number(expOther)     : null,
          expenseNote:      expNote.trim() || null,
        }),
      })
      const saved = await res.json()
      if (!res.ok) { setError('저장 실패'); setSaving(false); return }
      onSaved({ type: saved.type, meetingAt: saved.meetingAt })
      onClose()
    } catch {
      setError('네트워크 오류')
      setSaving(false)
    }
  }

  const modal = (
    <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">미팅 기록 추가</p>
            <p className="text-sm font-bold text-slate-800">{leadName}</p>
            {deal.phone && <p className="text-xs text-slate-400 mt-0.5">{deal.phone}</p>}
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-600 transition text-lg leading-none mt-0.5">✕</button>
        </div>

        {/* 폼 */}
        <div className="p-5 space-y-4">
          {/* 유형 */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">유형</label>
            <div className="flex gap-1.5">
              {['통화', '문자', '방문', '화상', '기타'].map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition
                    ${type === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 일시 + 소요 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">일시</label>
              <input type="datetime-local" value={meetingAt} onChange={e => setMeetingAt(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-300" />
            </div>
            <div className="w-20">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">소요(분)</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="30"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-300" />
            </div>
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">미팅 내용 *</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
              placeholder="상담 내용, 고객 요청사항 등..."
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-slate-300" />
          </div>

          {/* 결과 + 다음 액션 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">결과</label>
              <input value={result} onChange={e => setResult(e.target.value)}
                placeholder="예: 구매의향 확인"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-300" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">다음 액션</label>
              <input value={nextAction} onChange={e => setNextAction(e.target.value)}
                placeholder="예: 견적서 발송"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-300" />
            </div>
          </div>

          {/* 비용정산 */}
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">비용정산 (선택)</p>
            <div className="grid grid-cols-2 gap-2">
              {([['교통비', expTransport, setExpTransport], ['숙박비', expAccomm, setExpAccomm], ['식비', expMeal, setExpMeal], ['기타', expOther, setExpOther]] as const).map(([label, val, setter]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-12 shrink-0">{label}</span>
                  <input type="number" value={val} onChange={e => setter(e.target.value)} placeholder="0"
                    className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300 text-right" />
                </div>
              ))}
            </div>
            <input value={expNote} onChange={e => setExpNote(e.target.value)} placeholder="비용 메모"
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
            취소
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-xs font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-50">
            {saving ? '저장 중...' : '기록 저장'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

/* ── 기존 스타일 상수 ── */
const STATUS_BG_HEX: Record<string, string> = {
  green: '#22c55e', yellow: '#facc15', red: '#ef4444',
}
const STATUS_NUM_COLOR: Record<string, string> = {
  green: 'text-white', yellow: 'text-slate-800', red: 'text-white',
}
const PHASE_BG: Record<number, string> = {
  1: 'bg-blue-700', 2: 'bg-violet-700', 3: 'bg-orange-500', 4: 'bg-teal-600',
}
const PHASE_LIGHT: Record<number, string> = {
  1: 'bg-blue-50 border-blue-200', 2: 'bg-violet-50 border-violet-200',
  3: 'bg-orange-50 border-orange-200', 4: 'bg-teal-50 border-teal-200',
}
const PHASE_ACCENT: Record<number, string> = {
  1: 'text-blue-700', 2: 'text-violet-700', 3: 'text-orange-600', 4: 'text-teal-600',
}
const PHASE_NODE_BORDER: Record<number, string> = {
  1: 'border-blue-200 hover:border-blue-400', 2: 'border-violet-200 hover:border-violet-400',
  3: 'border-orange-200 hover:border-orange-400', 4: 'border-teal-200 hover:border-teal-400',
}
const PHASE_NODE_SELECTED: Record<number, string> = {
  1: 'border-blue-700 ring-2 ring-blue-400', 2: 'border-violet-700 ring-2 ring-violet-400',
  3: 'border-orange-500 ring-2 ring-orange-400', 4: 'border-teal-600 ring-2 ring-teal-400',
}
const PHASE_HEX: Record<number, string> = {
  1: '#1d4ed8', 2: '#6d28d9', 3: '#f97316', 4: '#0d9488',
}
const ALL_PROCESS_OPTIONS = PIPELINE.flatMap(ph =>
  ph.processes.map(p => ({ code: p.code, name: p.name, phase: ph.phase, phaseName: ph.name }))
)

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return iso.slice(2, 10).replace(/-/g, '.')
}
function fmtMtgDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}.${d.getDate()}`
}


type Tab = 'all' | 'b2c' | 'b2b'

/* ── 메인 컴포넌트 ── */
export default function PipelineView({ deals, salesTarget, linkedKpiLabel }: Props) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [showLost,     setShowLost]     = useState(false)
  const [localDeals,   setLocalDeals]   = useState<PipelineDeal[]>(deals)
  const [crmView,      setCrmView]      = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeTab,    setActiveTab]    = useState<Tab>('all')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [quickMtgDeal, setQuickMtgDeal] = useState<PipelineDeal | null>(null)

  /* 컬럼 설정 — SSR 안전하게 useEffect에서 로드 */
  const [leadCols, setLeadCols] = useState<ColCfg[]>(() => mkCfg(LEAD_DEFS))
  const [crmCols,  setCrmCols]  = useState<ColCfg[]>(() => mkCfg(CRM_DEFS))

  useEffect(() => {
    setLeadCols(parseCfg(localStorage.getItem(LS_LEAD), LEAD_DEFS))
    setCrmCols(parseCfg(localStorage.getItem(LS_CRM),   CRM_DEFS))
  }, [])

  const updateLeadCols = (cfg: ColCfg[]) => {
    setLeadCols(cfg)
    localStorage.setItem(LS_LEAD, JSON.stringify(cfg))
  }
  const updateCrmCols = (cfg: ColCfg[]) => {
    setCrmCols(cfg)
    localStorage.setItem(LS_CRM, JSON.stringify(cfg))
  }

  const activeCols  = crmView ? crmCols  : leadCols
  const activeDefs  = crmView ? CRM_DEFS : LEAD_DEFS
  const updateCols  = crmView ? updateCrmCols : updateLeadCols

  /* 단계 변경 */
  const handleStageChange = async (id: string, newCode: string) => {
    setLocalDeals(prev => prev.map(d => d.id === id ? { ...d, stageCode: newCode } : d))
    try {
      await fetch(`/api/deals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageCode: newCode }),
      })
    } catch { setLocalDeals(deals) }
  }

  /* 탭 필터: null/undefined → B2C(개인)로 취급 */
  const tabDeals = localDeals.filter(d => {
    if (activeTab === 'all') return true
    const seg = d.customerSegment ?? 'B2C'
    return activeTab === 'b2c' ? seg === 'B2C' : seg === 'B2B'
  })

  const activeDeals = tabDeals.filter(d => d.salesStatus !== '이탈' && d.salesStatus !== '완료')
  const lostDeals   = tabDeals.filter(d => d.salesStatus === '이탈')
  const doneDeals   = tabDeals.filter(d => d.salesStatus === '완료')

  const countByCode: Record<string, number> = {}
  for (const d of activeDeals) countByCode[d.stageCode] = (countByCode[d.stageCode] ?? 0) + 1

  const filteredDeals = (() => {
    const pool = selectedCode === '이탈' ? lostDeals
               : selectedCode === '완료' ? doneDeals
               : showLost ? tabDeals : activeDeals
    const byStage = selectedCode && selectedCode !== '이탈' && selectedCode !== '완료'
      ? pool.filter(d => d.stageCode === selectedCode)
      : pool
    if (!searchQuery.trim()) return byStage
    const q = searchQuery.trim().toLowerCase().replace(/\D/g, '') || searchQuery.trim().toLowerCase()
    return byStage.filter(d => {
      const nameMatch  = d.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      const phoneDigits = (d.phone ?? '').replace(/\D/g, '')
      const phoneMatch  = phoneDigits.includes(q) || (d.phone ?? '').toLowerCase().includes(searchQuery.trim().toLowerCase())
      return nameMatch || phoneMatch
    })
  })()

  const selectedProcess = selectedCode
    ? PIPELINE.flatMap(ph => ph.processes).find(p => p.code === selectedCode)
    : null
  const selectedPhase = selectedCode
    ? PIPELINE.find(ph => ph.processes.some(p => p.code === selectedCode))
    : null

  const handleCreated = (deal: PipelineDeal) => {
    setLocalDeals(prev => [deal, ...prev])
    setSelectedCode(deal.stageCode)
    setShowLost(false)
    setCrmView(false)
  }

  /* 리드 테이블 헤더/셀 렌더 */
  const visLeadCols = leadCols.filter(c => c.visible && !(c.key === 'stage' && !!selectedProcess))
  const visCrmCols  = crmCols.filter(c => c.visible)

  const renderLeadTh = (c: ColCfg) => (
    <th key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-3 text-left">
      {LEAD_DEFS.find(d => d.key === c.key)?.label}
    </th>
  )

  const renderLeadTd = (c: ColCfg, d: PipelineDeal) => {
    const ph = PIPELINE.find(ph => ph.processes.some(p => p.code === d.stageCode))

    switch (c.key) {
      case 'name':
        return (
          <td key={c.key} style={{ width: W_PX[c.width] }} className="px-4 py-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-slate-800 truncate">
                {(d.customerSegment === 'B2B' && d.companyName) ? d.companyName : d.name}
              </span>
              {d.customerSegment === 'B2B'
                ? <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-100 text-violet-700">법인</span>
                : <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-50 text-sky-600">개인</span>
              }
            </div>
          </td>
        )
      case 'phone':
        return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-slate-500 text-xs">{d.phone ?? '—'}</td>
      case 'stage':
        return (
          <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5">
            <select
              value={d.stageCode}
              onChange={e => handleStageChange(d.id, e.target.value)}
              onClick={e => e.stopPropagation()}
              className={`text-[11px] font-semibold border rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-300 cursor-pointer
                ${ph ? `${PHASE_LIGHT[ph.phase]} ${PHASE_ACCENT[ph.phase]}` : 'bg-white border-slate-200 text-slate-500'}`}
            >
              {ALL_PROCESS_OPTIONS.map(opt => (
                <option key={opt.code} value={opt.code}>{opt.code} {opt.name}</option>
              ))}
            </select>
          </td>
        )
      case 'purchaseTiming': {
        const isMature = d.purchaseTiming && d.purchaseTiming !== '미정'
        return (
          <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5">
            {isMature
              ? <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">{d.purchaseTiming}</span>
              : <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-500">
                  {d.purchaseTiming === '미정' ? '미정' : '미성숙'}
                </span>
            }
          </td>
        )
      }
      case 'source':
        return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-slate-400 truncate">{d.source ?? '—'}</td>
      case 'collectedAt':
        return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-slate-400">{fmtDate(d.collectedAt)}</td>
      case 'assignee':
        return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-slate-500 truncate">{d.assignee ?? '—'}</td>
      case 'productName':
        return (
          <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5">
            {d.productName
              ? <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 truncate max-w-full">{d.productName}</span>
              : <span className="text-slate-300 text-xs">—</span>
            }
          </td>
        )
      case 'lostReason':
        return (
          <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5">
            {d.lostReason
              ? <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-600 truncate max-w-full">{d.lostReason}</span>
              : <span className="text-slate-300 text-xs">—</span>
            }
          </td>
        )
      case 'summary': {
        type Chip = { label: string; cls: string }
        const chips: Chip[] = []
        if (d.customerSegment === 'B2B') {
          if (d.industry) {
            const cls = d.industry === '화주'
              ? 'bg-blue-50 text-blue-600 border-blue-200'
              : d.industry === '운송사'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-500 border-slate-200'
            chips.push({ label: d.industry, cls })
          }
          if (d.cargoType) chips.push({ label: d.cargoType, cls: 'bg-amber-50 text-amber-700 border-amber-200' })
        } else {
          if (d.shipperName) chips.push({ label: d.shipperName, cls: 'bg-orange-50 text-orange-600 border-orange-200' })
          const cityShort = d.deliveryCity?.replace(/특별시|광역시|특별자치시|특별자치도/, '').replace(/도$/, '') ?? ''
          const areaLabel = [cityShort, d.deliveryDist].filter(Boolean).join(' ')
          if (areaLabel) chips.push({ label: areaLabel, cls: 'bg-slate-100 text-slate-500 border-slate-200' })
        }
        if (!chips.length)
          return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-slate-300 text-xs">—</td>
        return (
          <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5">
            <div className="flex items-center gap-1 flex-wrap">
              {chips.map((chip, i) => (
                <span key={i} className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${chip.cls}`}>
                  {chip.label}
                </span>
              ))}
            </div>
          </td>
        )
      }
      case 'meetings': {
        const mtgs = d.recentMeetings ?? []
        if (!mtgs.length)
          return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-slate-300 text-xs">—</td>
        return (
          <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5">
            <Link href={`/funnel/${d.id}`} className="flex items-center gap-1.5 flex-wrap hover:opacity-70 transition-opacity">
              {mtgs.map((m, i) => (
                <span key={i} className="flex items-center gap-0.5 whitespace-nowrap text-[10px]">
                  {i > 0 && <span className="text-slate-200 mx-0.5">·</span>}
                  <span className={
                    m.type === '통화' ? 'font-semibold text-blue-500' :
                    m.type === '문자' ? 'font-semibold text-sky-500' :
                    m.type === '방문' ? 'font-semibold text-green-600' :
                    m.type === '화상' ? 'font-semibold text-violet-500' : 'font-semibold text-slate-500'
                  }>{m.type}</span>
                  <span className="text-slate-400">{fmtMtgDate(m.meetingAt)}</span>
                </span>
              ))}
            </Link>
          </td>
        )
      }
      case 'memo':
        return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-slate-400 truncate max-w-0">{d.memo ?? ''}</td>
      case 'record':
        return (
          <td key={c.key} style={{ width: W_PX[c.width] }} className="px-2 py-2.5 text-center">
            <button
              onClick={e => { e.stopPropagation(); setQuickMtgDeal(d) }}
              className="inline-block px-2.5 py-1 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition">
              + 기록
            </button>
          </td>
        )
      case 'detail':
        return (
          <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-center">
            <Link href={`/funnel/${d.id}`}
              className="inline-block px-2.5 py-1 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
              상세 →
            </Link>
          </td>
        )
      default: return <td key={c.key} />
    }
  }

  const renderCrmTh = (c: ColCfg) => (
    <th key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-3 text-left">
      {CRM_DEFS.find(d => d.key === c.key)?.label}
    </th>
  )

  const renderCrmTd = (c: ColCfg, d: PipelineDeal) => {
    switch (c.key) {
      case 'name':
        return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-4 py-2.5 font-semibold text-slate-800">{d.name}</td>
      case 'phone':
        return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-slate-500">{d.phone ?? '—'}</td>
      case 'email':
        return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-slate-500 truncate">{d.email ?? '—'}</td>
      case 'gender':
        return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-slate-500">{d.gender ?? '—'}</td>
      case 'maritalStatus':
        return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-slate-500">{d.maritalStatus ?? '—'}</td>
      case 'childrenCount':
        return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-slate-500 text-center">{d.childrenCount ?? '—'}</td>
      case 'cargoType':
        return (
          <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5">
            {d.cargoType
              ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700">{d.cargoType}</span>
              : <span className="text-slate-300">—</span>}
          </td>
        )
      case 'deliveryRegion':
        return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-slate-500">{d.deliveryRegion ?? '—'}</td>
      case 'companyName':
        return <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-slate-500 truncate">{d.companyName ?? '—'}</td>
      case 'detail':
        return (
          <td key={c.key} style={{ width: W_PX[c.width] }} className="px-3 py-2.5 text-center">
            <Link href={`/funnel/${d.id}`}
              className="inline-block px-2.5 py-1 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
              상세 →
            </Link>
          </td>
        )
      default: return <td key={c.key} />
    }
  }

  const TAB_LABELS: Record<Tab, string> = { all: '전체', b2c: 'B2C 개인', b2b: 'B2B 법인' }
  const tabCounts: Record<Tab, number> = {
    all: localDeals.length,
    b2c: localDeals.filter(d => (d.customerSegment ?? 'B2C') === 'B2C').length,
    b2b: localDeals.filter(d => d.customerSegment === 'B2B').length,
  }

  return (
    <>
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-0">

      {/* ── B2C / B2B 탭 ── */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-200">
        {(['all', 'b2c', 'b2b'] as Tab[]).map(tab => (
          <button key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1 rounded-full text-[11px] font-bold transition-all
              ${activeTab === tab
                ? tab === 'b2b'
                  ? 'bg-violet-700 text-white shadow-sm'
                  : tab === 'b2c'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
            {TAB_LABELS[tab]}
            <span className="ml-1.5 opacity-75">{tabCounts[tab]}</span>
          </button>
        ))}
      </div>

    <div className="flex gap-0 flex-1 min-h-0">

      {/* ── 좌측: 파이프라인 플로우 ── */}
      <div className="w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 py-2 px-2.5 flex flex-col gap-1.5">
        <button
          onClick={() => { setSelectedCode(null); setShowLost(false) }}
          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition mb-0.5
            ${!selectedCode ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 bg-white border border-slate-200'}`}>
          전체 보기 · 진행중 {activeDeals.length}건
        </button>

        {/* 판매목표 표시 (대시보드 KPI 연동) */}
        <div className={`rounded-lg border px-3 py-2 mb-0.5 ${
          salesTarget != null
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500">이달 판매목표</span>
            {salesTarget != null && (
              <span className="text-[9px] text-emerald-600 font-medium truncate max-w-[100px]" title={linkedKpiLabel ?? ''}>
                {linkedKpiLabel}
              </span>
            )}
          </div>
          {salesTarget != null ? (
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-emerald-700 tabular-nums">{salesTarget}</span>
              <span className="text-xs text-emerald-600">대</span>
            </div>
          ) : (
            <p className="text-[10px] text-slate-400 mt-0.5">
              대시보드 KPI 입력 후<br />퍼널 연동을 설정해주세요
            </p>
          )}
        </div>

        {PIPELINE.map((phase, pi) => {
          const phaseCount = phase.processes.reduce((s, p) => s + (countByCode[p.code] ?? 0), 0)
          return (
            <div key={phase.phase}>
              <div className="flex gap-1.5">
                {/* 페이즈 레이블 */}
                <div className={`w-16 shrink-0 rounded-lg overflow-hidden flex flex-col shadow-sm ${PHASE_BG[phase.phase]}`}>
                  <div className="flex-1 flex items-center justify-center px-1 py-1.5">
                    {phase.name.length > 2 ? (
                      <span className="text-white font-bold text-[13px] text-center leading-tight select-none">
                        {phase.name.slice(0, 2)}<br />{phase.name.slice(2)}
                      </span>
                    ) : (
                      <span className="text-white font-bold text-[15px] text-center leading-snug select-none">
                        {phase.name}
                      </span>
                    )}
                  </div>
                  <div className="h-px bg-white/25 mx-2" />
                  <div className="flex items-center justify-center py-1.5">
                    <span className="text-white font-bold text-[16px] tabular-nums leading-none">{phaseCount}</span>
                  </div>
                </div>

                {/* 프로세스 노드 */}
                <div className="flex-1 flex flex-col">
                  {phase.processes.map((proc, idx) => {
                    const count         = countByCode[proc.code] ?? 0
                    const dynamicTarget = (salesTarget != null && proc.conversionRate > 0)
                      ? Math.ceil(salesTarget / proc.conversionRate)
                      : proc.target
                    const status = getStatusColor(count, dynamicTarget)
                    const isSel  = selectedCode === proc.code
                    return (
                      <div key={proc.code} className="flex flex-col">
                        <button
                          onClick={() => setSelectedCode(isSel ? null : proc.code)}
                          className={`w-full text-left rounded-md border overflow-hidden transition-all
                            ${isSel ? PHASE_NODE_SELECTED[phase.phase] : `bg-white ${PHASE_NODE_BORDER[phase.phase]}`}`}>
                          <div className="flex items-stretch min-h-[34px]">
                            <div className="w-10 shrink-0 flex items-center justify-center"
                              style={{ backgroundColor: STATUS_BG_HEX[status] }}>
                              <span className={`text-[10px] font-black tabular-nums ${STATUS_NUM_COLOR[status]}`}>
                                {proc.code}
                              </span>
                            </div>
                            <div className="flex-1 flex items-center justify-between px-2 py-1 transition-colors"
                              style={isSel ? { backgroundColor: PHASE_HEX[phase.phase] } : {}}>
                              <span className={`font-semibold text-[11px] ${isSel ? 'text-white' : 'text-slate-700'}`}>
                                {proc.name}
                              </span>
                              <div className="flex items-baseline gap-0.5">
                                <span className={`text-[12px] font-bold tabular-nums ${isSel ? 'text-white/90' : PHASE_ACCENT[phase.phase]}`}>
                                  {count}
                                </span>
                                {salesTarget != null && (
                                  <span className={`text-[9px] tabular-nums ${isSel ? 'text-white/50' : 'text-slate-400'}`}>
                                    /{dynamicTarget}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                        {/* 단계 내 화살표: 작은 채운 삼각형 */}
                        {idx < phase.processes.length - 1 && (
                          <div className="flex justify-center items-center h-5">
                            <svg width="10" height="5" viewBox="0 0 10 5">
                              <path d="M0 0 L10 0 L5 5 Z" fill="#cbd5e1"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 페이즈 간 화살표 */}
              {pi < PIPELINE.length - 1 && (
                <div className="flex gap-1.5">
                  <div className="w-16 shrink-0" />
                  <div className="flex-1 flex justify-center items-center h-6">
                    <svg width="14" height="7" viewBox="0 0 14 7">
                      <path d="M0 0 L14 0 L7 7 Z" fill="#94a3b8"/>
                    </svg>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* 이탈 */}
        <button
          onClick={() => setSelectedCode('이탈')}
          className={`mt-1 w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-between
            ${selectedCode === '이탈'
              ? 'bg-red-600 text-white shadow-sm'
              : 'bg-white border border-red-200 text-red-500 hover:bg-red-50'}`}>
          <span>이탈</span>
          <span className={`text-[11px] font-bold tabular-nums ${selectedCode === '이탈' ? 'text-white/80' : 'text-red-400'}`}>
            {lostDeals.length}건
          </span>
        </button>

      </div>

      {/* ── 우측: 리드/CRM 테이블 ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* 패널 헤더 */}
        <div className={`px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0
          ${crmView ? 'bg-slate-800' : selectedPhase ? PHASE_LIGHT[selectedPhase.phase] : 'bg-white'}`}>
          <div className="flex items-center gap-2">
            {crmView
              ? <span className="font-bold text-sm text-white">CRM 고객정보 · {tabDeals.length}명</span>
              : selectedProcess
                ? <>
                    <span className={`font-bold text-sm ${selectedPhase ? PHASE_ACCENT[selectedPhase.phase] : ''}`}>
                      [{selectedProcess.code}] {selectedProcess.name}
                    </span>
                    <span className="text-xs text-slate-400">확인사항 {selectedProcess.checks.length}개</span>
                  </>
                : <span className="font-bold text-sm text-slate-700">
                    {selectedCode === '이탈' ? '이탈 리드' : '전체 리드'}
                  </span>
            }
            {!crmView && (
              <span className="text-xs text-slate-400 font-medium">
                {filteredDeals.length}건
                {searchQuery && <span className="ml-1 text-blue-400">· 검색 중</span>}
              </span>
            )}
          </div>

          <div className="flex gap-2 items-center relative">
            {/* 검색창 */}
            {!crmView && (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="이름 · 전화번호 검색"
                  className="text-xs border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 w-44 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:w-56 transition-all bg-white placeholder:text-slate-300"
                />
                <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors text-base leading-none">
                    ×
                  </button>
                )}
              </div>
            )}

            {/* 컬럼 설정 버튼 */}
            <div className="relative">
              <button
                onClick={() => setSettingsOpen(v => !v)}
                title="컬럼 설정"
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition
                  ${settingsOpen
                    ? 'bg-slate-800 text-white border-slate-800'
                    : crmView
                      ? 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                      : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                ⚙ 컬럼
              </button>
              {settingsOpen && (
                <ColSettingsPanel
                  cols={activeCols}
                  defs={activeDefs}
                  onChange={cfg => { updateCols(cfg); }}
                  onClose={() => setSettingsOpen(false)}
                />
              )}
            </div>

            <button onClick={() => setShowNewModal(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 transition">
              + 리드 추가
            </button>
            <Link href="/customers"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition border border-slate-700">
              + 고객 관리
            </Link>
          </div>
        </div>

        {/* 확인사항 힌트 바 */}
        {selectedProcess && (
          <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-x-4 gap-y-0.5 shrink-0">
            {selectedProcess.checks.map((c, i) => (
              <span key={c.key} className="text-[11px] text-slate-500">
                <span className="text-slate-300 mr-1">{i + 1}.</span>{c.label}
              </span>
            ))}
          </div>
        )}

        {/* CRM 테이블 */}
        {crmView && (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs table-fixed">
              <thead className="sticky top-0 bg-slate-800 z-10">
                <tr className="text-slate-300 font-semibold">
                  {visCrmCols.map(renderCrmTh)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tabDeals.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    {visCrmCols.map(c => renderCrmTd(c, d))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 리드 테이블 */}
        {!crmView && (
          <div className="flex-1 overflow-auto">
            {filteredDeals.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                해당 단계에 리드가 없습니다
              </div>
            ) : (
              <table className="w-full text-xs table-fixed">
                <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                  <tr className="text-slate-400 font-semibold">
                    {visLeadCols.map(renderLeadTh)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredDeals.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      {visLeadCols.map(c => renderLeadTd(c, d))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
    </div>

    {showNewModal && (
      <NewDealModal
        onClose={() => setShowNewModal(false)}
        onCreated={handleCreated}
      />
    )}
    {quickMtgDeal && (
      <QuickMeetingModal
        deal={quickMtgDeal}
        onClose={() => setQuickMtgDeal(null)}
        onSaved={(meeting) => {
          const dealId = quickMtgDeal.id
          setLocalDeals(prev => prev.map(d => {
            if (d.id !== dealId) return d
            const prev2 = d.recentMeetings ?? []
            return { ...d, recentMeetings: [meeting, ...prev2].slice(0, 2) }
          }))
          setQuickMtgDeal(null)
        }}
      />
    )}
    </>
  )
}
