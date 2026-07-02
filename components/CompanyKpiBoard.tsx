'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronDown, ChevronUp, Trash2, Edit2, Check, X, XCircle, Filter } from 'lucide-react'

const CATEGORIES = ['재무', '영업', '운영'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_COLOR: Record<Category, { bg: string; text: string; border: string; badge: string }> = {
  재무: { bg: 'bg-blue-50',    text: 'text-blue-800',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700' },
  영업: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  운영: { bg: 'bg-violet-50',  text: 'text-violet-800',  border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-700' },
}
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

interface Entry { id?: string; year: number; month: number; target: number | null; actual: number | null; memo: string | null }
interface KpiItem {
  id: string; year: number; label: string; unit: string | null
  category: string; index: number; annualTarget: number | null
  linkedToFunnel: boolean
  entries: Entry[]
}

function fmt(v: number | null | undefined, digits = 1) {
  if (v == null) return ''
  return v % 1 === 0 ? v.toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
function parseNum(s: string) {
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) ? null : n
}

export default function CompanyKpiBoard({ kpis: initial, year, onClose }: { kpis: KpiItem[]; year: number; onClose?: () => void }) {
  const router = useRouter()
  const [kpis, setKpis] = useState<KpiItem[]>(initial)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'전체' | Category>('전체')
  const [showAdd, setShowAdd] = useState(false)
  const [editingKpi, setEditingKpi] = useState<string | null>(null)

  /* 추가 폼 상태 */
  const [addForm, setAddForm] = useState({ label: '', unit: '', category: '재무' as Category, annualTarget: '' })
  /* 편집 폼 상태 */
  const [editForm, setEditForm] = useState({ label: '', unit: '', category: '재무' as Category, annualTarget: '' })

  /* 셀 편집: "kpiId-month-field" → 입력 중인 값 */
  const [cellDraft, setCellDraft] = useState<Record<string, string>>({})
  const savingRef = useRef<Set<string>>(new Set())

  const filtered = activeTab === '전체' ? kpis : kpis.filter(k => k.category === activeTab)

  /* 셀 키 */
  const ck = (kpiId: string, month: number, field: 'target' | 'actual') => `${kpiId}-${month}-${field}`

  /* 셀 현재값 */
  function cellVal(kpi: KpiItem, month: number, field: 'target' | 'actual') {
    return kpi.entries.find(e => e.month === month)?.[field] ?? null
  }

  /* 연간 집계 */
  function annual(kpi: KpiItem) {
    const totalActual  = kpi.entries.reduce((s, e) => s + (e.actual  ?? 0), 0)
    const totalTarget  = kpi.entries.reduce((s, e) => s + (e.target  ?? 0), 0)
    const base         = kpi.annualTarget ?? (totalTarget > 0 ? totalTarget : null)
    const rate         = base && totalActual > 0 ? Math.round(totalActual / base * 100) : null
    return { totalActual, totalTarget, base, rate }
  }

  /* 셀 저장 */
  async function saveCell(kpi: KpiItem, month: number, field: 'target' | 'actual') {
    const key   = ck(kpi.id, month, field)
    const draft = cellDraft[key]
    if (draft === undefined) return
    if (savingRef.current.has(key)) return
    savingRef.current.add(key)

    const val = draft.trim() === '' ? null : parseNum(draft)
    await fetch(`/api/company-kpi/${kpi.id}/entry`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, [field]: val }),
    })

    /* 로컬 상태 업데이트 */
    setKpis(prev => prev.map(k => {
      if (k.id !== kpi.id) return k
      const exists = k.entries.find(e => e.month === month)
      const entries = exists
        ? k.entries.map(e => e.month === month ? { ...e, [field]: val } : e)
        : [...k.entries, { year, month, target: null, actual: null, memo: null, [field]: val }]
      return { ...k, entries }
    }))
    setCellDraft(prev => { const n = { ...prev }; delete n[key]; return n })
    savingRef.current.delete(key)
  }

  /* KPI 추가 */
  async function handleAdd() {
    if (!addForm.label.trim()) return
    const res = await fetch('/api/company-kpi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year, label: addForm.label.trim(), unit: addForm.unit.trim() || null,
        category: addForm.category, annualTarget: parseNum(addForm.annualTarget),
        index: kpis.filter(k => k.category === addForm.category).length,
      }),
    })
    const created = await res.json()
    setKpis(prev => [...prev, { ...created, entries: [] }])
    setAddForm({ label: '', unit: '', category: '재무', annualTarget: '' })
    setShowAdd(false)
    setExpanded(prev => new Set([...prev, created.id]))
  }

  /* KPI 수정 저장 */
  async function handleEditSave(kpiId: string) {
    await fetch(`/api/company-kpi/${kpiId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: editForm.label.trim(), unit: editForm.unit.trim() || null,
        category: editForm.category, annualTarget: parseNum(editForm.annualTarget),
      }),
    })
    setKpis(prev => prev.map(k => k.id !== kpiId ? k : {
      ...k, label: editForm.label.trim(), unit: editForm.unit.trim() || null,
      category: editForm.category, annualTarget: parseNum(editForm.annualTarget),
    }))
    setEditingKpi(null)
  }

  /* KPI 삭제 */
  async function handleDelete(kpiId: string) {
    if (!confirm('이 KPI 항목을 삭제하시겠습니까?')) return
    await fetch(`/api/company-kpi/${kpiId}`, { method: 'DELETE' })
    setKpis(prev => prev.filter(k => k.id !== kpiId))
  }

  /* 영업퍼널 연동 토글 */
  async function handleToggleFunnel(kpiId: string, current: boolean) {
    const next = !current
    await fetch(`/api/company-kpi/${kpiId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedToFunnel: next }),
    })
    // 단일 선택: 전체 해제 후 해당만 활성화
    setKpis(prev => prev.map(k => ({
      ...k,
      linkedToFunnel: k.id === kpiId ? next : (next ? false : k.linkedToFunnel),
    })))
  }

  /* 달성률 색상 */
  function rateColor(rate: number | null) {
    if (rate == null) return 'text-slate-400'
    if (rate >= 100) return 'text-emerald-600'
    if (rate >= 80)  return 'text-indigo-600'
    if (rate >= 60)  return 'text-amber-600'
    return 'text-red-500'
  }
  function barColor(rate: number | null) {
    if (rate == null) return 'bg-slate-200'
    if (rate >= 100) return 'bg-emerald-400'
    if (rate >= 80)  return 'bg-indigo-400'
    if (rate >= 60)  return 'bg-amber-400'
    return 'bg-red-400'
  }

  return (
    <div className="p-6" style={{ maxWidth: '1400px' }}>

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">전사 KPI 관리</h1>
          <p className="text-sm text-slate-400 mt-0.5">{year}년 · 월별 목표 및 실적 입력</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setShowAdd(true); setEditingKpi(null) }}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm">
            <Plus size={14} /> KPI 추가
          </button>
          {onClose && (
            <button onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 border border-slate-200 hover:bg-slate-50">
              <XCircle size={15} /> 닫기
            </button>
          )}
        </div>
      </div>

      {/* ── KPI 추가 폼 ── */}
      {showAdd && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-5">
          <p className="text-sm font-bold text-indigo-800 mb-3">새 KPI 항목 추가</p>
          <div className="grid grid-cols-5 gap-3">
            <input value={addForm.label} onChange={e => setAddForm(p => ({ ...p, label: e.target.value }))}
              placeholder="KPI 항목명 (예: 연간 매출액)" onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="col-span-2 border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <input value={addForm.unit} onChange={e => setAddForm(p => ({ ...p, unit: e.target.value }))}
              placeholder="단위 (억원, 대, 건…)"
              className="border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <select value={addForm.category} onChange={e => setAddForm(p => ({ ...p, category: e.target.value as Category }))}
              className="border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={addForm.annualTarget} onChange={e => setAddForm(p => ({ ...p, annualTarget: e.target.value }))}
              placeholder="연간 목표 (숫자)" inputMode="numeric"
              className="border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleAdd}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700">
              <Check size={13} /> 추가
            </button>
            <button onClick={() => setShowAdd(false)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm border border-slate-300 text-slate-600 hover:bg-slate-50">
              <X size={13} /> 취소
            </button>
          </div>
        </div>
      )}

      {/* ── 카테고리 탭 ── */}
      <div className="flex gap-0 mb-5 border-b border-slate-200">
        {(['전체', ...CATEGORIES] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {tab}
            <span className="ml-1.5 text-xs font-medium text-slate-400">
              {tab === '전체' ? kpis.length : kpis.filter(k => k.category === tab).length}
            </span>
          </button>
        ))}
      </div>

      {/* ── KPI 목록 ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-slate-400 text-sm mb-2">등록된 KPI가 없습니다.</p>
          <button onClick={() => setShowAdd(true)} className="text-indigo-500 text-sm hover:underline">+ KPI 추가</button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(kpi => {
            const { totalActual, base, rate } = annual(kpi)
            const isExpanded  = expanded.has(kpi.id)
            const isEditing   = editingKpi === kpi.id
            const catColor    = CATEGORY_COLOR[kpi.category as Category] ?? CATEGORY_COLOR['재무']
            const currentMonth = new Date().getFullYear() === year ? new Date().getMonth() + 1 : 12

            return (
              <div key={kpi.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

                {/* ── KPI 헤더 행 ── */}
                <div className={`px-5 py-4 ${isExpanded ? 'border-b border-slate-100' : ''}`}>
                  {isEditing ? (
                    /* 편집 모드 */
                    <div className="space-y-3">
                      <div className="grid grid-cols-5 gap-3">
                        <input value={editForm.label} onChange={e => setEditForm(p => ({ ...p, label: e.target.value }))}
                          className="col-span-2 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        <input value={editForm.unit} onChange={e => setEditForm(p => ({ ...p, unit: e.target.value }))}
                          placeholder="단위"
                          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        <select value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value as Category }))}
                          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input value={editForm.annualTarget} onChange={e => setEditForm(p => ({ ...p, annualTarget: e.target.value }))}
                          placeholder="연간 목표" inputMode="numeric"
                          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditSave(kpi.id)}
                          className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-indigo-700">
                          <Check size={12} /> 저장
                        </button>
                        <button onClick={() => setEditingKpi(null)}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs border border-slate-300 text-slate-600 hover:bg-slate-50">
                          <X size={12} /> 취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 표시 모드 */
                    <div className="flex items-center gap-4">
                      <button onClick={() => setExpanded(prev => {
                        const n = new Set(prev)
                        n.has(kpi.id) ? n.delete(kpi.id) : n.add(kpi.id)
                        return n
                      })} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        {isExpanded ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${catColor.badge}`}>{kpi.category}</span>
                        <span className="font-semibold text-slate-800 text-sm">{kpi.label}</span>
                        {kpi.unit && <span className="text-xs text-slate-400">({kpi.unit})</span>}
                      </button>

                      {/* 연간 진행 요약 */}
                      <div className="flex items-center gap-6 shrink-0">
                        {base != null && (
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400">연간 목표</p>
                            <p className="text-sm font-bold text-slate-700">{fmt(base)}{kpi.unit ? ` ${kpi.unit}` : ''}</p>
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">YTD 실적</p>
                          <p className="text-sm font-bold text-slate-700">{totalActual > 0 ? fmt(totalActual) : '—'}{kpi.unit && totalActual > 0 ? ` ${kpi.unit}` : ''}</p>
                        </div>
                        <div className="text-right w-20">
                          <p className="text-[10px] text-slate-400">달성률</p>
                          <p className={`text-lg font-bold tabular-nums ${rateColor(rate)}`}>{rate != null ? `${rate}%` : '—'}</p>
                        </div>
                        {/* 달성 바 */}
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor(rate)}`}
                            style={{ width: `${Math.min(rate ?? 0, 100)}%` }} />
                        </div>
                        {/* 영업퍼널 연동 토글 */}
                        <button
                          onClick={() => handleToggleFunnel(kpi.id, kpi.linkedToFunnel)}
                          title={kpi.linkedToFunnel ? '영업퍼널 연동 해제' : '영업퍼널 판매목표로 연동'}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                            kpi.linkedToFunnel
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
                          }`}>
                          <Filter size={11} />
                          {kpi.linkedToFunnel ? '퍼널 연동중' : '퍼널 연동'}
                        </button>
                        {/* 편집/삭제 */}
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingKpi(kpi.id); setEditForm({ label: kpi.label, unit: kpi.unit ?? '', category: kpi.category as Category, annualTarget: kpi.annualTarget != null ? String(kpi.annualTarget) : '' }) }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDelete(kpi.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── 월별 입력 테이블 (펼침) ── */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" style={{ minWidth: '900px' }}>
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100">
                          <th className="text-left pl-5 py-2 font-semibold text-slate-500 w-20">구분</th>
                          {MONTHS.map((m, i) => (
                            <th key={i} className={`text-center py-2 font-semibold w-20 ${
                              i + 1 === currentMonth ? 'text-indigo-600 bg-indigo-50/60' : 'text-slate-400'
                            }`}>{m}</th>
                          ))}
                          <th className="text-center py-2 font-semibold text-slate-600 w-24 pr-4">합계</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(['target', 'actual'] as const).map(field => {
                          const rowTotal = Array.from({ length: 12 }, (_, i) => cellVal(kpi, i + 1, field) ?? 0).reduce((a, b) => a + b, 0)
                          const rowLabel = field === 'target' ? '목표' : '실적'
                          const rowColor = field === 'target' ? 'text-slate-600' : 'text-indigo-700'

                          return (
                            <tr key={field} className={`border-b border-slate-50 ${field === 'actual' ? 'bg-indigo-50/20' : ''}`}>
                              <td className={`pl-5 py-2 font-semibold text-xs ${rowColor}`}>{rowLabel}</td>
                              {Array.from({ length: 12 }, (_, i) => {
                                const month   = i + 1
                                const key     = ck(kpi.id, month, field)
                                const stored  = cellVal(kpi, month, field)
                                const isDraft = key in cellDraft
                                const displayVal = isDraft ? cellDraft[key] : (stored != null ? fmt(stored) : '')
                                const isCurrent  = month === currentMonth

                                return (
                                  <td key={month} className={`py-1.5 px-1 text-center ${isCurrent ? 'bg-indigo-50/40' : ''}`}>
                                    <input
                                      type="text" inputMode="numeric"
                                      value={displayVal}
                                      onFocus={() => setCellDraft(prev => ({ ...prev, [key]: stored != null ? String(stored) : '' }))}
                                      onChange={e => setCellDraft(prev => ({ ...prev, [key]: e.target.value }))}
                                      onBlur={() => saveCell(kpi, month, field)}
                                      onKeyDown={e => e.key === 'Enter' && (e.currentTarget.blur())}
                                      placeholder="—"
                                      className={`w-full text-center text-xs px-1 py-1 rounded border transition-colors outline-none
                                        ${isDraft
                                          ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                                          : 'border-transparent hover:border-slate-200 focus:border-indigo-300 focus:bg-indigo-50'
                                        }
                                        ${field === 'actual' ? 'font-semibold' : ''}
                                        placeholder:text-slate-200`}
                                    />
                                  </td>
                                )
                              })}
                              {/* 합계 */}
                              <td className="text-center py-2 pr-4 font-bold text-slate-700 text-xs">
                                {rowTotal > 0 ? fmt(rowTotal) : '—'}
                              </td>
                            </tr>
                          )
                        })}

                        {/* 달성률 행 */}
                        <tr className="bg-slate-50/60">
                          <td className="pl-5 py-2 font-semibold text-xs text-slate-500">달성률</td>
                          {Array.from({ length: 12 }, (_, i) => {
                            const month  = i + 1
                            const tgt    = cellVal(kpi, month, 'target')
                            const act    = cellVal(kpi, month, 'actual')
                            const mRate  = tgt && act != null ? Math.round(act / tgt * 100) : null
                            return (
                              <td key={month} className={`text-center py-2 text-xs font-semibold tabular-nums ${rateColor(mRate)}`}>
                                {mRate != null ? `${mRate}%` : <span className="text-slate-200">—</span>}
                              </td>
                            )
                          })}
                          <td className={`text-center py-2 pr-4 text-xs font-bold tabular-nums ${rateColor(rate)}`}>
                            {rate != null ? `${rate}%` : '—'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
