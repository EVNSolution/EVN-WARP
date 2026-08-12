'use client'

import { useState } from 'react'
import { Wallet, CheckCircle2, BarChart3, Check, X } from 'lucide-react'

type Activity = {
  id: string; date: string; endDate: string | null; type: string; title: string
  userName: string | null
  expenseTransport: number | null; expenseAccomm: number | null; expenseMeal: number | null; expenseOther: number | null
  expensePaymentMethod: string | null; expenseCardId: string | null; expenseNote: string | null
  expenseStatus: string | null; expenseApproverName: string | null; expenseApprovedAt: string | null; expenseApproverNote: string | null
  team: { name: string } | null
  task: { code: string; title: string } | null
}
type TeamStat = { name: string; total: number; count: number }
type MethodStat = { name: string; total: number; count: number }
type StatusStat = { name: string; count: number }
type Stats = {
  total: number; count: number
  byCategory: { transport: number; accomm: number; meal: number; other: number }
  byTeam: TeamStat[]; byMethod: MethodStat[]; byStatus: StatusStat[]
  byTaskLinkage: { linked: { total: number; count: number }; unlinked: { total: number; count: number } }
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  '신청': { bg: 'bg-amber-100', text: 'text-amber-700' },
  '승인': { bg: 'bg-green-100', text: 'text-green-700' },
  '반려': { bg: 'bg-red-100',   text: 'text-red-600' },
}
const FILTERS = [
  { key: '',   label: '전체' },
  { key: '신청', label: '신청' },
  { key: '승인', label: '승인' },
  { key: '반려', label: '반려' },
] as const

function won(n: number) { return n.toLocaleString('ko-KR') + '원' }
function activityTotal(a: Activity) { return (a.expenseTransport ?? 0) + (a.expenseAccomm ?? 0) + (a.expenseMeal ?? 0) + (a.expenseOther ?? 0) }
function fmt(d: string) { return d?.slice(0, 10) ?? '' }

