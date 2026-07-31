'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, RotateCcw } from 'lucide-react'

interface Props {
  taskId: string
  status: string
}

export default function CompleteTaskButton({ taskId, status }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const isDone = status === '완료'

  async function toggle() {
    setSaving(true)
    try {
      await fetch(`/api/a3/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: isDone ? '진행중' : '완료' }),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  if (isDone) {
    return (
      <button onClick={toggle} disabled={saving}
        className="flex items-center gap-2 text-sm text-emerald-700 border border-emerald-300 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors font-medium disabled:opacity-50">
        <RotateCcw size={14} />
        {saving ? '처리 중...' : '완료 취소'}
      </button>
    )
  }

  return (
    <button onClick={toggle} disabled={saving}
      className="flex items-center gap-2 text-sm text-blue-700 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors font-medium disabled:opacity-50">
      <CheckCircle2 size={14} />
      {saving ? '처리 중...' : '완료 처리'}
    </button>
  )
}
