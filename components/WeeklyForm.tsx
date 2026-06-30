'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { formatWeekLabel } from '@/lib/week'

type Team = { id: string; name: string }
type Task = { id: string; code: string; title: string; teamId: string }

type KpiItem = {
  id: string
  label: string
  type: string
  subType: string | null
  target: string
  targetNum: number | null
  unit: string | null
}

const STATUS_OPTIONS = ['정상', '지연', '조치필요', '완료'] as const
type Status = typeof STATUS_OPTIONS[number]

const STATUS_ACTIVE: Record<Status, string> = {
  '정상':    'bg-green-600  text-white',
  '지연':    'bg-yellow-500 text-white',
  '조치필요': 'bg-red-600    text-white',
  '완료':    'bg-blue-600   text-white',
}
const STATUS_INACTIVE: Record<Status, string> = {
  '정상':    'bg-green-50  text-green-700  border border-green-200  hover:bg-green-100',
  '지연':    'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100',
  '조치필요': 'bg-red-50    text-red-700   border border-red-200    hover:bg-red-100',
  '완료':    'bg-blue-50   text-blue-700   border border-blue-200   hover:bg-blue-100',
}

interface Props {
  teams: Team[]
  tasks: Task[]
  weekId: string
  weekStart: string
  initial?: {
    id?: string
    taskId?: string
    teamId?: string
    status?: string
    completed?: string
    planned?: string
    mentions?: string
  }
  mode: 'new' | 'edit'
  returnWeek: string
}

export default function WeeklyForm({ teams, tasks, weekId, weekStart, initial, mode, returnWeek }: Props) {
  const router = useRouter()

  const [teamId, setTeamId] = useState(initial?.teamId ?? teams[0]?.id ?? '')
  const [taskId, setTaskId] = useState(initial?.taskId ?? '')
  const [status, setStatus] = useState<Status>((initial?.status as Status) ?? '정상')
  const [completed, setCompleted] = useState(initial?.completed ?? '')
  const [planned, setPlanned] = useState(initial?.planned ?? '')
  const [mentions, setMentions] = useState(initial?.mentions ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [kpiItems, setKpiItems] = useState<KpiItem[]>([])
  const [kpiActuals, setKpiActuals] = useState<Record<string, string>>({})
  const [loadingKpi, setLoadingKpi] = useState(false)

  const teamTasks = tasks.filter(t => t.teamId === teamId)

  // KPI 항목 및 기존 실적 로드 (과제 선택 시)
  useEffect(() => {
    if (!taskId) {
      setKpiItems([])
      setKpiActuals({})
      return
    }
    setLoadingKpi(true)
    fetch(`/api/kpi-actuals?taskId=${taskId}&week=${weekId}`)
      .then(r => r.json())
      .then(data => {
        setKpiItems(data.items ?? [])
        const map: Record<string, string> = {}
        for (const a of data.actuals ?? []) {
          map[a.kpiItemId] = a.actual
        }
        setKpiActuals(map)
      })
      .catch(() => {/* 무시 */})
      .finally(() => setLoadingKpi(false))
  }, [taskId, weekId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'new' && !taskId) { setError('과제를 선택해주세요.'); return }
    setSaving(true)
    setError('')

    try {
      // 주간보고 저장
      if (mode === 'new') {
        const res = await fetch('/api/weekly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, teamId, week: weekId, weekStart, status, completed, planned, mentions }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? '저장 실패'); setSaving(false); return }
      } else {
        const res = await fetch(`/api/weekly/${initial?.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, completed, planned, mentions }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? '저장 실패'); setSaving(false); return }
      }

      // KPI 실적 저장 (입력된 항목만)
      const kpiEntries = Object.entries(kpiActuals).filter(([, v]) => v.trim() !== '')
      if (kpiEntries.length > 0) {
        const items = kpiEntries.map(([kpiItemId, actual]) => {
          const num = parseFloat(actual.replace(/[^\d.]/g, ''))
          return {
            kpiItemId,
            taskId,
            week: weekId,
            actual,
            actualNum: isNaN(num) ? null : num,
          }
        })
        await fetch('/api/kpi-actuals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        })
      }

      router.push(`/weekly?week=${returnWeek}`)
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/weekly?week=${returnWeek}`} className="text-sm text-slate-400 hover:text-indigo-600 transition-colors mb-2 inline-block">
          ← 주간보고 목록
        </Link>
        <h1 className="text-xl font-bold text-slate-900">
          {mode === 'new' ? '주간보고 작성' : '주간보고 수정'}
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">{formatWeekLabel(weekId)}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'new' && (
          <>
            {/* Team selection */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">담당 팀</p>
              <div className="flex flex-wrap gap-2">
                {teams.map(team => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => { setTeamId(team.id); setTaskId('') }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      teamId === team.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Task selection */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">전략과제</p>
              {teamTasks.length === 0 ? (
                <p className="text-sm text-slate-400">이 팀에 등록된 전략과제가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {teamTasks.map(task => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setTaskId(task.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        taskId === task.id
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-mono text-slate-400 mr-2">{task.code}</span>
                      <span className="text-sm font-medium text-slate-800">{task.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Status */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">진행 상태</p>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  status === s ? STATUS_ACTIVE[s] : STATUS_INACTIVE[s]
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              완료사항
              <span className="ml-1.5 text-slate-400 font-normal">이번 주 완료한 업무</span>
            </label>
            <textarea
              value={completed}
              onChange={e => setCompleted(e.target.value)}
              rows={3}
              placeholder="이번 주 완료한 업무를 입력하세요"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              이번 주 계획
              <span className="ml-1.5 text-slate-400 font-normal">다음 주 예정 업무</span>
            </label>
            <textarea
              value={planned}
              onChange={e => setPlanned(e.target.value)}
              rows={3}
              placeholder="다음 주 계획 업무를 입력하세요"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              특이사항
              <span className="ml-1.5 text-slate-400 font-normal">리스크, 이슈, 요청사항</span>
            </label>
            <textarea
              value={mentions}
              onChange={e => setMentions(e.target.value)}
              rows={2}
              placeholder="특이사항이 있으면 입력하세요 (선택)"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* KPI 실적 입력 */}
        {taskId && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={15} className="text-indigo-500" />
              <p className="text-sm font-semibold text-slate-700">KPI 실적</p>
              <span className="text-xs text-slate-400">이번 주 달성 실적 입력 (선택)</span>
            </div>

            {loadingKpi ? (
              <p className="text-sm text-slate-400">KPI 항목 로딩 중...</p>
            ) : kpiItems.length === 0 ? (
              <p className="text-sm text-slate-400">이 과제에 등록된 KPI 항목이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {kpiItems.map(kpi => (
                  <div key={kpi.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                          kpi.type === '정량'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-violet-50 text-violet-600'
                        }`}>
                          {kpi.type}
                        </span>
                        <p className="text-sm font-medium text-slate-700 truncate">{kpi.label}</p>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        목표: {kpi.target}{kpi.unit ? ` ${kpi.unit}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="text"
                        value={kpiActuals[kpi.id] ?? ''}
                        onChange={e => setKpiActuals(prev => ({ ...prev, [kpi.id]: e.target.value }))}
                        placeholder="실적"
                        className="w-28 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-right"
                      />
                      {kpi.unit && (
                        <span className="text-sm text-slate-500 w-8 text-left">{kpi.unit}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href={`/weekly?week=${returnWeek}`}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            <Save size={14} />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}
