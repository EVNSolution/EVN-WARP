'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Pencil, X, Layers, CornerDownRight } from 'lucide-react'
import { STATUS_STYLE, dDay } from '@/lib/a3'
import { teamOrderIndex } from '@/lib/teamOrder'
import { useA3Expand } from '@/components/A3ExpandContext'

/* 팀 이름 해시 기반 고정 색상 — 같은 전사과제 안에서 팀별로 시각 구분 */
const TEAM_PALETTE = [
  { chip: 'bg-indigo-50 text-indigo-700 border-indigo-100', dot: 'bg-indigo-400', bar: 'border-l-indigo-300' },
  { chip: 'bg-violet-50 text-violet-700 border-violet-100', dot: 'bg-violet-400', bar: 'border-l-violet-300' },
  { chip: 'bg-teal-50 text-teal-700 border-teal-100',       dot: 'bg-teal-400',   bar: 'border-l-teal-300' },
  { chip: 'bg-amber-50 text-amber-700 border-amber-100',    dot: 'bg-amber-400',  bar: 'border-l-amber-300' },
  { chip: 'bg-rose-50 text-rose-700 border-rose-100',       dot: 'bg-rose-400',   bar: 'border-l-rose-300' },
  { chip: 'bg-sky-50 text-sky-700 border-sky-100',          dot: 'bg-sky-400',    bar: 'border-l-sky-300' },
]
function teamColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return TEAM_PALETTE[hash % TEAM_PALETTE.length]
}

interface Props {
  subTasks: any[]
  parentTaskId: string
  teamSummaries: Record<string, string>
}

const STORAGE_PREFIX = 'a3-expanded-'

