'use client'

import { useState, useMemo } from 'react'
import AssigneePicker from './AssigneePicker'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronLeft, ChevronRight, ChevronDown, Check, AlertCircle, Trash2, Edit3, Search, BarChart2, Kanban } from 'lucide-react'
import { formatPhone } from '@/lib/format'
import FunnelStats from './FunnelStats'

export type Deal = {
  id:               string
  stage:            string
  name:             string
  phone:            string | null
  birthYear:        number | null
  regionCity:       string | null
  regionDist:       string | null
  leadType:         string | null
  source:           string | null
  collectedAt:      string | null
  referrer:         string | null
  phoneConsultedAt: string | null
  currentVehicle:   string | null
  tradeIn:          string | null
  switchReason:     string | null
  purchaseTiming:   string | null
  faceConsultedAt:  string | null
  customerType:     string | null
  purchaseMethod:   string | null
  capitalCheckedAt: string | null
  capitalResult:    string | null
  contractedAt:     string | null
  vehicleModel:     string | null
  vehicleCount:     number | null
  bodyType:         string | null
  tempType:         string | null
  bodyOptions:      string | null
  vehiclePrice:     number | null
  totalPrice:       number | null
  downPayment:      number | null
  monthlyPayment:   number | null
  loanMonths:       number | null
  deliveredAt:      string | null
  assignee:         string | null
  memo:             string | null
  purchaseGoal:     string | null
  keyFactors:       string | null
  lostReason:       string | null
  createdAt:        string
}

const STAGE_ORDER = ['리드', '전화상담', '대면상담', '캐피탈 심사', '계약·출고 진행'] as const

const STAGES = [
  { key: '리드',          label: '리드',          sub: '연락처 확보',             hdr: 'bg-blue-600',    light: 'bg-blue-50/60',    border: 'border-blue-100',    cnt: 'bg-blue-100 text-blue-700' },
  { key: '전화상담',      label: '전화상담',       sub: '니즈·구매시기 파악',      hdr: 'bg-sky-500',     light: 'bg-sky-50/60',     border: 'border-sky-100',     cnt: 'bg-sky-100 text-sky-700' },
  { key: '대면상담',      label: '대면상담',       sub: '견적 확정·서류 수집',     hdr: 'bg-amber-500',   light: 'bg-amber-50/60',   border: 'border-amber-100',   cnt: 'bg-amber-100 text-amber-700' },
  { key: '캐피탈 심사',   label: '캐피탈 심사',    sub: '기아 제출·차량배정 대기', hdr: 'bg-orange-500',  light: 'bg-orange-50/60',  border: 'border-orange-100',  cnt: 'bg-orange-100 text-orange-700' },
  { key: '계약·출고 진행',label: '계약·출고',      sub: '계약→발주→장착→납차',    hdr: 'bg-emerald-600', light: 'bg-emerald-50/60', border: 'border-emerald-100', cnt: 'bg-emerald-100 text-emerald-700' },
  { key: '출고 완료',     label: '출고 완료',      sub: '거래 완료',               hdr: 'bg-green-700',   light: 'bg-green-50/60',   border: 'border-green-100',   cnt: 'bg-green-100 text-green-700' },
  { key: '이탈',          label: '이탈',           sub: '거래 중단',               hdr: 'bg-slate-500',   light: 'bg-slate-50/60',   border: 'border-slate-100',   cnt: 'bg-slate-100 text-slate-500' },
] as const

type StageKey = typeof STAGES[number]['key']

const CAPITAL_RESULT_OPTS = ['대기중', '승인', '불가'] as const
const LEAD_TYPE_OPTS = ['직접발굴', '소개', '온라인', '전시회·행사', '기타']
const SOURCE_OPTS    = ['유튜브', '인스타그램', '블로그', '지인소개', '전시회', '자체발굴', '기타']
const PURCHASE_METHOD_OPTS = ['캐피탈', '현금', '리스']
const CUSTOMER_TYPE_OPTS   = ['개인', '법인']
const TRADE_IN_OPTS        = ['Y', 'N', '협의']
const TEMP_TYPE_OPTS       = ['냉동', '상온']

