'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

export type AuditEntry = {
  id: string
  createdAt: string
  actorName: string
  reason: string
  summary: string
}

function formatAuditDate(createdAt: string) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return createdAt
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

export default function SalesProcessHistory({ audit, dealId, canDelete = false }: {
  audit: AuditEntry[]; dealId?: string; canDelete?: boolean
}) {
  const router = useRouter()
  const contentId = useId()
  const [expanded, setExpanded] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [removed, setRemoved] = useState<string[]>([])
  const [error, setError] = useState('')
  const entries = audit.filter(entry => !removed.includes(entry.id))

  async function deleteEntry(entryId: string) {
    if (!canDelete || !dealId || deleting) return
    setDeleting(true); setError('')
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/process-audit/${encodeURIComponent(entryId)}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok || result.ok !== true) throw new Error(result.error || '변경 기록 삭제에 실패했습니다.')
      setRemoved(previous => [...previous, entryId]); setConfirmId(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '변경 기록 삭제에 실패했습니다. 다시 시도해 주세요.')
    } finally { setDeleting(false) }
  }

  return <div role="region" aria-label="최근 변경 기록" className="border-t border-slate-200 pt-2">
    <button type="button" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)} className="flex min-h-11 w-full items-center gap-2 rounded-lg text-sm font-semibold text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600">
      최근 변경 기록 <span className="text-xs font-normal text-slate-500">({entries.length}건)</span>
      <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
    </button>
    <div id={contentId} hidden={!expanded}>
    {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
    {entries.length === 0 ? <p className="py-2 text-xs text-slate-500">표시할 변경 기록이 없습니다.</p> :
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-3">
        {entries.map(entry => <li key={entry.id} className="py-2.5 text-xs leading-5 text-slate-600">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 break-words">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="font-semibold text-slate-800">{entry.actorName}</span>
                <time dateTime={entry.createdAt}>{formatAuditDate(entry.createdAt)} KST</time>
              </div>
              <p>{entry.summary}</p>
              {entry.reason && <p className="text-slate-500">사유: {entry.reason}</p>}
            </div>
            {canDelete && dealId && <button type="button" disabled={deleting} onClick={() => {setConfirmId(entry.id);setError('')}}
              className="min-h-11 shrink-0 rounded-lg px-3 text-red-700 hover:bg-red-50 disabled:opacity-50">삭제</button>}
          </div>
          {confirmId === entry.id && <div className="mt-2 rounded-lg bg-slate-50 p-3">
            <p>이 변경 기록을 목록에서 삭제할까요? 원본 이력과 삭제 내역은 보관됩니다.</p>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" disabled={deleting} onClick={() => setConfirmId(null)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 disabled:opacity-50">취소</button>
              <button type="button" disabled={deleting} onClick={() => deleteEntry(entry.id)} className="min-h-11 rounded-lg bg-red-600 px-3 font-semibold text-white disabled:opacity-50">{deleting ? '삭제 중…' : '삭제 확인'}</button>
            </div>
          </div>}
        </li>)}
      </ul>}
    </div>
  </div>
}