export default function FinanceClient({
  initialPending, initialStats, initialFrom, initialTo,
}: {
  initialPending: Activity[]
  initialStats: Stats
  initialFrom: string
  initialTo: string
}) {
  const [tab, setTab] = useState<'approval' | 'stats'>('approval')

  /* ── 비용승인 ── */
  const [filter, setFilter] = useState<'' | '신청' | '승인' | '반려'>('신청')
  const [activities, setActivities] = useState(initialPending)
  const [loadingList, setLoadingList] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const loadList = async (status: '' | '신청' | '승인' | '반려') => {
    setFilter(status)
    setLoadingList(true)
    try {
      const res = await fetch(`/api/expenses${status ? `?status=${status}` : ''}`)
      setActivities(await res.json())
    } finally { setLoadingList(false) }
  }

  const decide = async (id: string, status: '승인' | '반려') => {
    setProcessingId(id)
    try {
      const approverNote = status === '반려' ? (prompt('반려 사유를 입력해주세요 (선택)') ?? '') : ''
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, approverNote }),
      })
      if (res.ok) setActivities(prev => filter === '' ? prev.map(a => a.id === id ? { ...a, expenseStatus: status } : a) : prev.filter(a => a.id !== id))
    } finally { setProcessingId(null) }
  }

  /* ── 비용통계 ── */
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo]     = useState(initialTo)
  const [stats, setStats] = useState(initialStats)
  const [loadingStats, setLoadingStats] = useState(false)

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const res = await fetch(`/api/expenses/stats?from=${from}&to=${to}`)
      setStats(await res.json())
    } finally { setLoadingStats(false) }
  }

  const catRows = [
    { label: '교통비', val: stats.byCategory.transport },
    { label: '숙박비', val: stats.byCategory.accomm },
    { label: '식비',   val: stats.byCategory.meal },
    { label: '기타',   val: stats.byCategory.other },
  ]
  const maxCat = Math.max(1, ...catRows.map(c => c.val))

  return (
    <div className="p-6" style={{ maxWidth: '1100px' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 mb-4 rounded-xl" style={{ backgroundColor: '#111111' }}>
        <div>
          <h1 className="text-xl font-bold text-white">재무 / 회계</h1>
          <p className="text-xs mt-0.5" style={{ color: '#C5D42A' }}>비용 승인 · 비용 통계</p>
        </div>
        <Wallet size={22} color="#C5D42A" />
      </div>

      {/* 탭 */}
      <div className="flex gap-0 mb-4 border-b border-slate-200">
        {[
          { key: 'approval', label: '비용승인', icon: CheckCircle2 },
          { key: 'stats',    label: '비용통계', icon: BarChart3 },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-1.5 px-6 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              tab === key ? 'border-[#C5D42A] text-[#7a9200] bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ══ 비용승인 ══ */}
      {tab === 'approval' && (
        <div className="space-y-4">
          <div className="flex gap-1.5">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => loadList(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${filter === f.key ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {loadingList ? (
              <p className="text-xs text-slate-400 text-center py-10">불러오는 중...</p>
            ) : activities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">해당하는 비용 내역이 없습니다.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {activities.map(a => {
                  const s = STATUS_STYLE[a.expenseStatus ?? ''] ?? { bg: 'bg-slate-100', text: 'text-slate-500' }
                  const total = activityTotal(a)
                  return (
                    <div key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{a.title}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>{a.expenseStatus ?? '미신청'}</span>
                          {a.expensePaymentMethod && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{a.expensePaymentMethod}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {fmt(a.date)} · {a.userName ?? '알 수 없음'} · {a.team?.name ?? '미배정'}
                          {a.task ? ` · ${a.task.code} ${a.task.title}` : ' · 독립활동'}
                        </p>
                        {a.expenseStatus === '반려' && a.expenseApproverNote && (
                          <p className="text-xs text-red-500 mt-0.5">반려사유: {a.expenseApproverNote}</p>
                        )}
                        {a.expenseApproverName && a.expenseStatus !== '신청' && (
                          <p className="text-[11px] text-slate-300 mt-0.5">결재: {a.expenseApproverName} {a.expenseApprovedAt ? `· ${fmt(a.expenseApprovedAt)}` : ''}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-slate-800 tabular-nums">{won(total)}</p>
                      </div>
                      {a.expenseStatus === '신청' && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => decide(a.id, '승인')} disabled={processingId === a.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition">
                            <Check size={11} /> 승인
                          </button>
                          <button onClick={() => decide(a.id, '반려')} disabled={processingId === a.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition">
                            <X size={11} /> 반려
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ 비용통계 ══ */}
      {tab === 'stats' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-end gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">시작일</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">종료일</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
            </div>
            <button onClick={loadStats} disabled={loadingStats}
              className="px-4 py-2 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-40">
              {loadingStats ? '조회 중...' : '조회'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500">총 비용</p>
              <p className="text-2xl font-black text-slate-700 tabular-nums">{won(stats.total)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-slate-500">건수</p>
              <p className="text-2xl font-black text-blue-700 tabular-nums">{stats.count}<span className="text-sm font-semibold ml-1">건</span></p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-xs text-slate-500">과제 연계 비율</p>
              <p className="text-2xl font-black text-emerald-700 tabular-nums">
                {stats.byTaskLinkage.linked.count + stats.byTaskLinkage.unlinked.count > 0
                  ? Math.round(stats.byTaskLinkage.linked.count / (stats.byTaskLinkage.linked.count + stats.byTaskLinkage.unlinked.count) * 100)
                  : 0}<span className="text-sm font-semibold ml-1">%</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-bold text-slate-700 mb-3">항목별 비용</p>
              <div className="space-y-2.5">
                {catRows.map(c => (
                  <div key={c.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500">{c.label}</span>
                      <span className="font-semibold text-slate-700 tabular-nums">{won(c.val)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(c.val / maxCat) * 100}%`, backgroundColor: '#C5D42A' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-bold text-slate-700 mb-3">결제수단별</p>
              <div className="space-y-2">
                {stats.byMethod.length === 0 ? (
                  <p className="text-xs text-slate-300 text-center py-6">데이터 없음</p>
                ) : stats.byMethod.map(m => (
                  <div key={m.name} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{m.name}</span>
                    <span className="tabular-nums text-slate-700 font-semibold">{won(m.total)} <span className="text-xs text-slate-400">({m.count}건)</span></span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-bold text-slate-700 mb-3">팀별</p>
              <div className="space-y-2">
                {stats.byTeam.length === 0 ? (
                  <p className="text-xs text-slate-300 text-center py-6">데이터 없음</p>
                ) : stats.byTeam.map(t => (
                  <div key={t.name} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{t.name}</span>
                    <span className="tabular-nums text-slate-700 font-semibold">{won(t.total)} <span className="text-xs text-slate-400">({t.count}건)</span></span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-bold text-slate-700 mb-3">결재 상태</p>
              <div className="flex flex-wrap gap-2">
                {stats.byStatus.length === 0 ? (
                  <p className="text-xs text-slate-300 text-center py-6">데이터 없음</p>
                ) : stats.byStatus.map(s => {
                  const style = STATUS_STYLE[s.name] ?? { bg: 'bg-slate-100', text: 'text-slate-500' }
                  return (
                    <span key={s.name} className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${style.bg} ${style.text}`}>
                      {s.name} {s.count}건
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
