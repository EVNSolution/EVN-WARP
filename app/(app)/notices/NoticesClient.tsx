'use client'

import { useState } from 'react'
import { Megaphone, Plus, Trash2 } from 'lucide-react'

type Announcement = {
  id: string; title: string; content: string; authorName: string
  targetScope: string; targetTeamsJson: string | null; createdAt: string
}
type Team = { id: string; name: string }

function fmt(d: string) {
  return new Date(d).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function targetLabel(a: Announcement): string {
  if (a.targetScope !== '팀') return '전체'
  try {
    const teams: string[] = a.targetTeamsJson ? JSON.parse(a.targetTeamsJson) : []
    return teams.length > 0 ? teams.join(', ') : '전체'
  } catch { return '전체' }
}

export default function NoticesClient({
  isManager, initialAnnouncements, teams,
}: {
  isManager: boolean
  initialAnnouncements: Announcement[]
  teams: Team[]
}) {
  const [items, setItems] = useState(initialAnnouncements)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [scope, setScope] = useState<'전체' | '팀'>('전체')
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [posting, setPosting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleTeam = (name: string) =>
    setSelectedTeams(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name])

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return
    setPosting(true)
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, targetScope: scope, targetTeams: scope === '팀' ? selectedTeams : [] }),
      })
      if (res.ok) {
        const data = await res.json()
        setItems(prev => [data, ...prev])
        setTitle(''); setContent(''); setScope('전체'); setSelectedTeams([])
        setShowForm(false)
      }
    } finally { setPosting(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 공지를 삭제할까요?')) return
    await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="p-6" style={{ maxWidth: '900px' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 mb-4 rounded-xl" style={{ backgroundColor: '#111111' }}>
        <div>
          <h1 className="text-xl font-bold text-white">공지사항</h1>
          <p className="text-xs mt-0.5" style={{ color: '#C5D42A' }}>전사 · 팀 공지</p>
        </div>
        {isManager && (
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-white border border-white/20 px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
            <Plus size={14} /> 공지 작성
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4 space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="제목"
            className="w-full text-sm font-semibold border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={5}
            placeholder="내용"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none" />
          <div>
            <div className="flex gap-1.5 mb-2">
              {(['전체', '팀'] as const).map(s => (
                <button key={s} type="button" onClick={() => setScope(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${scope === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                  {s === '전체' ? '전체 대상' : '특정 팀만'}
                </button>
              ))}
            </div>
            {scope === '팀' && (
              <div className="flex flex-wrap gap-1.5">
                {teams.map(t => (
                  <button key={t.id} type="button" onClick={() => toggleTeam(t.name)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${selectedTeams.includes(t.name) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={posting || !title.trim() || !content.trim()}
              className="px-4 py-2 text-sm font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 transition">
              {posting ? '게시 중...' : '게시'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition">취소</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {items.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-10">등록된 공지사항이 없습니다.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(a => {
              const isOpen = expandedId === a.id
              return (
                <div key={a.id}>
                  <button type="button" onClick={() => setExpandedId(isOpen ? null : a.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors">
                    <Megaphone size={14} className="text-indigo-400 shrink-0" />
                    <span className="text-sm font-semibold text-slate-800 flex-1 truncate">{a.title}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">{targetLabel(a)}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{a.authorName} · {fmt(a.createdAt)}</span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 pt-1">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg px-4 py-3">{a.content}</p>
                      {isManager && (
                        <button onClick={() => handleDelete(a.id)}
                          className="flex items-center gap-1 mt-2 text-[11px] text-slate-300 hover:text-red-500 transition">
                          <Trash2 size={11} /> 삭제
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
