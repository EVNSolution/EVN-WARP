'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { formatPhone } from '@/lib/format'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Lead = { id: string; stageCode: string; salesStatus: string }
type Activity = { id: string; date: string; type: string }
type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  customerSegment: string | null
  status: string
  grade: string | null
  source: string | null
  collectedAt: string | null
  assignee: string | null
  isAgent: boolean | null
  companyName: string | null
  cargoType: string | null
  leads: Lead[]
  activities: Activity[]
  createdAt: string
}

type Seg = 'all' | 'B2C' | 'B2B'

/* ── 컬럼 설정 ── */
type W = 'sm' | 'md' | 'lg'
const W_PX: Record<W, number> = { sm: 72, md: 120, lg: 196 }
interface ColCfg { key: string; visible: boolean; width: W }
interface ColDef { key: string; label: string; dw: W }

const COL_DEFS: ColDef[] = [
  { key: 'name',         label: '이름',     dw: 'md' },
  { key: 'phone',        label: '연락처',   dw: 'md' },
  { key: 'segment',      label: '세그먼트', dw: 'sm' },
  { key: 'companyName',  label: '회사명',   dw: 'md' },
  { key: 'source',       label: '유입경로', dw: 'sm' },
  { key: 'collectedAt',  label: '수집일',   dw: 'sm' },
  { key: 'assignee',     label: '담당자',   dw: 'sm' },
  { key: 'isAgent',      label: '소개인',   dw: 'sm' },
  { key: 'leads',        label: '리드',     dw: 'sm' },
  { key: 'lastActivity', label: '최근활동', dw: 'md' },
  { key: 'detail',       label: '상세',     dw: 'sm' },
]

const LS_KEY = 'warp-customer-list-cols-v1'

function mkCfg(defs: ColDef[]): ColCfg[] {
  return defs.map(d => ({ key: d.key, visible: true, width: d.dw }))
}

function parseCfg(raw: string | null): ColCfg[] {
  if (!raw) return mkCfg(COL_DEFS)
  try {
    const saved: ColCfg[] = JSON.parse(raw)
    const defSet   = new Set(COL_DEFS.map(d => d.key))
    const savedSet = new Set(saved.map(c => c.key))
    return [
      ...saved.filter(c => defSet.has(c.key)),
      ...COL_DEFS.filter(d => !savedSet.has(d.key)).map(d => ({ key: d.key, visible: true, width: d.dw })),
    ]
  } catch { return mkCfg(COL_DEFS) }
}

/* ── 컬럼 설정 패널 ── */
function ColSettingsPanel({
  cols, onChange, onClose,
}: {
  cols: ColCfg[]
  onChange: (cfg: ColCfg[]) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<string | null>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [onClose])

  const getLabel = (key: string) => COL_DEFS.find(d => d.key === key)?.label ?? key

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
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">컬럼 설정</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition text-base leading-none">✕</button>
      </div>
      <p className="px-4 py-1.5 text-[10px] text-slate-400 bg-slate-50 border-b border-slate-100">
        드래그 순서 변경 · ● 표시/숨김 · S/M/L 넓이 조정
      </p>
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
            <span className="text-slate-300 cursor-grab text-sm">⠿</span>
            <button onClick={() => upd(c.key, { visible: !c.visible })}
              className={`text-sm transition font-bold ${c.visible ? 'text-blue-500' : 'text-slate-300'}`}>
              {c.visible ? '●' : '○'}
            </button>
            <span className={`flex-1 text-xs ${c.visible ? 'text-slate-700 font-medium' : 'text-slate-300 line-through'}`}>
              {getLabel(c.key)}
            </span>
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
      <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
        <button onClick={() => onChange(mkCfg(COL_DEFS))}
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

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace('. ', '/').replace('.', '')
}

interface Props { customers: Customer[] }

