'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Phone, CheckCircle2, Circle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { PIPELINE, PipelineCheck } from '@/lib/pipeline'
import Link from 'next/link'

interface DealData {
  id: string
  name: string
  phone: string | null
  stageCode: string | null
  stage: string | null
  assignee: string | null
  customerType: string | null
  checklistJson: string | null
  customer?: { phone: string | null } | null
}

function getProcess(code: string) {
  for (const ph of PIPELINE) {
    for (const pr of ph.processes) {
      if (pr.code === code) return pr
    }
  }
  return null
}

// PIPELINE에서 직접 읽어 PC 버전과 동일한 레이블 사용
const STAGE_NAME: Record<string, string> = {}
const STAGE_BADGE: Record<string, string> = {}
const PHASE_BADGE: Record<number, string> = {
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-purple-100 text-purple-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-teal-100 text-teal-700',
}
for (const ph of PIPELINE) {
  for (const pr of ph.processes) {
    STAGE_NAME[pr.code]  = pr.name
    STAGE_BADGE[pr.code] = PHASE_BADGE[ph.phase] ?? 'bg-gray-100 text-gray-500'
  }
}
STAGE_NAME['이탈'] = '이탈'
STAGE_BADGE['이탈'] = 'bg-red-100 text-red-600'

export default function MobileLeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [deal, setDeal] = useState<DealData | null>(null)
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    fetch(`/api/deals/${id}`)
      .then(r => r.json())
      .then((d: DealData) => {
        setDeal(d)
        try { setChecklist(JSON.parse(d.checklistJson ?? '{}')) } catch { setChecklist({}) }
      })
  }, [id])

  const toggleCheck = useCallback(async (key: string) => {
    if (!deal) return
    const next = { ...checklist, [key]: !checklist[key] }
    setChecklist(next)
    setSaving(true)
    try {
      await fetch(`/api/deals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistJson: JSON.stringify(next) }),
      })
    } finally {
      setSaving(false)
    }
  }, [deal, checklist, id])

  if (!deal) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-blue-500" />
      </div>
    )
  }

  const code    = deal.stageCode ?? ''
  const process = getProcess(code)
  const isB2B   = deal.customerType === 'B2B'
  const checks: PipelineCheck[] = process
    ? (isB2B && process.checksB2B ? process.checksB2B : process.checks)
    : []
  const total   = checks.length
  const done    = checks.filter(c => checklist[c.key]).length
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0
  const phone   = deal.customer?.phone ?? deal.phone

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="bg-[#0B1D3A] px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/70 active:text-white">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-white font-bold text-base truncate">{deal.name}</h1>
              {code && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0 ${STAGE_BADGE[code] ?? 'bg-white/20 text-white'}`}>
                  {STAGE_NAME[code] ?? code}
                </span>
              )}
            </div>
            {deal.assignee && <div className="text-white/60 text-xs mt-0.5">담당: {deal.assignee}</div>}
          </div>
          {phone && (
            <a href={`tel:${phone}`} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20">
              <Phone size={18} />
            </a>
          )}
        </div>

        {/* 진행률 바 */}
        {total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-white/70 mb-1">
              <span>체크리스트 진행</span>
              <span className="font-semibold">{done}/{total} ({pct}%)</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-1.5">
              <div className="bg-blue-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* 체크리스트 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {process ? (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900">
              <span>{process.name} 체크리스트</span>
              <div className="flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin text-blue-400" />}
                {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>
            {expanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {checks.length === 0 && (
                  <div className="px-4 py-3 text-sm text-gray-400">체크 항목이 없습니다</div>
                )}
                {checks.map(c => {
                  const checked = !!checklist[c.key]
                  return (
                    <button
                      key={c.key}
                      onClick={() => toggleCheck(c.key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 transition-colors
                        ${checked ? 'bg-blue-50/40' : ''}`}>
                      {checked
                        ? <CheckCircle2 size={20} className="text-blue-500 flex-shrink-0" />
                        : <Circle size={20} className="text-gray-300 flex-shrink-0" />}
                      <span className={`text-sm leading-snug ${checked ? 'text-blue-700 line-through decoration-blue-300' : 'text-gray-700'}`}>
                        {c.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-8 text-center text-sm text-gray-400">
            이 단계의 체크리스트 정보를 찾을 수 없습니다
          </div>
        )}

        {/* 빠른 활동 추가 */}
        <Link href={`/m/activity?dealId=${id}&dealName=${encodeURIComponent(deal.name)}`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 text-sm font-semibold active:bg-blue-50">
          + 활동 추가
        </Link>

        {/* 전체 상세 보기 */}
        <a href={`/funnel/${id}`}
          className="flex items-center justify-center w-full py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold active:bg-gray-200">
          PC 버전 전체 보기
        </a>
      </div>
    </div>
  )
}
