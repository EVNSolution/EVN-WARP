'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export default function TripDeleteButton({ tripId }: { tripId: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setBusy(true)
    await fetch(`/api/trips/${tripId}`, { method: 'DELETE' })
    router.refresh()
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1 shrink-0" onClick={e => { e.preventDefault(); e.stopPropagation() }}>
        <button onClick={() => setConfirm(false)}
          className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition-all">
          취소
        </button>
        <button onClick={handleDelete} disabled={busy}
          className="px-2 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50 transition-all">
          {busy ? '삭제 중…' : '삭제 확인'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); setConfirm(true) }}
      className="shrink-0 p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
      title="삭제">
      <Trash2 size={14} />
    </button>
  )
}
