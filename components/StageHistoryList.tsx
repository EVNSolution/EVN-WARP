'use client'

import { useEffect, useState } from 'react'
import { getProcess } from '@/lib/pipeline'

type HistoryRow = {
  id: string
  fromStageCode: string | null
  toStageCode: string
  changedBy: string | null
  changedAt: string
}

function stageLabel(code: string | null) {
  if (!code) return '리드 등록'
  return getProcess(code)?.name ?? code
}

function fmt(d: string) {
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export default function StageHistoryList({ dealId }: { dealId: string }) {
  const [rows, setRows]       = useState<HistoryRow[] | null>(null)

  useEffect(() => {
    fetch(`/api/deals/${dealId}/stage-history`)
      .then(r => r.json())
      .then(setRows)
      .catch(() => setRows([]))
  }, [dealId])

  if (rows === null) {
    return <div className="text-center py-10 text-slate-300 text-sm">불러오는 중...</div>
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-10 text-slate-300 text-sm border border-dashed border-slate-200 rounded-xl">
        아직 단계 변경 이력이 없습니다
      </div>
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
      {rows.map(r => (
        <div key={r.id} className="px-4 py-3 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
          <span className="text-xs text-slate-600 font-medium shrink-0">
            {stageLabel(r.fromStageCode)}
            <span className="text-slate-300 mx-1.5">→</span>
            <span className="text-slate-800 font-semibold">{stageLabel(r.toStageCode)}</span>
          </span>
          <span className="flex-1" />
          <span className="text-[11px] text-slate-400 shrink-0">{fmt(r.changedAt)}</span>
          {r.changedBy && (
            <span className="text-[11px] text-slate-400 shrink-0">· {r.changedBy}</span>
          )}
        </div>
      ))}
    </div>
  )
}