const emptyForm = () => ({
  name: '', phone: '', birthYear: '', regionCity: '', regionDist: '',
  leadType: '', source: '', collectedAt: '', referrer: '',
  phoneConsultedAt: '', currentVehicle: '', tradeIn: '', switchReason: '', purchaseTiming: '',
  faceConsultedAt: '', customerType: '', purchaseMethod: '',
  capitalCheckedAt: '', capitalResult: '',
  contractedAt: '', vehicleModel: '', vehicleCount: '', bodyType: '', tempType: '',
  bodyOptions: '', vehiclePrice: '', totalPrice: '', downPayment: '', monthlyPayment: '', loanMonths: '',
  deliveredAt: '',
  assignee: '', memo: '', purchaseGoal: '', keyFactors: '', lostReason: '',
})
type FormState = ReturnType<typeof emptyForm>

const dealToForm = (d: Deal): FormState => ({
  name: d.name, phone: d.phone ?? '',
  birthYear:        d.birthYear       != null ? String(d.birthYear) : '',
  regionCity:       d.regionCity      ?? '', regionDist:  d.regionDist    ?? '',
  leadType:         d.leadType        ?? '', source:      d.source        ?? '',
  collectedAt:      d.collectedAt     ? d.collectedAt.slice(0, 10)      : '',
  referrer:         d.referrer        ?? '',
  phoneConsultedAt: d.phoneConsultedAt ? d.phoneConsultedAt.slice(0, 10) : '',
  currentVehicle:   d.currentVehicle  ?? '', tradeIn: d.tradeIn ?? '',
  switchReason:     d.switchReason    ?? '', purchaseTiming: d.purchaseTiming ?? '',
  faceConsultedAt:  d.faceConsultedAt  ? d.faceConsultedAt.slice(0, 10)  : '',
  customerType:     d.customerType    ?? '', purchaseMethod: d.purchaseMethod ?? '',
  capitalCheckedAt: d.capitalCheckedAt ? d.capitalCheckedAt.slice(0, 10)  : '',
  capitalResult:    d.capitalResult   ?? '',
  contractedAt:     d.contractedAt    ? d.contractedAt.slice(0, 10)     : '',
  vehicleModel:     d.vehicleModel    ?? '',
  vehicleCount:     d.vehicleCount    != null ? String(d.vehicleCount) : '',
  bodyType:         d.bodyType        ?? '', tempType:    d.tempType     ?? '',
  bodyOptions:      d.bodyOptions     ?? '',
  vehiclePrice:     d.vehiclePrice    != null ? String(d.vehiclePrice) : '',
  totalPrice:       d.totalPrice      != null ? String(d.totalPrice)   : '',
  downPayment:      d.downPayment     != null ? String(d.downPayment)  : '',
  monthlyPayment:   d.monthlyPayment  != null ? String(d.monthlyPayment) : '',
  loanMonths:       d.loanMonths      != null ? String(d.loanMonths)   : '',
  deliveredAt:      d.deliveredAt     ? d.deliveredAt.slice(0, 10)     : '',
  assignee:         d.assignee        ?? '', memo: d.memo ?? '',
  purchaseGoal:     d.purchaseGoal    ?? '', keyFactors: d.keyFactors  ?? '',
  lostReason:       d.lostReason      ?? '',
})

const formToData = (f: FormState) => ({
  name:             f.name,
  phone:            f.phone            || null,
  birthYear:        f.birthYear        ? parseInt(f.birthYear)          : null,
  regionCity:       f.regionCity       || null, regionDist:  f.regionDist      || null,
  leadType:         f.leadType         || null, source:      f.source          || null,
  collectedAt:      f.collectedAt      || null, referrer:    f.referrer        || null,
  phoneConsultedAt: f.phoneConsultedAt || null,
  currentVehicle:   f.currentVehicle   || null, tradeIn:     f.tradeIn         || null,
  switchReason:     f.switchReason     || null, purchaseTiming: f.purchaseTiming || null,
  faceConsultedAt:  f.faceConsultedAt  || null,
  customerType:     f.customerType     || null, purchaseMethod: f.purchaseMethod || null,
  capitalCheckedAt: f.capitalCheckedAt || null, capitalResult:  f.capitalResult  || null,
  contractedAt:     f.contractedAt     || null,
  vehicleModel:     f.vehicleModel     || null,
  vehicleCount:     f.vehicleCount     ? parseInt(f.vehicleCount)       : null,
  bodyType:         f.bodyType         || null, tempType:    f.tempType        || null,
  bodyOptions:      f.bodyOptions      || null,
  vehiclePrice:     f.vehiclePrice     ? parseInt(f.vehiclePrice)       : null,
  totalPrice:       f.totalPrice       ? parseInt(f.totalPrice)         : null,
  downPayment:      f.downPayment      ? parseInt(f.downPayment)        : null,
  monthlyPayment:   f.monthlyPayment   ? parseInt(f.monthlyPayment)     : null,
  loanMonths:       f.loanMonths       ? parseInt(f.loanMonths)         : null,
  deliveredAt:      f.deliveredAt      || null,
  assignee:         f.assignee         || null, memo:        f.memo            || null,
  purchaseGoal:     f.purchaseGoal     || null, keyFactors:  f.keyFactors      || null,
  lostReason:       f.lostReason       || null,
})

