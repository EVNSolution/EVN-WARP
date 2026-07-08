'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Plus, Trash2, Info, ChevronUp, ChevronDown } from 'lucide-react'
import AssigneePicker from '@/components/AssigneePicker'

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

/* 숫자 문자열에 천단위 콤마 표시: "10000" → "10,000" */
function fmtComma(val: string): string {
  const n = parseInt(val.replace(/[^0-9]/g, ''), 10)
  return isNaN(n) ? '' : n.toLocaleString('ko-KR')
}
/* 입력값에서 숫자만 추출 (onChange용) */
function digitsOnly(val: string): string {
  return val.replace(/[^0-9]/g, '')
}


type Team       = { id: string; name: string }
type ParentTask = { id: string; code: string; title: string; teamId: string; strategy: string }
type MonthlyTarget = {
  month: number; year: number
  revenueTarget: string
  budget: string
  personnel: string
}
type Countermeasure = { index: number; description: string; startDate: string; endDate: string }
type KpiDraft = { type: '정량' | '정성'; subType: string; label: string; target: string; unit: string }

interface Props {
  teams: Team[]
  parentTasks: ParentTask[]
  ceoTeamId: string
  initial?: any
  mode: 'new' | 'edit'
}

const KPI_SUBTYPES = ['금액', '일자', '인원수', '건수', '대수', '비율', '기타'] as const
const FIXED_UNITS: Record<string, string> = { 인원수: '명', 건수: '건', 대수: '대', 비율: '%' }
const AMOUNT_UNITS = ['만원', '억원', '달러']

const STRATEGY_LABEL: Record<string, string> = {
  A: '전략과제 A — 확장과 성장',
  B: '전략과제 B — AI 기반 조직운영',
}
const STRATEGY_BADGE: Record<string, string> = {
  A: 'bg-indigo-100 text-indigo-700',
  B: 'bg-violet-100 text-violet-700',
}

const GANTT_COLORS = [
  'bg-indigo-500', 'bg-orange-500', 'bg-teal-500',
  'bg-violet-500', 'bg-green-500', 'bg-rose-500',
]

function initMonthly(year: number): MonthlyTarget[] {
  return MONTHS.map((_, i) => ({ month: i + 1, year, revenueTarget: '', budget: '', personnel: '' }))
}
function defaultKpi(): KpiDraft {
  return { type: '정량', subType: '금액', label: '', target: '', unit: '만원' }
}

