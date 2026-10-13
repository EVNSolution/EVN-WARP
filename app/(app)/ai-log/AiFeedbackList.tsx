'use client'

import { useState } from 'react'

/**
 * AI(CLEVER) 연결 피드백 목록 — 제목 한 줄 리스트, 클릭하면 본문·답변 확장.
 * 관리자는 펼친 자리에서 바로 답변을 남길 수 있다 (제안함과 같은 API).
 * AI 피드백은 제안함에 보이지 않으므로 답변 창구는 이 화면이 유일하다.
 */

export interface AiFeedback {
  id: string
  title: string
  userName: string
  content: string
  replyContent: string | null
  repliedByName: string | null
  createdAt: string // MM/DD
}

export default function AiFeedbackList({ feedbacks, isAdmin }: { feedbacks: AiFeedback[]; isAdmin: boolean }) {
  const [items, setItems] = useState(feedbacks)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const reply = async (id: string) => {
    const text = (drafts[id] ?? '').trim()
    if (!text) return
    setSaving(id)
    try {
      const res = await fetch(`/api/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyContent: text, status: '답변완료' }),
      })
      if (!res.ok) { window.alert('답변 등록에 실패했습니다.'); return }
      const updated = await res.json().catch(() => null)
      setItems(list => list.map(f => f.id === id
        ? { ...f, replyContent: text, repliedByName: updated?.repliedByName ?? '관리자' }
        : f))
      setDrafts(d => ({ ...d, [id]: '' }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl bg-white max-h-96 overflow-y-auto divide-y divide-slate-100">
      {items.map(f => {
        const title = f.title.replace(/^\[AI 피드백\]\s*/, '')
        return (
          <details key={f.id} className="group">
            <summary className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none list-none hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span className="text-[11px] text-slate-400 w-11 shrink-0">{f.createdAt}</span>
              <span className="text-xs font-semibold text-slate-600 w-14 shrink-0 truncate">{f.userName}</span>
              <span className="text-xs text-slate-700 truncate flex-1">{title}</span>
              {f.replyContent ? (
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">답변완료</span>
              ) : (
                <span className="shrink-0 text-[10px] text-slate-300">대기</span>
              )}
              <span className="shrink-0 text-slate-300 text-[10px] transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="px-4 pb-3 pt-1 bg-slate-50/60">
              <p className="text-xs text-slate-700 whitespace-pre-wrap ml-11">{f.content}</p>
              {f.replyContent && (
                <div className="mt-2 ml-11 border-l-2 border-emerald-200 pl-3 text-[11px] text-slate-500 whitespace-pre-wrap">
                  <b className="text-slate-600">{f.repliedByName ?? '관리자'}</b> — {f.replyContent}
                </div>
              )}
              {isAdmin && !f.replyContent && (
                <div className="mt-2 ml-11 flex gap-2">
                  <input value={drafts[f.id] ?? ''} onChange={e => setDrafts(d => ({ ...d, [f.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') void reply(f.id) }}
                    placeholder="답변 입력 (관리자)"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white" />
                  <button onClick={() => void reply(f.id)} disabled={saving === f.id || !(drafts[f.id] ?? '').trim()}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-40">
                    {saving === f.id ? '등록 중...' : '답변'}
                  </button>
                </div>
              )}
            </div>
          </details>
        )
      })}
    </div>
  )
}
