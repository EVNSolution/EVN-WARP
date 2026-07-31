'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit, X } from 'lucide-react'
import AssigneePicker from '@/components/AssigneePicker'

type Team = { id: string; name: string }

interface Props {
  taskId: string
  initialTitle: string
  initialTeamId: string
  initialOwner: string
  teams: Team[]
  ceoTeamId: string
}

export default function BasicInfoEditModal({ taskId, initialTitle, initialTeamId, initialOwner, teams, ceoTeamId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [teamId, setTeamId] = useState(initialTeamId)
  const [owner, setOwner] = useState(initialOwner)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectableTeams = teams.filter(t => t.id !== ceoTeamId)

  function handleClose() {
    setOpen(false)
    setTitle(initialTitle); setTeamId(initialTeamId); setOwner(initialOwner); setError('')
  }

  async function handleSave() {
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/a3/${taskId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), teamId, owner }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? '저장 실패')
      }
      setOpen(false)
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
        className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
        <Edit size={14} /> 수정
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
          <div className="relative m-auto w-full bg-white rounded-2xl shadow-2xl" style={{ maxWidth: '420px' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">기본 정보 수정</h3>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">제목 <span className="text-red-500">*</span></label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              {teamId !== ceoTeamId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">담당 팀</label>
                  <select value={teamId} onChange={e => setTeamId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    {selectableTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">과제 오너</label>
                <AssigneePicker value={owner} onChange={setOwner}
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