// 폼 내 간트 미리보기
function GanttPreview({ taskStart, taskEnd, measures }: {
  taskStart: string; taskEnd: string; measures: Countermeasure[]
}) {
  const ts = taskStart ? new Date(taskStart).getTime() : null
  const te = taskEnd   ? new Date(taskEnd).getTime()   : null
  if (!ts || !te || te <= ts) return null
  const filled = measures.filter(m => m.startDate && m.endDate)
  if (filled.length === 0) return null
  const totalMs = te - ts
  return (
    <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-slate-500 mb-3">간트 미리보기</p>
      <div className="relative h-5 mb-2">
        {MONTHS.map((m, i) => {
          const ms = new Date(new Date(taskStart).getFullYear(), i, 1).getTime()
          if (ms < ts || ms > te) return null
          const pct = ((ms - ts) / totalMs) * 100
          return <span key={i} className="absolute text-[10px] text-slate-400" style={{ left: `${pct}%` }}>{m}</span>
        })}
      </div>
      <div className="h-px bg-slate-200 mb-2" />
      <div className="space-y-1.5">
        {filled.map((m, i) => {
          const ms = new Date(m.startDate).getTime()
          const me = new Date(m.endDate).getTime()
          const left  = Math.max(0, ((ms - ts) / totalMs) * 100)
          const width = Math.min(100 - left, ((me - ms) / totalMs) * 100)
          return (
            <div key={i} className="relative h-5">
              <div className="absolute inset-0 bg-slate-100 rounded" />
              <div className={`absolute h-5 rounded text-white text-[10px] flex items-center px-1.5 font-medium truncate ${GANTT_COLORS[i % GANTT_COLORS.length]}`}
                style={{ left: `${left}%`, width: `${Math.max(width, 3)}%` }}>
                {m.index}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function A3Form({ teams, parentTasks, ceoTeamId, initial, mode }: Props) {
  const router = useRouter()
  const year   = new Date().getFullYear()
  const selectableTeams = teams.filter(t => t.id !== ceoTeamId)

  const [form, setForm] = useState({
    strategy:         initial?.strategy         ?? '',
    title:            initial?.title            ?? '',
    teamId:           initial?.teamId           ?? (selectableTeams[0]?.id ?? ''),
    owner:            initial?.owner            ?? '',
    startDate:        initial?.startDate        ? initial.startDate.slice(0, 10) : '',
    endDate:          initial?.endDate          ? initial.endDate.slice(0, 10)   : '',
    status:           initial?.status           ?? '진행중',
    confirmed:        initial?.confirmed        ?? false,
    problemStatement: initial?.problemStatement ?? '',
    goalStatement:    initial?.goalStatement    ?? '',
    parentId:         initial?.parentId         ?? '',
  })

  const [kpiItems, setKpiItems] = useState<KpiDraft[]>(
    initial?.kpiItems?.length
      ? initial.kpiItems.map((k: any) => ({
          type: k.type ?? '정량', subType: k.subType ?? '',
          label: k.label ?? '', target: k.target ?? '', unit: k.unit ?? '',
        }))
      : []
  )

  const hasExistingMonthly = Boolean(
    initial?.monthlyTargets?.some((m: any) => m.revenueTarget || m.budget || m.personnel)
  )
  const [showMonthly, setShowMonthly] = useState(hasExistingMonthly)

  const [monthly, setMonthly] = useState<MonthlyTarget[]>(
    initial?.monthlyTargets?.length
      ? initial.monthlyTargets.map((m: any) => ({
          month: m.month, year: m.year,
          revenueTarget: m.revenueTarget?.toString() ?? '',
          budget:        m.budget?.toString()        ?? '',
          personnel:     m.personnel?.toString()     ?? '',
        }))
      : initMonthly(year)
  )

  const [measures, setMeasures] = useState<Countermeasure[]>(
    initial?.countermeasures?.length
      ? initial.countermeasures.map((c: any) => ({
          index: c.index, description: c.description,
          startDate: c.startDate ?? '', endDate: c.endDate ?? '',
        }))
      : [
          { index: 1, description: '', startDate: '', endDate: '' },
          { index: 2, description: '', startDate: '', endDate: '' },
          { index: 3, description: '', startDate: '', endDate: '' },
        ]
  )

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const isCeoTask      = form.teamId === ceoTeamId
  const selectedParent = parentTasks.find(p => p.id === form.parentId)

  function handleParentChange(parentId: string) {
    const parent = parentTasks.find(p => p.id === parentId)
    setForm(prev => ({ ...prev, parentId, strategy: parent?.strategy ?? prev.strategy }))
  }
  function setField(key: string, value: any) { setForm(prev => ({ ...prev, [key]: value })) }

  // ── KPI ─────────────────────────────────────────────────────────
  function addKpiItem()  { setKpiItems(prev => [...prev, defaultKpi()]) }
  function removeKpiItem(idx: number) { setKpiItems(prev => prev.filter((_, i) => i !== idx)) }
  function setKpiField(idx: number, key: keyof KpiDraft, val: string) {
    setKpiItems(prev => prev.map((k, i) => i === idx ? { ...k, [key]: val } : k))
  }
  function setKpiType(idx: number, type: '정량' | '정성') {
    setKpiItems(prev => prev.map((k, i) =>
      i === idx ? { ...k, type, subType: type === '정량' ? '금액' : '', unit: type === '정량' ? '만원' : '', target: '' } : k
    ))
  }
  function setKpiSubType(idx: number, subType: string) {
    const fixed = FIXED_UNITS[subType]
    setKpiItems(prev => prev.map((k, i) =>
      i === idx ? { ...k, subType, unit: subType === '금액' ? '만원' : fixed ?? '' } : k
    ))
  }

  // ── 실행안 ───────────────────────────────────────────────────────
  function setMeasureField(idx: number, key: keyof Countermeasure, val: string | number) {
    setMeasures(prev => prev.map((m, i) => i === idx ? { ...m, [key]: val } : m))
  }
  function addMeasure() {
    setMeasures(prev => [...prev, { index: prev.length + 1, description: '', startDate: '', endDate: '' }])
  }
  function removeMeasure(idx: number) {
    setMeasures(prev => prev.filter((_, i) => i !== idx).map((m, i) => ({ ...m, index: i + 1 })))
  }
  function moveMeasure(idx: number, dir: 'up' | 'down') {
    setMeasures(prev => {
      const next = [...prev]
      const target = dir === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next.map((m, i) => ({ ...m, index: i + 1 }))
    })
  }

  // ── 월별 ─────────────────────────────────────────────────────────
  function setMonthlyField(idx: number, key: keyof MonthlyTarget, val: string) {
    setMonthly(prev => prev.map((m, i) => i === idx ? { ...m, [key]: val } : m))
  }

  // ── 저장 ─────────────────────────────────────────────────────────
  async function handleSave() {
    if (!isCeoTask && !form.parentId) {
      setError('상위 전략과제(A 또는 B)를 선택해주세요')
      return
    }
    if (!form.title || !form.teamId || !form.owner || !form.startDate || !form.endDate) {
      setError('필수 항목을 모두 입력해주세요 (과제명, 담당 팀, 담당자, 기간)')
      return
    }
    setSaving(true); setError('')
    try {
      const toNum = (v: string) => v ? parseFloat(v) : null
      const toInt = (v: string) => v ? parseInt(v)   : null

      const payload = {
        ...form,
        parentId: form.parentId || null,
        kpiItems: kpiItems.filter(k => k.label).map((k, i) => {
          const numTypes = ['금액', '인원수', '건수', '대수', '비율']
          const targetNum = (k.type === '정량' && numTypes.includes(k.subType) && k.target)
            ? parseFloat(k.target.replace(/,/g, '')) : null
          return {
            index: i + 1, type: k.type,
            subType: k.type === '정량' ? (k.subType || null) : null,
            label: k.label, target: k.target, targetNum,
            unit: k.unit || null,
          }
        }),
        monthlyTargets: showMonthly
          ? monthly.map(m => ({
              month: m.month, year: m.year,
              revenueTarget: toNum(m.revenueTarget),
              budget:        toNum(m.budget),
              personnel:     toInt(m.personnel),
            }))
          : [],
        countermeasures: measures
          .filter(m => m.description)
          .map(m => ({ ...m, startDate: m.startDate || null, endDate: m.endDate || null })),
      }

      const url    = mode === 'new' ? '/api/a3' : `/api/a3/${initial.id}`
      const method = mode === 'new' ? 'POST' : 'PUT'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

      if (!res.ok) {
        let msg = '저장 실패'
        try { const d = await res.json(); msg = d.error ?? msg } catch {}
        throw new Error(msg)
      }
      const saved = await res.json()
      router.push(`/a3/${saved.id}`)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── 렌더 ────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-5xl">

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === 'new' ? '새 전략과제 등록' : '전략과제 수정'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'new' ? '과제 코드는 등록 시 자동으로 부여됩니다' : `과제 코드: ${initial?.code}`}
          </p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          <Save size={16} />
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* ══ 기본 정보 ══════════════════════════════════════════════ */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
        <h2 className="text-base font-semibold text-slate-800 mb-5">기본 정보</h2>
        <div className="grid grid-cols-2 gap-4">

          {/* 상위 전략과제 */}
          {!isCeoTask && (
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                상위 전략과제 <span className="text-red-500">*</span>
              </label>
              {mode === 'new' ? (
                <>
                  <select value={form.parentId} onChange={e => handleParentChange(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">— 전략과제를 선택하세요 —</option>
                    {parentTasks.map(p => (
                      <option key={p.id} value={p.id}>{STRATEGY_LABEL[p.strategy] ?? `${p.code} · ${p.title}`}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1">
                    <Info size={11} /> 모든 과제는 전략과제 A 또는 B의 하부과제로 등록됩니다
                  </p>
                  {form.parentId && form.strategy && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STRATEGY_BADGE[form.strategy] ?? 'bg-slate-100 text-slate-600'}`}>
                        전략과제 {form.strategy}
                      </span>
                      <span className="text-sm text-slate-600">{STRATEGY_LABEL[form.strategy]}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                  {selectedParent ? (
                    <>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STRATEGY_BADGE[selectedParent.strategy] ?? 'bg-slate-100 text-slate-600'}`}>
                        전략과제 {selectedParent.strategy}
                      </span>
                      <span className="text-sm text-slate-700">{selectedParent.title}</span>
                    </>
                  ) : <span className="text-sm text-slate-400">상위 과제 없음</span>}
                </div>
              )}
            </div>
          )}

          {/* 담당 팀 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">담당 팀 <span className="text-red-500">*</span></label>
            <select value={form.teamId} onChange={e => setField('teamId', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              {(isCeoTask ? teams : selectableTeams).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {isCeoTask && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">전략과제 구분 <span className="text-red-500">*</span></label>
              <select value={form.strategy} onChange={e => setField('strategy', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="A">전략과제 A — 확장과 성장</option>
                <option value="B">전략과제 B — AI 기반 조직운영</option>
              </select>
            </div>
          )}

          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">과제명 <span className="text-red-500">*</span></label>
            <input value={form.title} onChange={e => setField('title', e.target.value)}
              placeholder="예: 신규 SI 고객 확보 — 식자재·의약품 라인"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">과제 오너 <span className="text-red-500">*</span></label>
            <AssigneePicker value={form.owner} onChange={v => setField('owner', v)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">상태</label>
            <select value={form.status} onChange={e => setField('status', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              {['진행중','완료','보류','지연'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">시작일 <span className="text-red-500">*</span></label>
            <input type="date" value={form.startDate} onChange={e => setField('startDate', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">목표 기한 <span className="text-red-500">*</span></label>
            <input type="date" value={form.endDate} onChange={e => setField('endDate', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.confirmed} onChange={e => setField('confirmed', e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600" />
              위원회 확정 완료
            </label>
          </div>
        </div>
      </section>

      {/* ══ KPI 설정 ════════════════════════════════════════════════ */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-base font-semibold text-slate-800">KPI 설정</h2>
            <p className="text-xs text-slate-400 mt-0.5">정량 KPI의 금액 항목은 경영 대시보드에 자동 집계됩니다</p>
          </div>
          <button onClick={addKpiItem} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            <Plus size={15} /> KPI 추가
          </button>
        </div>
        {kpiItems.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-lg py-6 text-center mt-4">
            <p className="text-sm text-slate-400">KPI가 없습니다.</p>
            <button onClick={addKpiItem} className="mt-2 text-sm text-indigo-500 hover:text-indigo-700 font-medium">+ KPI 추가</button>
          </div>
        ) : (
          <div className="space-y-2 mt-4">
            {kpiItems.map((kpi, i) => (
              <div key={i} className="flex gap-2 items-start bg-slate-50 rounded-lg p-3">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0 mt-2">{i+1}</span>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <select value={kpi.type} onChange={e => setKpiType(i, e.target.value as '정량'|'정성')}
                      className="w-20 border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                      <option value="정량">정량</option><option value="정성">정성</option>
                    </select>
                    {kpi.type === '정량' && (
                      <select value={kpi.subType} onChange={e => setKpiSubType(i, e.target.value)}
                        className="w-24 border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                        <option value="">유형 선택</option>
                        {KPI_SUBTYPES.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                    )}
                    {kpi.type === '정량' && kpi.subType === '금액' && (
                      <select value={kpi.unit} onChange={e => setKpiField(i, 'unit', e.target.value)}
                        className="w-20 border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                        {AMOUNT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    )}
                    {kpi.type === '정량' && kpi.subType === '기타' && (
                      <input value={kpi.unit} onChange={e => setKpiField(i, 'unit', e.target.value)} placeholder="단위"
                        className="w-20 border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    )}
                    {kpi.type === '정량' && FIXED_UNITS[kpi.subType] && (
                      <span className="flex items-center px-2 text-sm text-slate-500 font-medium bg-slate-100 border border-slate-200 rounded-md">{FIXED_UNITS[kpi.subType]}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input value={kpi.label} onChange={e => setKpiField(i, 'label', e.target.value)}
                      placeholder={kpi.type === '정량' ? 'KPI 항목명 (예: 월매출 증가분)' : '성과 항목명'}
                      className="flex-1 border border-slate-200 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    {kpi.type === '정량' ? (() => {
                      const useComma = ['금액', '인원수', '건수', '대수'].includes(kpi.subType)
                      return (
                        <input
                          value={useComma ? fmtComma(kpi.target) : kpi.target}
                          onChange={e => setKpiField(i, 'target', useComma ? digitsOnly(e.target.value) : e.target.value)}
                          placeholder={kpi.subType === '일자' ? 'YYYY-MM-DD' : '목표값'}
                          type={kpi.subType === '일자' ? 'date' : 'text'}
                          inputMode={useComma ? 'numeric' : undefined}
                          className="w-36 border border-slate-200 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      )
                    })() : (
                      <input value={kpi.target} onChange={e => setKpiField(i, 'target', e.target.value)}
                        placeholder="달성 내용 (정성적 기술)"
                        className="flex-1 border border-slate-200 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    )}
                  </div>
                </div>
                <button onClick={() => removeKpiItem(i)} className="text-slate-300 hover:text-red-400 transition-colors mt-2 shrink-0"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ══ 1. 문제와 목표 ══════════════════════════════════════════ */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
        <h2 className="text-base font-semibold text-slate-800 mb-1">1. 문제와 목표</h2>
        <p className="text-xs text-slate-400 mb-5">정량 수치를 포함하여 작성하세요</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">문제 (정량)</label>
            <textarea value={form.problemStatement} onChange={e => setField('problemStatement', e.target.value)}
              rows={3} placeholder="예: 물류 SI 매출 비중 88% (월평균 5,000만원). 식자재·의약품 영역 확장 부재 시 연 KR 130억 대비 –14억 미달 예상."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">달성 목표 (정량)</label>
            <textarea value={form.goalStatement} onChange={e => setField('goalStatement', e.target.value)}
              rows={3} placeholder="예: 2026-06-30까지 신규 본계약 2건, 월매출 +2,000만원."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>
        </div>
      </section>

      {/* ══ 2. 대책과 실행안 ════════════════════════════════════════ */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">2. 대책과 실행안</h2>
            <p className="text-xs text-slate-400 mt-0.5">기간을 설정하면 간트 미리보기가 자동 표시됩니다</p>
          </div>
          <button onClick={addMeasure} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            <Plus size={15} /> 실행안 추가
          </button>
        </div>

        {/* 컬럼 헤더 */}
        <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-3 mb-1">
          <span className="w-6" />
          <div className="grid grid-cols-[3fr_2fr] gap-3">
            <span className="text-xs text-slate-400 font-medium">실행안 내용</span>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-xs text-slate-400 font-medium">시작일</span>
              <span className="text-xs text-slate-400 font-medium">완료일</span>
            </div>
          </div>
          <span className="w-5" />
        </div>

        <div className="space-y-2">
          {measures.map((m, i) => (
            <div key={i} className="flex gap-3 items-start bg-slate-50 rounded-lg p-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-2 text-white ${GANTT_COLORS[i % GANTT_COLORS.length]}`}>
                {m.index}
              </span>
              <div className="flex-1 grid grid-cols-[3fr_2fr] gap-3">
                <textarea value={m.description} onChange={e => setMeasureField(i, 'description', e.target.value)}
                  placeholder="실행안 내용을 입력하세요" rows={2}
                  className="border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                <div className="grid grid-cols-2 gap-2 items-start">
                  <input type="date" value={m.startDate} onChange={e => setMeasureField(i, 'startDate', e.target.value)}
                    className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <input type="date" value={m.endDate} onChange={e => setMeasureField(i, 'endDate', e.target.value)}
                    className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
                <button
                  onClick={() => moveMeasure(i, 'up')}
                  disabled={i === 0}
                  className="text-slate-300 hover:text-indigo-400 disabled:opacity-20 transition-colors"
                  title="위로"
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  onClick={() => moveMeasure(i, 'down')}
                  disabled={i === measures.length - 1}
                  className="text-slate-300 hover:text-indigo-400 disabled:opacity-20 transition-colors"
                  title="아래로"
                >
                  <ChevronDown size={15} />
                </button>
                {measures.length > 1 && (
                  <button onClick={() => removeMeasure(i)} className="text-slate-300 hover:text-red-400 transition-colors" title="삭제">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <GanttPreview taskStart={form.startDate} taskEnd={form.endDate} measures={measures} />
      </section>

      {/* ══ 3. 월별 목표 및 리소스 ══════════════════════════════════ */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-slate-800">3. 월별 목표 및 리소스 ({year}년)</h2>
          {!showMonthly ? (
            <button onClick={() => setShowMonthly(true)}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              <Plus size={15} /> 월별 목표 추가
            </button>
          ) : (
            <button onClick={() => setShowMonthly(false)}
              className="text-xs text-slate-400 hover:text-slate-600">
              접기
            </button>
          )}
        </div>
        {!showMonthly ? (
          <p className="text-xs text-slate-400 mt-1">월별 매출목표 및 필요인력을 입력하려면 위 버튼을 클릭하세요.</p>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-2 font-medium text-slate-500 w-12 sticky left-0 bg-white">월</th>
                  <th className="text-center py-2 px-2 font-medium text-slate-500 min-w-[110px]">매출목표<br/><span className="text-xs font-normal">(만원)</span></th>
                  <th className="text-center py-2 px-2 font-medium text-slate-500 min-w-[110px]">예산<br/><span className="text-xs font-normal">(만원)</span></th>
                  <th className="text-center py-2 px-2 font-medium text-slate-500 min-w-[80px]">필요인력<br/><span className="text-xs font-normal">(명)</span></th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-1.5 pr-2 font-medium text-slate-600 sticky left-0 bg-white">{MONTHS[i]}</td>
                    <td className="py-1.5 px-2">
                      <input type="text" inputMode="numeric" value={fmtComma(m.revenueTarget)}
                        onChange={e => setMonthlyField(i, 'revenueTarget', digitsOnly(e.target.value))} placeholder="-"
                        className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="text" inputMode="numeric" value={fmtComma(m.budget)}
                        onChange={e => setMonthlyField(i, 'budget', digitsOnly(e.target.value))} placeholder="-"
                        className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" value={m.personnel}
                        onChange={e => setMonthlyField(i, 'personnel', e.target.value)} placeholder="-"
                        className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 저장 버튼 */}
      <div className="flex justify-end gap-3">
        <button onClick={() => router.back()}
          className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50">
          취소
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          <Save size={16} />
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
