'use client'

import { useState } from 'react'
import { Plus, MessageSquareText, ChevronDown, Trash2 } from 'lucide-react'

type Suggestion = {
  id: string
  userId: string
  userName: string
  type: string
  title: string
  content: string
  status: string
  replyContent: string | null
  repliedByName: string | null
  repliedAt: string | null
  createdAt: string
}

const TYPES = ['제안', '버그', '질문'] as const
const TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  '제안': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  '버그': { bg: 'bg-red-100',    text: 'text-red-700' },
  '질문': { bg: 'bg-sky-100',    text: 'text-sky-700' },
}
const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  '대기':    { bg: 'bg-slate-100', text: 'text-slate-500' },
  '검토중':  { bg: 'bg-amber-100', text: 'text-amber-700' },
  '답변완료': { bg: 'bg-green-100', text: 'text-green-700' },
}

function fmt(d: string) {
  return new Date(d).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SuggestionsClient({
  initialSuggestions, myUserId, isAdmin,
}: {
  initialSuggestions: Suggestion[]
  myUserId: string
  isAdmin: boolean
}) {
  const [items, setItems] = useState<Suggestion[]>(initialSuggestions)
  const [typeFilter, setTypeFilter] = useState<string>('전체')
  const [unansweredOnly, setUnansweredOnly] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  /* 새 글 작성 */
  const [showForm, setShowForm] = useState(false)
  const [newType, setNewType] = useState<string>('제안')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [posting, setPosting] = useState(false)

  const handleSubmit = async () => {
    if (!newTitle.trim() || !newContent.trim()) return
    setPosting(true)
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newType, title: newTitle, content: newContent }),
      })
      const data = await res.json()
      setItems(prev => [data, ...prev])
      setNewTitle(''); setNewContent(''); setNewType('제안')
      setShowForm(false)
    } finally { setPosting(false) }
  }

  /* 관리자 답변/상태변경 */
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({})
  const [replying, setReplying] = useState<string | null>(null)

  const handleReply = async (id: string) => {
    const text = replyDraft[id]?.trim()
    if (!text) return
    setReplying(id)
    try {
      const res = await fetch(`/api/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyContent: text }),
      })
      const data = await res.json()
      setItems(prev => prev.map(s => s.id === id ? data : s))
      setReplyDraft(prev => ({ ...prev, [id]: '' }))
    } finally { setReplying(null) }
  }

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch(`/api/suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    setItems(prev => prev.map(s => s.id === id ? data : s))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    await fetch(`/api/suggestions/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(s => s.id !== id))
  }

  const filtered = items.filter(s => {
    if (typeFilter !== '전체' && s.type !== typeFilter) return false
    if (unansweredOnly && s.status === '답변완료') return false
    return true
  })

  return (
    <div className="p-6" style={{ maxWidth: '1000px' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 mb-4 rounded-xl" style={{ backgroundColor: '#111111' }}>
        <div>
          <h1 className="text-xl font-bold text-white">제안함</h1>
          <p className="text-xs mt-0.5" style={{ color: '#C5D42A' }}>시스템 관련 제안 · 버그 · 질문</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-white border border-white/20 px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
          <Plus size={14} /> 새 글쓰기
        </button>
      </div>

      {/* 작성 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {TYPES.map(t => (
              <button key={t} type="button" onClick={() => setNewType(t)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                  newType === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                }`}>
                {t}
              </button>
            ))}
          </div>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="제목"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-1 focus:ring-slate-300" />
          <textarea value={newContent} onChange={e => setNewContent(e.target.value)} rows={4}
            placeholder="내용을 자유롭게 적어주세요"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-slate-300" />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition">취소</button>
            <button onClick={handleSubmit} disabled={posting || !newTitle.trim() || !newContent.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition disabled:opacity-40">
              {posting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {(['전체', ...TYPES] as const).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              typeFilter === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {t}
          </button>
        ))}
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button onClick={() => setUnansweredOnly(v => !v)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            unansweredOnly ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}>
          미답변만
        </button>
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <MessageSquareText size={28} className="mx-auto text-slate-200 mb-2" />
          <p className="text-sm text-slate-400">등록된 글이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const isOpen = expandedId === s.id
            const typeStyle = TYPE_STYLE[s.type] ?? TYPE_STYLE['제안']
            const statusStyle = STATUS_STYLE[s.status] ?? STATUS_STYLE['대기']
            const canManage = isAdmin || s.userId === myUserId
            return (
              <div key={s.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button onClick={() => setExpandedId(isOpen ? null : s.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left">
                  <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${typeStyle.bg} ${typeStyle.text}`}>{s.type}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyle.bg} ${statusStyle.text}`}>{s.status}</span>
                  <span className="flex-1 min-w-0 text-sm font-semibold text-slate-800 truncate">{s.title}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{s.userName} · {fmt(s.createdAt)}</span>
                  <ChevronDown size={16} className={`shrink-0 text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 border-t border-slate-100">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pt-3">{s.content}</p>

                    {s.replyContent && (
                      <div className="mt-3 flex gap-2 bg-slate-50 rounded-lg px-4 py-3">
                        <span className="shrink-0 text-[11px] font-bold text-slate-400">답변</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{s.replyContent}</p>
                          <p className="text-[10px] text-slate-400 mt-1.5">{s.repliedByName} · {s.repliedAt ? fmt(s.repliedAt) : ''}</p>
                        </div>
                      </div>
                    )}

                    {isAdmin && (
                      <div className="mt-3 flex items-start gap-2">
                        <textarea
                          value={replyDraft[s.id] ?? ''}
                          onChange={e => setReplyDraft(prev => ({ ...prev, [s.id]: e.target.value }))}
                          rows={2}
                          placeholder={s.replyContent ? '답변 수정...' : '답변 작성...'}
                          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-slate-300"
                        />
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button onClick={() => handleReply(s.id)} disabled={replying === s.id || !(replyDraft[s.id] ?? '').trim()}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition disabled:opacity-40 whitespace-nowrap">
                            {replying === s.id ? '등록 중...' : '답변 등록'}
                          </button>
                          <select value={s.status} onChange={e => handleStatusChange(s.id, e.target.value)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300">
                            {Object.keys(STATUS_STYLE).map(st => <option key={st} value={st}>{st}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    {canManage && (
                      <div className="mt-3 flex justify-end">
                        <button onClick={() => handleDelete(s.id)}
                          className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-red-500 transition">
                          <Trash2 size={11} /> 삭제
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
