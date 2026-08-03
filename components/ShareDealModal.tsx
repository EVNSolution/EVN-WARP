'use client'

import { useState } from 'react'
import { Share2, X } from 'lucide-react'
import AssigneePicker from '@/components/AssigneePicker'

type Team = { id: string; name: string }
export type ShareRecord = {
  id: string
  sharedBy: string | null
  targetTeam: string | null
  targetUser: string | null
  createdAt: string
}

interface Props {
  dealId: string
  teams: Team[]
  onShared: (share: ShareRecord) => void
}

export default function ShareDealModal({ dealId, teams, onShared }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'team' | 'user'>('team')
  const [teamId, setTeamId] = useState('')
  const [userName, setUserName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleClose() {
    setOpen(false)
    setTeamId(''); setUserName(''); setError(''); setMode('team')
  }

  async function handleSave() {
    if (mode === 'team' && !teamId) { setError('팀을 선택해주세요'); return }
    if (mode === 'user' && !userName) { setError('담당자를 선택해주세요'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/deals/${dealId}/share`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'team' ? { mode, teamId } : { mode, userName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '공유 실패')
      onShared(data)
      handleClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
        <Share2 size={13} /> 공유
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">리드 공유</h3>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setMode('team')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    mode === 'team' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}>
                  팀 전체
                </button>
                <button type="button" onClick={() => setMode('user')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    mode === 'user' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}>
                  개인
                </button>
              </div>

              {mode === 'team' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">공유할 팀 <span className="text-red-500">*</span></label>
                  <select value={teamId} onChange={e => setTeamId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">— 선택하세요 —</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1.5">선택한 팀의 전체 구성원에게 알림이 전송됩니다</p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">공유할 담당자 <span className="text-red-500">*</span></label>
                  <AssigneePicker value={userName} onChange={setUserName}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button onClick={handleClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50">
                취소
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? '공유 중...' : '공유'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