/* ── 모달: 생성/수정만 ── */
type ModalState =
  | { mode: 'create'; stage: StageKey }
  | { mode: 'edit';   deal: Deal }

interface Props { deals: Deal[] }

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
const fmtMon    = (n: number | null | undefined) => n != null ? `${n.toLocaleString()}만원` : null
const fmtSimple = (iso: string) => { const d = new Date(iso); return `${d.getMonth()+1}/${d.getDate()}` }

const capitalBadge = (r: string | null) => {
  if (!r) return null
  const map: Record<string, string> = { '대기중': 'bg-amber-100 text-amber-700', '승인': 'bg-green-100 text-green-700', '불가': 'bg-red-100 text-red-600' }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[r] ?? 'bg-slate-100 text-slate-500'}`}>{r}</span>
}

const FieldInput = ({ label, value, onChange, type = 'text', placeholder = '', required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean
}) => (
  <div>
    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
  </div>
)

const SelectInput = ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) => (
  <div>
    <label className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
      <option value="">— 선택 —</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
)

export default function FunnelBoard({ deals: initialDeals }: Props) {
  const router = useRouter()
  const [deals, setDeals]       = useState(initialDeals)
  const [selected, setSelected] = useState<Deal | null>(null)
  const [modal, setModal]       = useState<ModalState | null>(null)
  const [form,  setForm]        = useState<FormState>(emptyForm())
  const [saving, setSaving]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [showLost,  setShowLost]    = useState(false)
  const [view,   setView]       = useState<'funnel' | 'stats'>('funnel')
  const [search, setSearch]     = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')

  const setF = (p: Partial<FormState>) => setForm(f => ({ ...f, ...p }))

  /* ── 필터 ── */
  const assigneeOptions = useMemo(() =>
    [...new Set(deals.map(d => d.assignee).filter(Boolean) as string[])].sort()
  , [deals])

  const filteredDeals = useMemo(() => deals.filter(d => {
    if (search) {
      const q = search.toLowerCase()
      if (!d.name.toLowerCase().includes(q) && !(d.phone ?? '').includes(q)) return false
    }
    if (assigneeFilter && d.assignee !== assigneeFilter) return false
    return true
  }), [deals, search, assigneeFilter])

  const openCreate = (stage: StageKey) => { setForm(emptyForm()); setModal({ mode: 'create', stage }) }
  const openEdit   = (deal: Deal)      => { setForm(dealToForm(deal)); setModal({ mode: 'edit', deal }) }
  const openView   = (deal: Deal)      => { setSelected(deal); setConfirmDel(false); setShowLost(false); setForm(emptyForm()) }
  const closeModal = () => setModal(null)
  const closePanel = () => { setSelected(null); setConfirmDel(false); setShowLost(false) }

  const applyUpdate = (updated: Deal) => {
    setDeals(prev => prev.map(d => d.id === updated.id ? updated : d))
    if (selected?.id === updated.id) setSelected(updated)
    closeModal()
    router.refresh()
  }

  const callPUT = async (id: string, data: object) => {
    setSaving(true)
    const res = await fetch(`/api/deals/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (res.ok) applyUpdate(await res.json())
    setSaving(false)
  }

  const handleCreate = async () => {
    if (!form.name.trim() || modal?.mode !== 'create') return
    setSaving(true)
    const res = await fetch('/api/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: modal.stage, ...formToData(form) }) })
    if (res.ok) { const created = await res.json(); setDeals(prev => [...prev, created]); closeModal(); router.refresh() }
    setSaving(false)
  }

  const handleSaveEdit = async () => {
    if (modal?.mode !== 'edit') return
    callPUT(modal.deal.id, formToData(form))
  }

  const handleDelete = async (id: string) => {
    setSaving(true)
    const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' })
    if (res.ok) { setDeals(prev => prev.filter(d => d.id !== id)); closePanel(); router.refresh() }
    setSaving(false)
  }

  const moveStage = (deal: Deal, dir: 'prev' | 'next') => {
    const idx = STAGE_ORDER.indexOf(deal.stage as typeof STAGE_ORDER[number])
    if (idx === -1) return
    if (dir === 'prev' && idx > 0) callPUT(deal.id, { stage: STAGE_ORDER[idx - 1] })
    if (dir === 'next' && idx < STAGE_ORDER.length - 1) callPUT(deal.id, { stage: STAGE_ORDER[idx + 1] })
  }

  const dealsByStage = new Map<string, Deal[]>(STAGES.map(s => [s.key, []]))
  for (const d of filteredDeals) dealsByStage.get(d.stage)?.push(d)

  /* ── 컬럼 렌더링 ── */
  const renderCol = (key: string) => {
    const stage = STAGES.find(s => s.key === key)!
    const sd    = dealsByStage.get(key) ?? []
    const isTerminal = key === '출고 완료' || key === '이탈'
    return (
      <div className="flex flex-col rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white min-w-0"
        style={{ height: 'calc((100vh - 255px) / 3)', minHeight: 120 }}>
        {/* 헤더 */}
        <div className={`${stage.hdr} px-2.5 flex items-center justify-between shrink-0`} style={{ height: 32 }}>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-bold text-white leading-none">{stage.label}</span>
            <span className={`text-[9px] font-black px-1 py-0.5 rounded-full leading-none ${stage.cnt}`}>{sd.length}</span>
            <span className="text-[9px] text-white/50 truncate hidden sm:block">{stage.sub}</span>
          </div>
          {!isTerminal && (
            <button onClick={() => openCreate(key as StageKey)}
              className="w-5 h-5 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center transition-colors shrink-0 ml-1">
              <Plus size={11} className="text-white" />
            </button>
          )}
        </div>
        {/* 카드 목록 — 내부 스크롤 */}
        <div className={`flex-1 overflow-y-auto p-1 space-y-0.5 ${stage.light}`}>
          {sd.length === 0 && <p className="text-center text-[10px] text-slate-300 py-4">—</p>}
          {sd.map(deal => (
            <button key={deal.id} onClick={() => openView(deal)}
              className={`w-full text-left bg-white rounded-md px-2 py-1 shadow-sm border ${stage.border} hover:shadow-md transition-shadow ${selected?.id === deal.id ? 'ring-2 ring-indigo-400' : ''}`}>
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                  <span className="text-[10px] font-semibold text-slate-800 shrink-0">{deal.name}</span>
                  {deal.phone && <span className="text-[9px] text-slate-400 truncate">{deal.phone}</span>}
                </div>
                <span className="text-[8px] text-slate-300 shrink-0">{fmtSimple(deal.createdAt)}</span>
              </div>
              {(key === '캐피탈 심사' && deal.capitalResult || deal.vehicleModel || (key === '이탈' && deal.lostReason)) && (
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {key === '캐피탈 심사' && deal.capitalResult && capitalBadge(deal.capitalResult)}
                  {deal.vehicleModel && <span className="text-[9px] text-slate-500">{deal.vehicleModel}{deal.tempType ? ` · ${deal.tempType}` : ''}</span>}
                  {key === '이탈' && deal.lostReason && <span className="text-[9px] text-red-400 truncate">{deal.lostReason}</span>}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    )
  }

  /* ── 보드 레이아웃 ── */
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 2rem 1fr 2rem 1fr', gap: 0 }
  const leadCnt  = dealsByStage.get('리드')?.length  ?? 0
  const phoneCnt = dealsByStage.get('전화상담')?.length ?? 0
  const faceCnt  = dealsByStage.get('대면상담')?.length ?? 0
  const toRate   = (n: number, base: number) => base > 0 ? `${Math.round(n / base * 100)}%` : '—'

  const HArrow = () => (
    <div className="flex items-center justify-center" style={{ width: '2rem' }}>
      <ChevronRight size={14} className="text-slate-300" />
    </div>
  )
  const RowLabel = ({ text, extra }: { text: string; extra?: React.ReactNode }) => (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">{text}</span>
      <div className="h-px bg-slate-200 flex-1" />
      {extra}
    </div>
  )

  /* ── 상세 패널 테이블 ── */
  const DetailTable = ({ deal }: { deal: Deal }) => {
    const sec = (t: string) => (
      <tr key={t}><td colSpan={4} className="pt-3 pb-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b-2 border-slate-200">{t}</td></tr>
    )
    const row = (l1: string, v1: string | null | undefined, l2 = '', v2: string | null | undefined = null) => {
      if (!v1 && !v2) return null
      return (
        <tr key={l1} className="border-b border-slate-50">
          <td className="py-1 pr-2 text-[10px] text-slate-400 align-top whitespace-nowrap">{l1}</td>
          <td className="py-1 pr-4 text-[11px] text-slate-700 align-top">{v1 || '—'}</td>
          <td className="py-1 pr-2 text-[10px] text-slate-400 align-top whitespace-nowrap">{l2}</td>
          <td className="py-1 text-[11px] text-slate-700 align-top">{l2 ? (v2 || '—') : ''}</td>
        </tr>
      )
    }
    const region = [deal.regionCity, deal.regionDist].filter(Boolean).join(' ') || null
    return (
      <table className="w-full border-collapse text-xs">
        <colgroup>
          <col style={{ width: '16%' }} /><col style={{ width: '34%' }} />
          <col style={{ width: '16%' }} /><col style={{ width: '34%' }} />
        </colgroup>
        <tbody>
          {sec('기본 정보')}
          {row('연락처', deal.phone, '고객유형', deal.customerType)}
          {row('구매방식', deal.purchaseMethod, '출생연도', deal.birthYear ? String(deal.birthYear) : null)}
          {row('지역', region, '담당자', deal.assignee)}
          {row('추천인', deal.referrer)}

          {(deal.leadType || deal.source || deal.collectedAt) && sec('리드')}
          {row('리드유형', deal.leadType, '유입경로', deal.source)}
          {row('수집일', fmtDate(deal.collectedAt))}

          {(deal.phoneConsultedAt || deal.currentVehicle || deal.switchReason || deal.purchaseTiming) && sec('전화상담')}
          {row('상담일', fmtDate(deal.phoneConsultedAt), '기존차량', deal.currentVehicle)}
          {row('매입여부', deal.tradeIn, '교체사유', deal.switchReason)}
          {row('구매시기', deal.purchaseTiming)}

          {deal.faceConsultedAt && sec('대면상담')}
          {row('대면상담일', fmtDate(deal.faceConsultedAt))}

          {(deal.capitalCheckedAt || deal.capitalResult) && sec('캐피탈 심사')}
          {row('조회 의뢰일', fmtDate(deal.capitalCheckedAt), '결과', deal.capitalResult)}

          {(deal.contractedAt || deal.vehicleModel || deal.vehiclePrice) && sec('계약 · 차량')}
          {row('계약일', fmtDate(deal.contractedAt), '차종', deal.vehicleModel)}
          {row('대수', deal.vehicleCount != null ? `${deal.vehicleCount}대` : null, '특장', deal.bodyType)}
          {row('온도', deal.tempType, '옵션', deal.bodyOptions)}
          {row('차량가격', fmtMon(deal.vehiclePrice), '총가격', fmtMon(deal.totalPrice))}
          {row('선수금', fmtMon(deal.downPayment), '월납액', fmtMon(deal.monthlyPayment))}
          {row('개월수', deal.loanMonths != null ? `${deal.loanMonths}개월` : null, '출고일', fmtDate(deal.deliveredAt))}

          {(deal.memo || deal.purchaseGoal || deal.keyFactors || deal.lostReason) && sec('메모')}
          {deal.memo && (
            <tr key="memo" className="border-b border-slate-50">
              <td className="py-1 pr-2 text-[10px] text-slate-400 align-top">상담메모</td>
              <td className="py-1 text-[11px] text-slate-700 align-top whitespace-pre-wrap" colSpan={3}>{deal.memo}</td>
            </tr>
          )}
          {row('구매목적', deal.purchaseGoal, '중요요소', deal.keyFactors)}
          {deal.stage === '이탈' && row('이탈 사유', deal.lostReason)}
        </tbody>
      </table>
    )
  }

  return (
    <>
      {/* ── 필터 바 ── */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {/* 검색 */}
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="이름 · 전화번호"
            className="pl-7 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={11} />
            </button>
          )}
        </div>

        {/* 담당자 필터 */}
        <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
          <option value="">전체 담당자</option>
          {assigneeOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* 필터 결과 건수 */}
        {(search || assigneeFilter) && (
          <span className="text-[10px] text-slate-400 px-1">
            {filteredDeals.length} / {deals.length}건
          </span>
        )}

        <div className="flex-1" />

        {/* 뷰 전환 */}
        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
          <button onClick={() => setView('funnel')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${view === 'funnel' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Kanban size={12} /> 퍼널
          </button>
          <button onClick={() => setView('stats')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${view === 'stats' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            <BarChart2 size={12} /> 통계
          </button>
        </div>
      </div>

      {/* ── 통계 뷰 ── */}
      {view === 'stats' && <FunnelStats deals={filteredDeals} />}

      {/* ── 퍼널 보드 ── */}
      {view === 'funnel' &&
      <div className="space-y-1 pb-1">

        <RowLabel text="획득 퍼널" extra={
          leadCnt > 0 ? (
            <span className="text-[9px] text-slate-400 shrink-0">
              전화 {toRate(phoneCnt, leadCnt)} · 대면 {toRate(faceCnt, leadCnt)}
            </span>
          ) : null
        } />
        <div style={gridStyle}>
          {renderCol('리드')}<HArrow />{renderCol('전화상담')}<HArrow />{renderCol('대면상담')}
        </div>

        {/* 대면상담 → 캐피탈 심사 연결 */}
        <div className="flex items-center" style={{ marginTop: 2 }}>
          <div className="h-px bg-slate-200" style={{ width: 'calc(66.67% + 1rem)' }} />
          <ChevronLeft size={10} className="text-slate-300 shrink-0" />
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-[8px] text-slate-300 px-1.5 shrink-0">대면 완료 후</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        <RowLabel text="심사 · 계약 · 완료" />
        <div style={gridStyle}>
          {renderCol('캐피탈 심사')}<HArrow />{renderCol('계약·출고 진행')}<HArrow />{renderCol('출고 완료')}
        </div>

        {/* 계약·출고 → 이탈 연결 */}
        <div style={gridStyle}>
          <div /><div />
          <div className="flex justify-center" style={{ paddingTop: 2, paddingBottom: 0 }}>
            <ChevronDown size={10} className="text-slate-300" />
          </div>
          <div /><div />
        </div>

        <RowLabel text="이탈" />
        <div style={gridStyle}>
          <div /><div />{renderCol('이탈')}<div /><div />
        </div>

      </div>}

      {/* ── 오른쪽 슬라이드 패널 ── */}
      {selected && (() => {
        const deal      = selected
        const stageInfo = STAGES.find(s => s.key === deal.stage)!
        const stageIdx  = STAGE_ORDER.indexOf(deal.stage as typeof STAGE_ORDER[number])
        const isTerminal = deal.stage === '출고 완료' || deal.stage === '이탈'

        return (
          <>
            {/* 백드롭 */}
            <div className="fixed inset-0 z-40 bg-black/15" onClick={closePanel} />

            {/* 패널 */}
            <div className="fixed inset-y-0 right-0 z-50 w-[500px] bg-white shadow-2xl flex flex-col border-l border-slate-200">

              {/* 패널 헤더 */}
              <div className={`${stageInfo.hdr} px-5 py-4 shrink-0`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-white leading-snug">{deal.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold text-white/80 bg-white/20 px-2 py-0.5 rounded-full">{stageInfo.label}</span>
                      {deal.phone && <span className="text-[11px] text-white/70">{deal.phone}</span>}
                      <span className="text-[10px] text-white/50">{fmtSimple(deal.createdAt)} 등록</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => openEdit(deal)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-white/80 bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg transition-colors">
                      <Edit3 size={12} /> 수정
                    </button>
                    <button onClick={closePanel}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 transition-colors">
                      <X size={14} className="text-white/80" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 패널 바디 — 스크롤 */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <DetailTable deal={deal} />
              </div>

              {/* 패널 푸터 — 단계 이동 / 처리 */}
              <div className="shrink-0 px-5 py-4 border-t border-slate-100 space-y-2">

                {/* 단계 이동 버튼 */}
                {!isTerminal && stageIdx >= 0 && (
                  <div className="flex gap-2">
                    {stageIdx > 0 && (
                      <button onClick={() => moveStage(deal, 'prev')} disabled={saving}
                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                        <ChevronLeft size={13} /> 이전 단계
                      </button>
                    )}
                    {stageIdx < STAGE_ORDER.length - 1 && (
                      <button onClick={() => moveStage(deal, 'next')} disabled={saving}
                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                        다음 단계 <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                )}

                {/* 출고 완료 / 이탈 */}
                {!isTerminal && (
                  <div className="flex gap-2">
                    <button onClick={() => callPUT(deal.id, { stage: '출고 완료', deliveredAt: new Date().toISOString().slice(0,10) })} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                      <Check size={13} /> 출고 완료
                    </button>
                    <button onClick={() => setShowLost(true)} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-white bg-slate-500 rounded-lg hover:bg-slate-600 transition-colors">
                      <AlertCircle size={13} /> 이탈 처리
                    </button>
                  </div>
                )}

                {/* 이탈 사유 입력 */}
                {showLost && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-700">이탈 사유 (선택)</p>
                    <input type="text" value={form.lostReason}
                      onChange={e => setF({ lostReason: e.target.value })}
                      placeholder="이유를 간단히 기록하세요"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowLost(false)}
                        className="flex-1 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-white">취소</button>
                      <button onClick={() => callPUT(deal.id, { stage: '이탈', lostReason: form.lostReason })}
                        className="flex-1 py-1.5 text-xs font-bold text-white bg-slate-600 rounded-lg hover:bg-slate-700">이탈 처리</button>
                    </div>
                  </div>
                )}

                {/* 다시 열기 (terminal 상태에서) */}
                {isTerminal && (
                  <button onClick={() => callPUT(deal.id, { stage: '대면상담' })}
                    className="w-full py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    다시 열기 → 대면상담
                  </button>
                )}

                {/* 삭제 */}
                <div className="flex justify-end pt-1">
                  {!confirmDel
                    ? <button onClick={() => setConfirmDel(true)}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 size={12} /> 삭제
                      </button>
                    : <div className="flex items-center gap-2">
                        <span className="text-[10px] text-red-500 font-semibold">삭제할까요?</span>
                        <button onClick={() => handleDelete(deal.id)} disabled={saving}
                          className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded hover:bg-red-600">삭제</button>
                        <button onClick={() => setConfirmDel(false)}
                          className="text-[10px] text-slate-400 hover:text-slate-600">취소</button>
                      </div>
                  }
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {/* ── 생성 / 수정 모달 ── */}
      {modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-bold text-slate-800">
                {modal.mode === 'create' ? `새 딜 — ${modal.stage}` : `수정 — ${modal.deal.name}`}
              </h3>
              <button onClick={closeModal}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                <X size={14} className="text-slate-400" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-3 overflow-y-auto">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">기본 정보</p>
              <FieldInput label="고객명" value={form.name} onChange={v => setF({ name: v })} required placeholder="이름" />
              <FieldInput label="연락처" value={form.phone} onChange={v => setF({ phone: formatPhone(v) })} placeholder="010-0000-0000" />
              <div className="grid grid-cols-2 gap-2">
                <SelectInput label="고객유형" value={form.customerType} onChange={v => setF({ customerType: v })} options={CUSTOMER_TYPE_OPTS} />
                <SelectInput label="구매방식" value={form.purchaseMethod} onChange={v => setF({ purchaseMethod: v })} options={PURCHASE_METHOD_OPTS} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FieldInput label="출생연도" value={form.birthYear} onChange={v => setF({ birthYear: v })} placeholder="1985" />
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">담당자</label>
                  <AssigneePicker value={form.assignee} onChange={v => setF({ assignee: v })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FieldInput label="지역(도)" value={form.regionCity} onChange={v => setF({ regionCity: v })} placeholder="경기" />
                <FieldInput label="지역(시군구)" value={form.regionDist} onChange={v => setF({ regionDist: v })} placeholder="성남시" />
              </div>
              <FieldInput label="추천인" value={form.referrer} onChange={v => setF({ referrer: v })} placeholder="소개인명" />

              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-3">리드</p>
              <div className="grid grid-cols-2 gap-2">
                <SelectInput label="리드유형" value={form.leadType} onChange={v => setF({ leadType: v })} options={LEAD_TYPE_OPTS} />
                <SelectInput label="유입경로" value={form.source} onChange={v => setF({ source: v })} options={SOURCE_OPTS} />
              </div>
              <FieldInput label="수집날짜" value={form.collectedAt} onChange={v => setF({ collectedAt: v })} type="date" />

              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-3">전화상담</p>
              <FieldInput label="전화상담일" value={form.phoneConsultedAt} onChange={v => setF({ phoneConsultedAt: v })} type="date" />
              <FieldInput label="기존차량" value={form.currentVehicle} onChange={v => setF({ currentVehicle: v })} placeholder="기존 보유차량" />
              <div className="grid grid-cols-2 gap-2">
                <SelectInput label="기존차량 매입여부" value={form.tradeIn} onChange={v => setF({ tradeIn: v })} options={TRADE_IN_OPTS} />
                <FieldInput label="차량구매시기" value={form.purchaseTiming} onChange={v => setF({ purchaseTiming: v })} placeholder="즉시/1개월내" />
              </div>
              <FieldInput label="교체사유" value={form.switchReason} onChange={v => setF({ switchReason: v })} placeholder="교체하려는 이유" />

              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-3">대면상담</p>
              <FieldInput label="대면상담일" value={form.faceConsultedAt} onChange={v => setF({ faceConsultedAt: v })} type="date" />

              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-3">캐피탈 심사</p>
              <FieldInput label="조회 의뢰일" value={form.capitalCheckedAt} onChange={v => setF({ capitalCheckedAt: v })} type="date" />
              <SelectInput label="캐피탈 결과" value={form.capitalResult} onChange={v => setF({ capitalResult: v })} options={[...CAPITAL_RESULT_OPTS]} />

              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-3">계약·차량</p>
              <FieldInput label="계약일" value={form.contractedAt} onChange={v => setF({ contractedAt: v })} type="date" />
              <div className="grid grid-cols-2 gap-2">
                <FieldInput label="차종" value={form.vehicleModel} onChange={v => setF({ vehicleModel: v })} placeholder="PV5 냉동탑차" />
                <FieldInput label="대수" value={form.vehicleCount} onChange={v => setF({ vehicleCount: v })} placeholder="1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FieldInput label="특장" value={form.bodyType} onChange={v => setF({ bodyType: v })} placeholder="냉동탑차" />
                <SelectInput label="상온/냉동" value={form.tempType} onChange={v => setF({ tempType: v })} options={TEMP_TYPE_OPTS} />
              </div>
              <FieldInput label="옵션(특장)" value={form.bodyOptions} onChange={v => setF({ bodyOptions: v })} placeholder="옵션 내용" />
              <div className="grid grid-cols-2 gap-2">
                <FieldInput label="차량가격(만원)" value={form.vehiclePrice} onChange={v => setF({ vehiclePrice: v })} placeholder="5000" />
                <FieldInput label="총가격(만원)" value={form.totalPrice} onChange={v => setF({ totalPrice: v })} placeholder="5500" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <FieldInput label="선수금(만원)" value={form.downPayment} onChange={v => setF({ downPayment: v })} placeholder="500" />
                <FieldInput label="월납액(만원)" value={form.monthlyPayment} onChange={v => setF({ monthlyPayment: v })} placeholder="120" />
                <FieldInput label="개월수" value={form.loanMonths} onChange={v => setF({ loanMonths: v })} placeholder="60" />
              </div>
              <FieldInput label="출고일" value={form.deliveredAt} onChange={v => setF({ deliveredAt: v })} type="date" />

              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-3">메모</p>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">상담메모</label>
                <textarea value={form.memo} onChange={e => setF({ memo: e.target.value })} rows={3}
                  placeholder="특이사항, 고객 요청 등"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
              </div>
              <FieldInput label="구매목적" value={form.purchaseGoal} onChange={v => setF({ purchaseGoal: v })} placeholder="배달업 전업 등" />
              <FieldInput label="중요요소" value={form.keyFactors} onChange={v => setF({ keyFactors: v })} placeholder="가격/월납액 등" />

              <div className="flex gap-2 pt-2">
                <button onClick={closeModal}
                  className="flex-1 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">취소</button>
                <button onClick={modal.mode === 'create' ? handleCreate : handleSaveEdit}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                  {saving ? '저장 중…' : modal.mode === 'create' ? '추가' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
