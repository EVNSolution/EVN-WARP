'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Phone, Search, X, Check, ChevronDown } from 'lucide-react'
import { PIPELINE, getStageCode } from '@/lib/pipeline'

/* ── 스테이지 메타 ── */
const STAGE_NAME: Record<string, string> = {}
const STAGE_COLOR: Record<string, string> = {}
const PHASE_COLOR: Record<number, string> = {
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-purple-100 text-purple-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-teal-100 text-teal-700',
}
for (const ph of PIPELINE) {
  for (const pr of ph.processes) {
    STAGE_NAME[pr.code]  = pr.name
    STAGE_COLOR[pr.code] = PHASE_COLOR[ph.phase] ?? 'bg-gray-100 text-gray-500'
  }
}
STAGE_NAME['이탈'] = '이탈'; STAGE_COLOR['이탈'] = 'bg-red-100 text-red-600'

const STAGE_ITEMS = [
  { value: 'all', label: '전체 단계' },
  ...PIPELINE.flatMap(ph => ph.processes.map(pr => ({ value: pr.code, label: pr.name }))),
  { value: '이탈', label: '이탈' },
]

const CT_ITEMS = [
  { value: 'B2B', label: 'B2B (법인)' },
  { value: 'B2C', label: 'B2C (개인)' },
]

type Deal = {
  id: string
  name: string
  phone: string | null
  assignee: string | null
  stageCode: string | null
  stage: string | null
  salesStatus: string | null
  customerType: string | null
  customer: { phone: string | null } | null
}

interface Props {
  deals: Deal[]
  assignees: string[]
  isAdmin: boolean
  myName: string
}

/* ══════════════════════════════════════════
   공용 바텀 시트 (단일/멀티 선택 모두 지원)
   ══════════════════════════════════════════ */
interface SheetItem { value: string; label: string }

