'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'

type Team = { id: string; name: string }
type TopTask = { id: string; code: string; title: string; strategy: string }

interface Props {
  teams: Team[]
  ceoTeamId: string
  topTasks?: TopTask[]
  presetParentId?: string
  buttonLabel?: string
  buttonClassName?: string
}

export default function QuickTaskModal({ teams, ceoTeamId, topTasks = [], presetParentId, buttonLabel, buttonClassName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'top' | 'team'>(presetParentId ? 'team' : 'top')
  const [title, setTitle] = useState('')
  const [teamId, setTeamId] = useState('')
  const [parentId, setParentId] = useState(presetParentId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectableTeams = teams.filter(t => t.id !== ceoTeamId)

  function handleClose() {
    setOpen(false)
    setTitle(''); setTeamId(''); setError('')
    if (!presetParentId) { setParentId(''); setKind('top') }
  }

  async function handleSave() {
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    if (kind === 'team' && !teamId) { setError('담당 팀을 선택해주세요'); return }
    if (kind === 'team' && !parentId) { setError('상위 전사과제를 선택해주세요'); return }

    setSaving(true); setError('')
    try {
      const body = kind === 'top'
        ? { title: title.trim(), teamId: ceoTeamId }
        : { title: title.trim(), teamId, parentId }
      const res = await fetch('/api/a3', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? '저장 실패')
      }
      handleClose()
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={buttonClassName ?? 'flex items-center gap-1.5 text-xs font-semibold text-white border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors'}>
        <Plus size={12} /> {buttonLabel ?? (presetParentId ? '팀과제 추가' : '전략과제 추가')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
          <div className="relative m-auto w-full bg-white rounded-2xl shadow-2xl" style={{ maxWidth: '420px' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                {kind === 'top' ? '전사과제 추가' : '팀과제 추가'}
              </h3>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-4">
              {!presetParentId && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setKind('top')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      kind === 'top' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                    }`}>
                    전사과제
                  </button>
                  <button type="button" onClick={() => setKind('team')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      kind === 'team' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                    }`}>
                    팀과제
                  </button>
                </div>
              )}

              {kind === 'team' && !presetParentId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">상위 전사과제 <span className="text-red-500">*</span></label>
                  <select value={parentId} onChange={e => setParentId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">— 선택하세요 —</option>
                    {topTasks.map(t => (
                      <option key={t.id} value={t.id}>{t.code} · {t.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {kind === 'team' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">담당 팀 <span className="text-red-500">*</span></label>
                  <select value={teamId} onChange={e => setTeamId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">— 선택하세요 —</option>
                    {selectableTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">제목 <span className="text-red-500">*</span></label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder={kind === 'top' ? '예: 신규 사업 전략' : '예: CLEVER 제품화 및 구독 사업 확대'}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button onClick={handleClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50">
                취소
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
