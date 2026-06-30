'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CheckCircle2, RefreshCw,
  Users, Database, Link2, Unlink,
  GitMerge, Search, Phone, ChevronDown, ChevronUp,
  Trash2, Eye,
} from 'lucide-react'

/* ── 타입 ── */
interface Stats {
  totalCustomers:     number
  linkedDeals:        number
  unlinkedDeals:      number
  customersWithDetail:number
}

type CustInfo = { id: string; name: string; phone: string | null; status: string; leadCount: number; createdAt: string }
type DupGroup = { phone: string | null; name: string; customers: CustInfo[] }

interface DupResult {
  total:      number
  dupCount:   number
  groupCount: number
  groups:     DupGroup[]
}

type LostPreviewItem = {
  id: string; name: string; phone: string | null; stageCode: string
  meetingCount: number; customerId: string | null; collectedAt: string | null
}
interface LostPreview {
  count:        number
  meetingCount: number
  preview:      LostPreviewItem[]
}

/* ── 상태 초기화 ── */
const RESET_RESULT_INIT = null as { resetCount: number; createCount: number; message: string } | null

export default function AdminClient({ stats }: { stats: Stats }) {
  const router = useRouter()

  /* 초기화 작업 */
  const [resetStep,   setResetStep]   = useState<'idle' | 'confirm' | 'running' | 'done'>('idle')
  const [resetResult, setResetResult] = useState(RESET_RESULT_INIT)
  const [resetError,  setResetError]  = useState('')

  /* 이탈 리드 삭제 */
  const [lostPreview,  setLostPreview]  = useState<LostPreview | null>(null)
  const [lostLoading,  setLostLoading]  = useState(false)
  const [lostStep,     setLostStep]     = useState<'idle' | 'preview' | 'confirm' | 'running' | 'done'>('idle')
  const [lostResult,   setLostResult]   = useState<{ deleted: number; message: string } | null>(null)
  const [lostError,    setLostError]    = useState('')
  const [lostExpanded, setLostExpanded] = useState(false)

  /* 중복 진단 */
  const [dupLoading, setDupLoading] = useState(false)
  const [dupResult,  setDupResult]  = useState<DupResult | null>(null)
  const [dupError,   setDupError]   = useState('')
  const [expanded,   setExpanded]   = useState<Set<number>>(new Set())
  const [merging,    setMerging]    = useState<string | null>(null) // removeId being merged
  const [mergeMsg,   setMergeMsg]   = useState('')

  /* ── 핸들러: 이탈 리드 미리보기 ── */
  const handleLostPreview = async () => {
    setLostLoading(true)
    setLostError('')
    try {
      const res  = await fetch('/api/migrate/delete-lost-leads')
      const json = await res.json()
      if (!res.ok) { setLostError(json.error ?? '오류'); return }
      setLostPreview(json)
      setLostStep('preview')
    } catch {
      setLostError('네트워크 오류가 발생했습니다')
    } finally {
      setLostLoading(false)
    }
  }

  /* ── 핸들러: 이탈 리드 삭제 실행 ── */
  const handleLostDelete = async () => {
    setLostStep('running')
    setLostError('')
    try {
      const res  = await fetch('/api/migrate/delete-lost-leads', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setLostError(json.error ?? '오류'); setLostStep('preview'); return }
      setLostResult(json)
      setLostStep('done')
      router.refresh()
    } catch {
      setLostError('네트워크 오류가 발생했습니다')
      setLostStep('preview')
    }
  }

  /* ── 핸들러: 데이터 초기화 실행 ── */
  const handleReset = async () => {
    setResetStep('running')
    setResetError('')
    try {
      const res  = await fetch('/api/migrate/reset-customers', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setResetError(json.error ?? '오류가 발생했습니다'); setResetStep('idle'); return }
      setResetResult(json)
      setResetStep('done')
      router.refresh()
    } catch {
      setResetError('네트워크 오류가 발생했습니다')
      setResetStep('idle')
    }
  }

  /* ── 핸들러: 중복 고객 검색 ── */
  const handleFindDups = async () => {
    setDupLoading(true)
    setDupError('')
    setDupResult(null)
    setMergeMsg('')
    try {
      const res  = await fetch('/api/migrate/find-duplicates')
      const json = await res.json()
      if (!res.ok) { setDupError(json.error ?? '오류'); return }
      setDupResult(json)
    } catch {
      setDupError('네트워크 오류가 발생했습니다')
    } finally {
      setDupLoading(false)
    }
  }

  /* ── 핸들러: 고객 통합 ── */
  const handleMerge = async (keepId: string, removeId: string) => {
    setMerging(removeId)
    setMergeMsg('')
    try {
      const res  = await fetch('/api/migrate/merge-customers', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ keepId, removeId }),
      })
      const json = await res.json()
      if (!res.ok) { setMergeMsg(`오류: ${json.error}`); return }
      setMergeMsg(json.message)
      // 중복 목록 갱신
      await handleFindDups()
      router.refresh()
    } catch {
      setMergeMsg('네트워크 오류가 발생했습니다')
    } finally {
      setMerging(null)
    }
  }

  const toggleGroup = (idx: number) =>
    setExpanded(prev => { const s = new Set(prev); s.has(idx) ? s.delete(idx) : s.add(idx); return s })

  /* ── 렌더 ── */
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">

      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">데이터 관리</h1>
        <p className="text-sm text-slate-500 mt-1">고객/리드 데이터 초기화 및 중복 통합</p>
      </div>

      {/* 현황 카드 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: <Users size={16} />,    label: '전체 고객',            val: stats.totalCustomers,       color: 'text-slate-700',   bg: 'bg-slate-50' },
          { icon: <Database size={16} />, label: '상세 정보 있는 고객',   val: stats.customersWithDetail,  color: 'text-amber-700',   bg: 'bg-amber-50' },
          { icon: <Link2 size={16} />,    label: '연결된 리드',           val: stats.linkedDeals,          color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { icon: <Unlink size={16} />,   label: '미연결 리드',           val: stats.unlinkedDeals,        color: 'text-red-600',     bg: 'bg-red-50' },
        ].map(({ icon, label, val, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
            <span className={color}>{icon}</span>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`text-2xl font-black tabular-nums ${color}`}>{val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ══ 중복 고객 통합 ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 bg-indigo-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-sm flex items-center gap-2">
                <GitMerge size={15} /> 중복 고객 통합
              </h2>
              <p className="text-indigo-300 text-xs mt-0.5">동일 전화번호로 중복 등록된 고객을 찾아 하나로 합칩니다</p>
            </div>
            <button onClick={handleFindDups} disabled={dupLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50">
              {dupLoading ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
              {dupLoading ? '검색 중...' : '중복 검색'}
            </button>
          </div>
        </div>

        <div className="p-6">
          {dupError && <p className="text-sm text-red-600 mb-4">{dupError}</p>}
          {mergeMsg && (
            <div className="mb-4 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium">
              ✓ {mergeMsg}
            </div>
          )}

          {!dupResult && !dupLoading && (
            <p className="text-sm text-slate-400 text-center py-6">
              "중복 검색" 버튼을 누르면 전화번호가 동일한 고객을 찾아줍니다
            </p>
          )}

          {dupResult && (
            <>
              {/* 요약 */}
              <div className={`mb-5 px-4 py-3 rounded-xl border text-sm font-semibold ${
                dupResult.dupCount > 0
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                {dupResult.dupCount > 0
                  ? `전체 ${dupResult.total}명 중 중복 ${dupResult.groupCount}건 발견 — 제거 가능 레코드 ${dupResult.dupCount}개`
                  : `전체 ${dupResult.total}명 검사 완료 — 중복 없음`}
              </div>

              {/* 중복 그룹 목록 */}
              {dupResult.groups.length > 0 && (
                <div className="space-y-3">
                  {dupResult.groups.map((group, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                      {/* 그룹 헤더 */}
                      <button onClick={() => toggleGroup(idx)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left">
                        <div className="flex items-center gap-3">
                          <Phone size={12} className="text-slate-400" />
                          <span className="text-sm font-semibold text-slate-700">{group.name}</span>
                          <span className="text-xs text-slate-400">{group.phone ?? '전화 없음'}</span>
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded">
                            {group.customers.length}개 중복
                          </span>
                        </div>
                        {expanded.has(idx) ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                      </button>

                      {/* 펼친 상태: 통합 선택 */}
                      {expanded.has(idx) && (
                        <div className="divide-y divide-slate-100">
                          <div className="px-4 py-2 bg-blue-50">
                            <p className="text-[11px] text-blue-600 font-semibold">
                              아래에서 "남길 고객"을 결정하고, 나머지의 "통합" 버튼을 누르세요.
                              리드·활동이 모두 남긴 고객으로 이전됩니다.
                            </p>
                          </div>
                          {group.customers.map((c, ci) => {
                            const isFirst = ci === 0
                            const otherIds = group.customers.filter(x => x.id !== c.id).map(x => x.id)
                            const keepId   = isFirst ? c.id : group.customers[0].id
                            return (
                              <div key={c.id} className={`px-4 py-3 flex items-center justify-between ${isFirst ? 'bg-emerald-50/40' : ''}`}>
                                <div className="flex items-center gap-3 text-xs">
                                  {isFirst && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 font-bold text-[9px] rounded">기준</span>}
                                  <div>
                                    <p className="font-semibold text-slate-700">{c.name}</p>
                                    <p className="text-slate-400 mt-0.5">
                                      {c.phone ?? '전화 없음'} · {c.status} ·
                                      리드 {c.leadCount}건 · {c.createdAt.slice(0, 10)} 생성
                                    </p>
                                  </div>
                                </div>
                                {!isFirst && (
                                  <button
                                    onClick={() => handleMerge(keepId, c.id)}
                                    disabled={merging === c.id}
                                    className="shrink-0 ml-4 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-1.5">
                                    {merging === c.id
                                      ? <><RefreshCw size={10} className="animate-spin" />통합 중</>
                                      : <><GitMerge size={10} />기준으로 통합</>}
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══ 이탈 리드 삭제 ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 bg-red-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-sm flex items-center gap-2">
                <Trash2 size={15} /> 이탈 리드 삭제
              </h2>
              <p className="text-red-300 text-xs mt-0.5">
                구매의향 미확인 이탈 리드를 영업 파이프라인에서 제거합니다. 고객 레코드는 유지됩니다.
              </p>
            </div>
            {lostStep === 'idle' && (
              <button onClick={handleLostPreview} disabled={lostLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50">
                {lostLoading ? <RefreshCw size={12} className="animate-spin" /> : <Eye size={12} />}
                {lostLoading ? '조회 중...' : '삭제 대상 조회'}
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {lostError && <p className="text-sm text-red-600">{lostError}</p>}

          {/* 초기 안내 */}
          {lostStep === 'idle' && (
            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 space-y-1.5">
              <p>• <strong>삭제 대상</strong>: salesStatus = '이탈' 인 SalesDeal 전체</p>
              <p>• <strong>유지 항목</strong>: 연결된 Customer 레코드 (고객 이름·전화번호·상태)</p>
              <p>• <strong>함께 삭제</strong>: 해당 리드의 미팅 기록 (LeadMeeting)</p>
            </div>
          )}

          {/* 미리보기 */}
          {(lostStep === 'preview' || lostStep === 'confirm' || lostStep === 'running') && lostPreview && (
            <div className="space-y-3">
              {/* 요약 */}
              <div className="flex gap-3">
                <div className="flex-1 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-red-500 mb-0.5">삭제될 리드</p>
                  <p className="text-2xl font-black text-red-700 tabular-nums">{lostPreview.count}건</p>
                </div>
                <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-amber-500 mb-0.5">함께 삭제되는 미팅 기록</p>
                  <p className="text-2xl font-black text-amber-700 tabular-nums">{lostPreview.meetingCount}건</p>
                </div>
                <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-emerald-600 mb-0.5">유지되는 고객 레코드</p>
                  <p className="text-2xl font-black text-emerald-700 tabular-nums">
                    {lostPreview.preview.filter(d => d.customerId).length}명
                  </p>
                </div>
              </div>

              {/* 목록 토글 */}
              <button onClick={() => setLostExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-600 transition">
                <span>삭제 대상 목록 {lostExpanded ? '접기' : '펼치기'}</span>
                {lostExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {lostExpanded && (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-slate-400 font-semibold">이름</th>
                        <th className="text-left px-3 py-2 text-slate-400 font-semibold">전화번호</th>
                        <th className="text-left px-3 py-2 text-slate-400 font-semibold">수집일</th>
                        <th className="text-center px-3 py-2 text-slate-400 font-semibold">미팅</th>
                        <th className="text-center px-3 py-2 text-slate-400 font-semibold">고객연결</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lostPreview.preview.map(d => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-700">{d.name}</td>
                          <td className="px-3 py-2 text-slate-500">{d.phone ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-400">{d.collectedAt ?? '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-500">{d.meetingCount || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            {d.customerId
                              ? <span className="text-emerald-600 font-bold">✓</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 경고 */}
              {lostStep === 'preview' && (
                <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    삭제된 리드와 미팅 기록은 복구할 수 없습니다.
                    목록을 확인한 후 실행해 주세요.
                  </p>
                </div>
              )}

              {/* 확인 단계 */}
              {lostStep === 'confirm' && (
                <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-300 rounded-xl">
                  <AlertTriangle size={15} className="text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 font-semibold">
                    이탈 리드 {lostPreview.count}건과 미팅 기록 {lostPreview.meetingCount}건이 영구 삭제됩니다. 정말 실행하시겠습니까?
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 완료 */}
          {lostStep === 'done' && lostResult && (
            <div className="flex items-start gap-3 px-4 py-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-800">완료</p>
                <p className="text-xs text-emerald-700 mt-0.5">{lostResult.message}</p>
              </div>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex items-center gap-3 pt-1">
            {lostStep === 'preview' && (
              <>
                <button onClick={() => setLostStep('confirm')}
                  className="px-5 py-2.5 text-sm font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition">
                  삭제 실행
                </button>
                <button onClick={() => { setLostStep('idle'); setLostPreview(null) }}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                  취소
                </button>
              </>
            )}
            {lostStep === 'confirm' && (
              <>
                <button onClick={handleLostDelete}
                  className="px-5 py-2.5 text-sm font-bold rounded-xl bg-red-700 text-white hover:bg-red-800 transition">
                  최종 확인 — 지금 삭제
                </button>
                <button onClick={() => setLostStep('preview')}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                  돌아가기
                </button>
              </>
            )}
            {lostStep === 'running' && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <RefreshCw size={14} className="animate-spin" /> 삭제 중...
              </div>
            )}
            {lostStep === 'done' && (
              <button onClick={() => { setLostStep('idle'); setLostPreview(null); setLostResult(null) }}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                닫기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══ 고객 데이터 초기화 ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-800">
          <h2 className="text-white font-bold text-sm">고객 데이터 초기화</h2>
          <p className="text-slate-400 text-xs mt-0.5">리드에서 자동 복사된 상세 정보를 제거하고, 이름·전화번호만 유지합니다</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 text-sm">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black shrink-0">1</span>
              <div>
                <p className="font-semibold text-slate-700">기존 고객 초기화 ({stats.totalCustomers}개)</p>
                <p className="text-slate-500 text-xs mt-0.5">이름·전화번호·세그먼트·상태 유지 — 차량/화주/CRM 상세 초기화</p>
              </div>
            </div>
            {stats.unlinkedDeals > 0 && (
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                <div>
                  <p className="font-semibold text-slate-700">미연결 리드 고객 생성 ({stats.unlinkedDeals}개)</p>
                  <p className="text-slate-500 text-xs mt-0.5">이름·전화번호로 고객 레코드 생성 후 리드에 연결</p>
                </div>
              </div>
            )}
          </div>

          {resetStep !== 'done' && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                <strong>주의:</strong> 기존 고객의 차량/화주/상세 정보가 삭제됩니다. 중복 통합 먼저 완료 후 실행을 권장합니다.
              </p>
            </div>
          )}

          {resetError && <p className="text-sm text-red-600">{resetError}</p>}

          {resetStep === 'done' && resetResult && (
            <div className="flex items-start gap-3 px-4 py-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-800">완료</p>
                <p className="text-xs text-emerald-700 mt-0.5">{resetResult.message}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            {resetStep === 'idle' && (
              <button onClick={() => setResetStep('confirm')}
                className="px-5 py-2.5 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition">
                실행 준비
              </button>
            )}
            {resetStep === 'confirm' && (
              <>
                <button onClick={handleReset}
                  className="px-5 py-2.5 text-sm font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition">
                  확인 — 지금 실행
                </button>
                <button onClick={() => setResetStep('idle')}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                  취소
                </button>
                <p className="text-xs text-red-500 font-semibold">정말 실행하시겠습니까?</p>
              </>
            )}
            {resetStep === 'running' && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <RefreshCw size={14} className="animate-spin" /> 실행 중...
              </div>
            )}
            {resetStep === 'done' && (
              <button onClick={() => { setResetStep('idle'); setResetResult(null) }}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                닫기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
