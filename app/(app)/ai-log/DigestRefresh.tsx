'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

/**
 * 주간회의 브리핑 새로고침 — 재생성 주기(업무시간 1시간 / 그 외 3시간)가 지났으면
 * 새로 생성해 보여주고, 주기 안이면 기존 요약을 그대로 다시 불러온다 (AI 재호출 없음).
 */
export default function DigestRefresh() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      onClick={async () => {
        setBusy(true)
        try {
          await fetch('/api/ai-digest/refresh', { method: 'POST' })
          router.refresh()
        } finally {
          setBusy(false)
        }
      }}
      disabled={busy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
      <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
      {busy ? '생성 중…' : '새로고침'}
    </button>
  )
}
