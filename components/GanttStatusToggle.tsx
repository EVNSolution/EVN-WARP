'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUSES = ['정상', '지연', '조치필요', '완료'] as const
type Status = typeof STATUSES[number]

const ACTIVE_CLS: Record<Status, string> = {
  '정상':    'bg-green-500  border-green-500',
  '지연':    'bg-yellow-400 border-yellow-400',
  '조치필요': 'bg-red-500    border-red-500',
  '완료':    'bg-blue-500   border-blue-500',
}
const IDLE_CLS: Record<Status, string> = {
  '정상':    'border-green-300  hover:bg-green-100',
  '지연':    'border-yellow-300 hover:bg-yellow-100',
  '조치필요': 'border-red-300    hover:bg-red-100',
  '완료':    'border-blue-300   hover:bg-blue-100',
}
// 이전 주에서 이어받은 상태 표시 (점선 테두리, 속이 빈 채로)
const INHERITED_CLS: Record<Status, string> = {
  '정상':    'border-green-400  border-dashed hover:bg-green-100',
  '지연':    'border-yellow-400 border-dashed hover:bg-yellow-100',
  '조치필요': 'border-red-400    border-dashed hover:bg-red-100',
  '완료':    'border-blue-400   border-dashed hover:bg-blue-100',
}

interface Props {
  taskId:         string
  teamId:         string
  weekId:         string
  weekStart:      string
  updateId?:      string
  currentStatus?: string
  prevStatus?:    string
}

export default function GanttStatusToggle({
  taskId, teamId, weekId, weekStart, updateId, currentStatus, prevStatus,
}: Props) {
  const router = useRouter()
  const [status, setStatus]         = useState<string | undefined>(currentStatus)
  const [resolvedId, setResolvedId] = useState<string | undefined>(updateId)
  const [saving, setSaving]         = useState(false)

  async function handleClick(next: Status) {
    if (saving) return
    setSaving(true)
    try {
      if (resolvedId) {
        await fetch(`/api/weekly/${resolvedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        })
      } else {
        const res = await fetch('/api/weekly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, teamId, week: weekId, weekStart, status: next }),
        })
        const data = await res.json()
        if (data.id) setResolvedId(data.id)
      }
      setStatus(next)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const inherited = !status && prevStatus && STATUSES.includes(prevStatus as Status)
    ? prevStatus as Status
    : undefined

  return (
    <div
      className={`flex gap-1.5 ${saving ? 'opacity-50 pointer-events-none' : ''}`}
      title={inherited ? `이전 주 상태: ${inherited} (클릭하면 이번 주에 저장됩니다)` : undefined}
    >
      {STATUSES.map(s => {
        const isActive    = status === s
        const isInherited = !status && s === inherited
        return (
          <button
            key={s}
            onClick={() => handleClick(s)}
            title={s}
            className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
              isActive
                ? ACTIVE_CLS[s]
                : isInherited
                ? `bg-white ${INHERITED_CLS[s]}`
                : `bg-white ${IDLE_CLS[s]}`
            }`}
          />
        )
      })}
    </div>
  )
}
