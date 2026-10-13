'use client'

import { useEffect, useRef, useState } from 'react'
import { Paperclip, Send, X } from 'lucide-react'

/**
 * 활동 댓글 패널 — 활동 하나에 대한 대화 이력. 동반자·동료 누구나 댓글과 파일을 남길 수 있다.
 * 캘린더 활동 팝업의 오른쪽과 활동 편집 화면 하단에서 함께 쓴다.
 */

export interface ActivityCommentItem {
  id: string
  userId: string
  userName: string
  content: string
  files: string[]
  createdAt: string
}

function fileName(url: string) {
  const seg = decodeURIComponent(url.split('/').pop() ?? url)
  return seg.replace(/^\d+_/, '')
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ActivityComments({ activityId, myUserId, isAdmin }: {
  activityId: string
  myUserId: string
  isAdmin: boolean
}) {
  const [comments, setComments] = useState<ActivityCommentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [pending, setPending] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/activities/${activityId}/comments`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (alive) setComments(Array.isArray(data) ? data : []) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [activityId])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [comments.length, loading])

  const submit = async () => {
    if (saving || (!text.trim() && pending.length === 0)) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('content', text.trim())
      for (const f of pending) fd.append('files', f)
      const res = await fetch(`/api/activities/${activityId}/comments`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.id) { window.alert(data?.error ?? '댓글 등록에 실패했습니다.'); return }
      setComments(prev => [...prev, data])
      setText('')
      setPending([])
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('이 댓글을 삭제할까요?')) return
    const res = await fetch(`/api/activities/${activityId}/comments/${id}`, { method: 'DELETE' })
    if (res.ok) setComments(prev => prev.filter(c => c.id !== id))
    else window.alert('삭제에 실패했습니다.')
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <h4 className="text-xs font-bold text-slate-600">댓글 · 이력 <span className="font-normal text-slate-400">{comments.length > 0 && `${comments.length}`}</span></h4>
        <p className="text-[10px] text-slate-400 mt-0.5">동반자·동료 누구나 메모와 파일을 남길 수 있습니다</p>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <p className="text-[11px] text-slate-300 text-center py-4">불러오는 중...</p>
        ) : comments.length === 0 ? (
          <p className="text-[11px] text-slate-300 text-center py-4">아직 댓글이 없습니다 — 첫 이력을 남겨보세요.</p>
        ) : comments.map(c => (
          <div key={c.id} className="group">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-semibold text-slate-700">{c.userName}</span>
              <span className="text-[10px] text-slate-300">{fmtTime(c.createdAt)}</span>
              {(c.userId === myUserId || isAdmin) && (
                <button onClick={() => void remove(c.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-opacity" title="삭제">
                  <X size={11} />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-600 whitespace-pre-wrap mt-0.5">{c.content}</p>
            {c.files.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {c.files.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-teal-700 bg-teal-50 border border-teal-200 rounded hover:underline">
                    <Paperclip size={9} />{fileName(url)}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-3 py-2.5 border-t border-slate-100 shrink-0">
        {pending.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {pending.map((f, i) => (
              <span key={i} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-600 bg-slate-100 rounded">
                <Paperclip size={9} />{f.name}
                <button onClick={() => setPending(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-slate-400 hover:text-red-400"><X size={9} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={1}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit() } }}
            placeholder="댓글 입력 (Enter 등록)"
            className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <button onClick={() => fileRef.current?.click()} title="파일 첨부"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-teal-500 hover:border-teal-200">
            <Paperclip size={13} />
          </button>
          <button onClick={() => void submit()} disabled={saving || (!text.trim() && pending.length === 0)} title="등록"
            className="p-1.5 rounded-lg bg-slate-900 text-white disabled:opacity-30">
            <Send size={13} />
          </button>
        </div>
        <input ref={fileRef} type="file" multiple className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.hwp,.ppt,.pptx,.txt,.zip"
          onChange={e => {
            const files = Array.from(e.target.files ?? [])
            if (files.length) setPending(prev => [...prev, ...files])
            e.target.value = ''
          }} />
      </div>
    </div>
  )
}