export default function CustomerListClient({ customers: initial }: Props) {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>(initial)
  const [seg,          setSeg]          = useState<Seg>('all')
  const [search,       setSearch]       = useState('')
  const [showNew,      setShowNew]      = useState(false)
  const [cols,         setCols]         = useState<ColCfg[]>(() => mkCfg(COL_DEFS))
  const [settingsOpen, setSettingsOpen] = useState(false)

  /* localStorage에서 컬럼 설정 로드 (SSR 안전) */
  useEffect(() => {
    setCols(parseCfg(localStorage.getItem(LS_KEY)))
  }, [])

  /* 변경 시 저장 */
  const updateCols = (next: ColCfg[]) => {
    setCols(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
  }

  const visCols = cols.filter(c => c.visible)

  const col = (key: string) => cols.find(c => c.key === key)

  const filtered = useMemo(() => {
    return customers.filter(c => {
      if (seg !== 'all' && (c.customerSegment ?? 'B2C') !== seg) return false
      if (search) {
        const q = search.toLowerCase()
        if (!c.name.toLowerCase().includes(q) &&
            !(c.phone ?? '').includes(q) &&
            !(c.companyName ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [customers, seg, search])

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* 툴바 */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-200 bg-slate-50 shrink-0 flex-wrap">
        {/* B2C/B2B 필터 */}
        <div className="flex gap-1">
          {(['all', 'B2C', 'B2B'] as Seg[]).map(s => (
            <button key={s} onClick={() => setSeg(s)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition
                ${seg === s
                  ? s === 'B2B' ? 'bg-violet-700 text-white' : s === 'B2C' ? 'bg-sky-600 text-white' : 'bg-slate-600 text-white'
                  : 'text-slate-400 hover:bg-slate-100'}`}>
              {s === 'all' ? '전체' : s === 'B2C' ? 'B2C 개인' : 'B2B 법인'}
            </button>
          ))}
        </div>

        {/* 검색 */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이름·연락처·회사명 검색"
          className="ml-auto text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-300 w-52"
        />

        {/* 컬럼 설정 버튼 */}
        <div className="relative">
          <button
            onClick={() => setSettingsOpen(v => !v)}
            title="컬럼 설정"
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition
              ${settingsOpen
                ? 'bg-slate-800 text-white border-slate-800'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            ⚙ 컬럼
          </button>
          {settingsOpen && (
            <ColSettingsPanel
              cols={cols}
              onChange={updateCols}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </div>

        {/* 신규 고객 추가 */}
        <Link href="/import"
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition">
          엑셀 일괄 등록
        </Link>
        <button onClick={() => setShowNew(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition">
          + 고객 추가
        </button>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            고객이 없습니다
          </div>
        ) : (
          <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              {visCols.map(c => (
                <col key={c.key} style={{ width: W_PX[c.width] }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {visCols.map(c => (
                  <th key={c.key}
                    className={`px-3 py-2.5 text-left truncate ${c.key === 'leads' || c.key === 'isAgent' || c.key === 'detail' ? 'text-center' : ''}`}>
                    {COL_DEFS.find(d => d.key === c.key)?.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(c => {
                const activeLeads = c.leads.filter(l => l.salesStatus === '진행중')
                const lastAct = c.activities[0]
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/customers/${c.id}`)}>
                    {visCols.map(vc => {
                      switch (vc.key) {
                        case 'name':
                          return (
                            <td key="name" className="px-3 py-2.5 truncate">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-semibold text-slate-800 truncate">{c.name}</span>
                                {(c.customerSegment ?? 'B2C') === 'B2B'
                                  ? <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-100 text-violet-700">법인</span>
                                  : <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-50 text-sky-600">개인</span>}
                              </div>
                            </td>
                          )
                        case 'phone':
                          return <td key="phone" className="px-3 py-2.5 text-slate-500 truncate">{c.phone ?? '—'}</td>
                        case 'segment':
                          return <td key="segment" className="px-3 py-2.5 text-slate-400 truncate">{c.customerSegment ?? 'B2C'}</td>
                        case 'companyName':
                          return <td key="companyName" className="px-3 py-2.5 text-slate-500 truncate">{c.companyName ?? '—'}</td>
                        case 'source':
                          return <td key="source" className="px-3 py-2.5 text-slate-400 truncate">{c.source ?? '—'}</td>
                        case 'collectedAt':
                          return <td key="collectedAt" className="px-3 py-2.5 text-slate-400">{fmtDate(c.collectedAt)}</td>
                        case 'assignee':
                          return <td key="assignee" className="px-3 py-2.5 text-slate-500 truncate">{c.assignee ?? '—'}</td>
                        case 'isAgent':
                          return (
                            <td key="isAgent" className="px-3 py-2.5 text-center">
                              {c.isAgent
                                ? <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700">소개인</span>
                                : <span className="text-slate-200">—</span>}
                            </td>
                          )
                        case 'leads':
                          return (
                            <td key="leads" className="px-3 py-2.5 text-center">
                              {activeLeads.length > 0
                                ? <span className="inline-block w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold leading-5 text-center">
                                    {activeLeads.length}
                                  </span>
                                : c.leads.length > 0
                                  ? <span className="text-slate-300">{c.leads.length}</span>
                                  : <span className="text-slate-200">—</span>}
                            </td>
                          )
                        case 'lastActivity':
                          return (
                            <td key="lastActivity" className="px-3 py-2.5 text-slate-400 truncate">
                              {lastAct
                                ? <span>{fmtDate(lastAct.date)} <span className="text-slate-300">{lastAct.type}</span></span>
                                : <span className="text-slate-200">—</span>}
                            </td>
                          )
                        case 'detail':
                          return (
                            <td key="detail" className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                              <Link href={`/customers/${c.id}`}
                                className="inline-block px-2.5 py-1 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
                                상세 →
                              </Link>
                            </td>
                          )
                        default:
                          return <td key={vc.key} />
                      }
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 신규 고객 추가 모달 */}
      {showNew && <NewCustomerModal onClose={() => setShowNew(false)} onCreated={c => { setCustomers(prev => [c, ...prev]); setShowNew(false) }} />}
    </div>
  )
}

/* ── 신규 고객 추가 모달 ── */
function NewCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Customer) => void }) {
  const router = useRouter()
  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [seg,     setSeg]     = useState<'B2C' | 'B2B'>('B2C')
  const [source,  setSource]  = useState('')
  const [company, setCompany] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  /* 기존 고객 중복 검색 */
  type DupHit = { id: string; name: string; phone: string | null; customerSegment: string | null }
  const [dupHits,   setDupHits]   = useState<DupHit[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const phoneQ = phone.replace(/\D/g, '')
    const nameQ  = name.trim()
    const isPhone = phoneQ.length >= 4
    const q    = isPhone ? phoneQ : nameQ
    const mode = isPhone ? 'phone' : 'name'
    if (q.length < 2) { setDupHits([]); return }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res  = await fetch(`/api/customers?q=${encodeURIComponent(q)}&mode=${mode}`)
        const list = await res.json()
        setDupHits(Array.isArray(list) ? list.slice(0, 3) : [])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [name, phone])

  const SOURCES = ['소개', '온라인', '전시장/이벤트', '직접방문', '기타']

  const handleSubmit = async () => {
    if (!name.trim()) { setError('고객명은 필수입니다.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:            name.trim(),
          phone:           phone    || null,
          customerSegment: seg,
          source:          source   || null,
          companyName:     company  || null,
          collectedAt:     new Date().toISOString(),
        }),
      })
      if (!res.ok) { const j = await res.json(); setError(j.error ?? '오류'); setSaving(false); return }
      const c = await res.json()
      onCreated({ ...c, leads: [], activities: [] })
    } catch {
      setError('네트워크 오류')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[380px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        <div className="shrink-0 px-6 pt-6 pb-5" style={{ background: 'linear-gradient(135deg,#1e293b 0%,#334155 100%)' }}>
          <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 transition text-xl leading-none">×</button>
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">신규 고객 등록</p>
          <p className="text-white font-bold text-lg">고객 기본 정보</p>
          <div className="flex gap-2 mt-4">
            {(['B2C', 'B2B'] as const).map(s => (
              <button key={s} onClick={() => setSeg(s)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${seg === s ? 'bg-white text-slate-800' : 'bg-white/15 text-white/70 hover:bg-white/25'}`}>
                {s === 'B2C' ? 'B2C 개인' : 'B2B 법인'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              {seg === 'B2B' ? '담당자 이름' : '고객 이름'} <span className="text-red-400">*</span>
            </label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              연락처
              {searching && <span className="ml-2 text-[10px] text-slate-400 font-normal">검색 중...</span>}
            </label>
            <input value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000"
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>

          {/* 기존 고객 중복 경고 */}
          {dupHits.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-700 mb-2">⚠ 이미 등록된 고객이 있습니다</p>
              <div className="space-y-1.5">
                {dupHits.map(c => (
                  <button key={c.id} type="button"
                    onClick={() => { onClose(); router.push(`/customers/${c.id}`) }}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-amber-200 hover:border-amber-400 transition text-left">
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-800 shrink-0">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800">{c.name}</p>
                      <p className="text-[10px] text-slate-400">{c.phone ?? '연락처 없음'} · {c.customerSegment ?? 'B2C'}</p>
                    </div>
                    <span className="text-[10px] text-amber-600 font-semibold shrink-0">보기 →</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-amber-500 mt-2">해당 고객이 아닌 경우 계속 입력하여 신규 등록하세요.</p>
            </div>
          )}

          {seg === 'B2B' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">회사명</label>
              <input value={company} onChange={e => setCompany(e.target.value)} placeholder="(주)회사명"
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            </div>
          )}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">유입 경로</label>
            <div className="flex gap-2 flex-wrap">
              {SOURCES.map(s => (
                <button key={s} type="button" onClick={() => setSource(source === s ? '' : s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition
                    ${source === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-slate-100 px-6 py-4 flex items-center justify-between bg-white">
          <button onClick={onClose} className="px-5 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">취소</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-6 py-2 text-sm font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-50">
            {saving ? '등록 중...' : '등록하기'}
          </button>
        </div>
      </div>
    </>
  )
}