function FilterSheet({
  title,
  items,
  selected,         // 멀티: Set<string> / 단일: string
  multi = true,
  searchable = false,
  onClose,
  onApply,
}: {
  title: string
  items: SheetItem[]
  selected: Set<string> | string
  multi?: boolean
  searchable?: boolean
  onClose: () => void
  onApply: (next: Set<string> | string) => void
}) {
  const isMulti = multi

  /* 내부 상태 */
  const initSet = isMulti
    ? new Set(selected as Set<string>)
    : new Set<string>()
  const [local,  setLocal]  = useState<Set<string>>(initSet)
  const [single, setSingle] = useState<string>(isMulti ? '' : (selected as string))
  const [search, setSearch] = useState('')

  const visible = searchable
    ? items.filter(i => i.label.includes(search))
    : items

  const allSel = isMulti && local.size === items.length

  function toggleMulti(val: string) {
    setLocal(prev => {
      const next = new Set(prev)
      next.has(val) ? next.delete(val) : next.add(val)
      return next
    })
  }

  function toggleAll() {
    setLocal(allSel ? new Set() : new Set(items.map(i => i.value)))
  }

  function apply() {
    if (isMulti) onApply(local)
    else         onApply(single)
    onClose()
  }

  const applyLabel = isMulti
    ? local.size === 0 ? '전체 보기' : `${local.size}개 선택 적용`
    : '적용'

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-2xl flex flex-col max-h-[75vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
          <span className="text-sm font-bold text-gray-900">{title}</span>
          <button onClick={onClose} className="text-gray-400 p-1"><X size={18} /></button>
        </div>

        {/* 검색 (선택) */}
        {searchable && (
          <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0 relative">
            <Search size={14} className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-7 pr-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
        )}

        {/* 전체 선택 (멀티만) */}
        {isMulti && !search && (
          <button onClick={toggleAll}
            className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700 active:bg-gray-50 flex-shrink-0">
            <Checkbox checked={allSel} />
            전체 선택 ({items.length}개)
          </button>
        )}

        {/* 목록 */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
          {visible.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">검색 결과 없음</div>
          )}
          {visible.map(item => {
            const checked = isMulti ? local.has(item.value) : single === item.value
            return (
              <button key={item.value}
                onClick={() => isMulti ? toggleMulti(item.value) : setSingle(item.value)}
                className={`flex items-center gap-3 w-full px-4 py-3 text-sm active:bg-gray-50 transition-colors
                  ${!isMulti && checked ? 'bg-blue-50' : ''}`}>
                {isMulti
                  ? <Checkbox checked={checked} />
                  : <Radio checked={checked} />
                }
                <span className={`font-medium ${checked ? 'text-blue-700' : 'text-gray-800'}`}>{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* 적용 */}
        <div className="px-4 pt-3 pb-8 border-t border-gray-100 flex-shrink-0">
          <button onClick={apply}
            className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-bold">
            {applyLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
      ${checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
      {checked && <Check size={12} className="text-white" />}
    </div>
  )
}

function Radio({ checked }: { checked: boolean }) {
  return (
    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
      ${checked ? 'border-blue-600' : 'border-gray-300'}`}>
      {checked && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
    </div>
  )
}

/* ══════════════════════════════════════════
   필터 버튼 (공용)
   ══════════════════════════════════════════ */
function FilterBtn({
  label, active, count, onClear, onClick,
}: {
  label: string; active: boolean; count?: number; onClear?: () => void; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors flex-shrink-0
        ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600'}`}>
      <span>{label}{count != null && count > 0 ? ` ${count}` : ''}</span>
      {active && onClear
        ? <span onPointerDown={e => { e.stopPropagation(); onClear() }}
            className="ml-0.5 opacity-70 hover:opacity-100"><X size={11} /></span>
        : <ChevronDown size={11} className="opacity-60" />
      }
    </button>
  )
}

/* ══════════════════════════════════════════
   메인 컴포넌트
   ══════════════════════════════════════════ */
export default function MobilePipelineClient({ deals, assignees, isAdmin, myName }: Props) {
  const [q,        setQ]        = useState('')
  const [sheet,    setSheet]    = useState<'ct' | 'sa' | 'stage' | null>(null)

  /* 선택 상태 */
  const [selCt,    setSelCt]    = useState<Set<string>>(new Set())   // B2B/B2C 멀티
  const [selSa,    setSelSa]    = useState<Set<string>>(new Set())   // 담당자 멀티
  const [selStage, setSelStage] = useState('all')                    // 단계 단일

  /* 필터 적용 */
  const isCtAll    = selCt.size === 0
  const isSaAll    = selSa.size === 0
  const isStageAll = selStage === 'all'

  const filtered = deals.filter(d => {
    const code   = d.stageCode ?? getStageCode(d.stage ?? '')
    const status = d.salesStatus ?? '진행중'

    const stageOk = isStageAll
      ? true
      : selStage === '이탈' ? status === '이탈'
      : code === selStage

    const qOk = q
      ? (d.name ?? '').includes(q) || (d.phone ?? '').includes(q) || (d.assignee ?? '').includes(q)
      : true

    const ctOk = isCtAll
      ? true
      : (selCt.has('B2B') && d.customerType === '법인') ||
        (selCt.has('B2C') && d.customerType === '개인')

    const saOk = isSaAll ? true : selSa.has(d.assignee ?? '')

    return stageOk && qOk && ctOk && saOk
  })

  /* 단계 버튼 레이블 */
  const stageLabel = isStageAll ? '단계' : (STAGE_NAME[selStage] ?? selStage)

  return (
    <div className="flex flex-col h-full">

      {/* 검색 */}
      <div className="px-4 pt-4 pb-3 relative">
        <Search size={15} className="absolute left-7 top-[22px] text-gray-400 pointer-events-none" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="고객명, 전화번호, 담당자"
          className="w-full rounded-xl border border-gray-200 bg-white pl-8 pr-8 py-2.5 text-sm placeholder:text-gray-400 outline-none focus:border-blue-400" />
        {q && (
          <button onClick={() => setQ('')} className="absolute right-7 top-[22px] text-gray-400">
            <X size={15} />
          </button>
        )}
      </div>

      {/* 필터 버튼 행 — B2B/B2C | 담당자 | 단계 */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
        {/* B2B / B2C */}
        <FilterBtn
          label="유형"
          active={!isCtAll}
          count={selCt.size}
          onClear={() => setSelCt(new Set())}
          onClick={() => setSheet('ct')}
        />

        {/* 담당자 (관리자만) */}
        {isAdmin && (
          <FilterBtn
            label="담당자"
            active={!isSaAll}
            count={selSa.size}
            onClear={() => setSelSa(new Set())}
            onClick={() => setSheet('sa')}
          />
        )}

        {/* 단계 */}
        <FilterBtn
          label={stageLabel}
          active={!isStageAll}
          onClear={() => setSelStage('all')}
          onClick={() => setSheet('stage')}
        />
      </div>

      {/* 건수 + 활성 필터 요약 */}
      <div className="px-4 pb-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
        <span className="font-semibold text-gray-600">{filtered.length}건</span>
        {!isAdmin && <span>· 내 리드만 표시</span>}
        {!isCtAll && [...selCt].map(v => (
          <span key={v} className={`px-1.5 py-0.5 rounded-full font-semibold
            ${v === 'B2B' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{v}</span>
        ))}
        {!isSaAll && [...selSa].map(v => (
          <span key={v} className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{v}</span>
        ))}
        {!isStageAll && (
          <span className={`px-1.5 py-0.5 rounded-full font-semibold ${STAGE_COLOR[selStage] ?? 'bg-gray-100 text-gray-500'}`}>
            {STAGE_NAME[selStage] ?? selStage}
          </span>
        )}
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-4">
        {filtered.length === 0 && (
          <div className="text-center text-sm text-gray-400 mt-12">리드가 없습니다</div>
        )}
        {filtered.map(d => {
          const code  = d.stageCode ?? getStageCode(d.stage ?? '')
          const phone = d.customer?.phone ?? d.phone
          const isB2B = d.customerType === '법인'
          const isB2C = d.customerType === '개인'
          return (
            <div key={d.id} className="relative flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3">
              <Link href={`/m/pipeline/${d.id}`} className="absolute inset-0 rounded-xl z-0" />
              <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-gray-900 text-sm truncate">{d.name}</span>
                  {isB2B && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex-shrink-0">B2B</span>}
                  {isB2C && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 flex-shrink-0">B2C</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${STAGE_COLOR[code] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STAGE_NAME[code] ?? code}
                  </span>
                  {d.assignee && (
                    <span className="text-xs text-gray-400 truncate">
                      담당: {d.assignee}{d.assignee === myName ? ' (나)' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 relative z-10">
                {phone && (
                  <a href={`tel:${phone}`}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 active:bg-blue-100">
                    <Phone size={15} />
                  </a>
                )}
                <ChevronRight size={16} className="text-gray-300" />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 바텀 시트들 ── */}
      {sheet === 'ct' && (
        <FilterSheet
          title="고객 유형"
          items={CT_ITEMS}
          selected={selCt}
          multi
          onClose={() => setSheet(null)}
          onApply={v => setSelCt(v as Set<string>)}
        />
      )}
      {sheet === 'sa' && (
        <FilterSheet
          title="담당자"
          items={assignees.map(a => ({ value: a, label: a }))}
          selected={selSa}
          multi
          searchable
          onClose={() => setSheet(null)}
          onApply={v => setSelSa(v as Set<string>)}
        />
      )}
      {sheet === 'stage' && (
        <FilterSheet
          title="영업 단계"
          items={STAGE_ITEMS}
          selected={selStage}
          multi={false}
          onClose={() => setSheet(null)}
          onApply={v => setSelStage(v as string)}
        />
      )}
    </div>
  )
}
