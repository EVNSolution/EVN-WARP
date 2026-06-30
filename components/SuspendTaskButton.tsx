'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PauseCircle, PlayCircle, X } from 'lucide-react'

interface Props {
  taskId: string
  suspended: boolean
  suspendedAt?: string | null
  suspendReason?: string | null
}

export default function SuspendTaskButton({ taskId, suspended, suspendReason }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSuspend() {
    if (!reason.trim()) { setError('중단 사유를 입력해 주세요.'); return }
    setSaving(true)
    try {
      await fetch(`/api/a3/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suspended: true,
          suspendedAt: new Date().toISOString(),
          suspendReason: reason.trim(),
        }),
      })
      setShowModal(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleRevive() {
    setSaving(true)
    try {
      await fetch(`/api/a3/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suspended: false,
          suspendedAt: null,
          suspendReason: null,
        }),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  if (suspended) {
    return (
      <button
        onClick={handleRevive}
        disabled={saving}
        className="flex items-center gap-2 text-sm text-emerald-700 border border-emerald-300 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors font-medium disabled:opacity-50"
      >
        <PlayCircle size={14} />
        {saving ? '처리 중...' : '과제 부활'}
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => { setShowModal(true); setReason(''); setError('') }}
        className="flex items-center gap-2 text-sm text-orange-700 border border-orange-200 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors font-medium"
      >
        <PauseCircle size={14} /> 중단 처리
      </button>

      {/* 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PauseCircle size={18} className="text-orange-500" />
                <h2 className="text-base font-bold text-slate-900">과제 중단 처리</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-slate-500 mb-4">
                중단된 과제는 일반 목록과 간트차트에서 숨겨지며, A3 과제장표의
                <span className="font-semibold text-slate-700"> "중단된 과제"</span> 항목에서 별도 관리됩니다.
              </p>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                중단 사유 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={e => { setReason(e.target.value); setError('') }}
                rows={4}
                placeholder="중단 사유를 입력하세요 (예: 예산 미확보, 시장 환경 변화, 우선순위 조정 등)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
                autoFocus
              />
              {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSuspend}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                <PauseCircle size={14} />
                {saving ? '처리 중...' : '중단 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