export default function A3SubTaskGroups({ subTasks, parentTaskId, teamSummaries }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)

  // 팀별 그룹
  const groups = new Map<string, { teamName: string; items: any[] }>()
  for (const sub of subTasks) {
    const key = sub.teamId
    if (!groups.has(key))
      groups.set(key, { teamName: sub.team?.name ?? '미배정', items: [] })
    groups.get(key)!.items.push(sub)
  }
  const groupList = [...groups.entries()]
    .sort((a, b) => teamOrderIndex(a[1].teamName) - teamOrderIndex(b[1].teamName))

  // 마운트(또는 뒤로가기로 인한 리마운트) 시 세션에 저장된 펼침 상태를 복원
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_PREFIX + parentTaskId)
      if (raw) setExpanded(new Set(JSON.parse(raw)))
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentTaskId])

  // 펼침 상태가 바뀔 때마다 세션에 저장 — 리마운트되어도(뒤로가기 등) 그대로 복원됨
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_PREFIX + parentTaskId, JSON.stringify([...expanded])) } catch {}
  }, [expanded, parentTaskId])

  // "전체 펼치기/접기" 버튼 — 마운트 시점의 버전은 무시하고, 실제 클릭(버전 변경)에만 반응
  const expandCtx = useA3Expand()
  const initialVersionRef = useRef(expandCtx?.version)
  useEffect(() => {
    if (!expandCtx) return
    if (expandCtx.version === initialVersionRef.current) return
    setExpanded(expandCtx.expandAll ? new Set(groupList.map(([teamId]) => teamId)) : new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandCtx?.version])

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSaveSummary = async (teamId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/a3/${parentTaskId}/team-summary`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, summary: editVal }),
      })
      if (res.ok) {
        setEditingTeamId(null)
        router.refresh()
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="border-t border-slate-100 divide-y divide-slate-100 bg-slate-50/40">
      {groupList.map(([teamId, { teamName, items }]) => {
        const isOpen = expanded.has(teamId)
        const c = teamColor(teamName)
        const doneCount = items.filter((i: any) => i.status === '완료').length
        const isEditing = editingTeamId === teamId
        const strategySummary = teamSummaries[teamId] ?? ''
        const summaryLines = strategySummary.split('\n').map(s => s.trim()).filter(Boolean)

        return (
          <div key={teamId}>
            {/* 팀 그룹 헤더 (클릭 시 펼침/접힘) */}
            <div
              onClick={() => !isEditing && toggle(teamId)}
              className={`w-full flex gap-2.5 px-4 py-2.5 hover:bg-white transition-colors cursor-pointer ${isEditing ? 'items-start' : 'items-center'}`}>
              <ChevronRight size={13}
                className={`${isEditing ? 'mt-1' : ''} text-slate-300 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''}`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${c.chip}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {teamName}
                  </span>
                  <span className="text-xs text-slate-400 font-medium shrink-0">
                    {items.length}건{doneCount > 0 && ` · 완료 ${doneCount}`}
                  </span>
                  {!isEditing && (
                    <>
                      <button type="button"
                        onClick={e => { e.stopPropagation(); setEditingTeamId(teamId); setEditVal(strategySummary) }}
                        className="p-1 text-slate-300 hover:text-slate-500 transition-colors shrink-0">
                        <Pencil size={11} />
                      </button>
                      {summaryLines.length > 0 && (
                        <span
                          className="text-xs text-slate-400 italic truncate min-w-0"
                          title={summaryLines.join('\n')}>
                          {summaryLines.map(l => `• "${l}"`).join('   ')}
                        </span>
                      )}
                    </>
                  )}
                  <div className="flex-1" />
                </div>

                {isEditing && (
                  <div className="mt-1.5 flex items-start gap-1.5" onClick={e => e.stopPropagation()}>
                    <textarea
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      rows={3}
                      placeholder={'이 팀의 전략을 줄바꿈으로 구분해 2~3줄로 요약해주세요'}
                      className="flex-1 min-w-0 text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none"
                      autoFocus
                    />
                    <div className="flex flex-col gap-1">
                      <button type="button" onClick={() => handleSaveSummary(teamId)} disabled={saving}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-40 transition">
                        {saving ? '...' : '저장'}
                      </button>
                      <button type="button" onClick={() => setEditingTeamId(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 self-center">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 팀과제 목록 */}
            {isOpen && (
              <div className="pb-1.5">
                {items.map((sub: any) => {
                  const subDd = dDay(sub.endDate)
                  const subStCls = STATUS_STYLE[sub.status] ?? 'bg-gray-100 text-gray-500'
                  const leaves: any[] = sub.subTasks ?? []
                  return (
                    <div key={sub.id}>
                      <Link href={`/a3/${sub.id}`}
                        className={`flex items-center gap-3 ml-20 mr-3 my-0.5 pl-3 pr-3 py-1 rounded-lg bg-white border border-l-[3px] border-slate-100 ${c.bar} hover:border-slate-200 hover:shadow-sm transition-all group`}>
                        <Layers size={12} className="text-slate-300 shrink-0" />
                        <span className="flex-1 text-xs text-slate-700 font-medium truncate">{sub.title}</span>
                        <span className="text-xs text-slate-400 font-medium shrink-0">오너 {sub.owner ?? '미배정'}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${subStCls}`}>{sub.status}</span>
                        {sub.confirmed && <span className="text-xs text-green-500 shrink-0">✓확정</span>}
                        {subDd && <span className={`text-xs font-medium shrink-0 ${subDd.cls}`}>{subDd.label}</span>}
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                      </Link>
                      {leaves.map((leaf: any) => {
                        const leafDd = dDay(leaf.endDate)
                        const leafStCls = STATUS_STYLE[leaf.status] ?? 'bg-gray-100 text-gray-500'
                        return (
                          <Link key={leaf.id} href={`/a3/${leaf.id}`}
                            className={`flex items-center gap-3 ml-32 mr-3 my-0.5 pl-3 pr-3 py-1 rounded-lg bg-slate-50/70 border border-l-[3px] border-slate-100 ${c.bar} hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all group`}>
                            <CornerDownRight size={11} className="text-slate-300 shrink-0" />
                            <span className="flex-1 text-xs text-slate-600 truncate">{leaf.title}</span>
                            <span className="text-xs text-slate-400 font-medium shrink-0">오너 {leaf.owner ?? '미배정'}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${leafStCls}`}>{leaf.status}</span>
                            {leaf.confirmed && <span className="text-xs text-green-500 shrink-0">✓확정</span>}
                            {leafDd && <span className={`text-xs font-medium shrink-0 ${leafDd.cls}`}>{leafDd.label}</span>}
                            <ChevronRight size={13} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                          </Link>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
