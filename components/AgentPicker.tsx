'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Users, Building2, Plus, X } from 'lucide-react'

export type AgentOption = {
  id: string
  _sourceType?: 'user' | 'customer'
  _sourceId?: string
  name: string
  phone: string | null
  email: string | null
  company: string | null
  type: string
  user: { name: string; team: { name: string } | null } | null
  customer: { name: string; phone: string | null } | null
  _count: { deals: number }
}

interface Props {
  value: { id: string; name: string } | null
  onChange: (agent: { id: string; name: string } | null) => void
  onCreateNew?: (name: string) => void
}

export default function AgentPicker({ value, onChange, onCreateNew }: Props) {
  const [agents,   setAgents]   = useState<AgentOption[]>([])
  const [query,    setQuery]    = useState('')
  const [open,     setOpen]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [dropPos,  setDropPos]  = useState({ top: 0, left: 0, width: 320 })
  const [mounted,  setMounted]  = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const dropdownRef  = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const updatePos = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open, updatePos])

  // document mousedown으로 외부 클릭 감지 — onBlur 방식보다 안정적
  useEffect(() => {
    if (!open) return
    const handleOutsideMousedown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideMousedown)
    return () => document.removeEventListener('mousedown', handleOutsideMousedown)
  }, [open])

  const fetchAgents = async (q: string) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/agents?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setAgents(Array.isArray(data) ? data : [])
    } catch {
      setAgents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) fetchAgents(query)
  }, [open, query])

  const handleSelect = async (a: AgentOption) => {
    setOpen(false)
    setQuery('')

    if (a._sourceType === 'user' || a._sourceType === 'customer') {
      setLoading(true)
      try {
        const body: Record<string, unknown> = {
          name:  a.name,
          phone: a.phone,
          email: a.email,
          type:  a.type,
          ...(a._sourceType === 'user'     && { userId:     a._sourceId }),
          ...(a._sourceType === 'customer' && { customerId: a._sourceId }),
        }
        const res  = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        const agent = data.agent ?? data
        if (agent?.id) {
          onChange({ id: agent.id, name: agent.name })
        } else {
          console.error('[AgentPicker] POST 실패:', res.status, data)
        }
      } catch (err) {
        console.error('[AgentPicker] POST 오류:', err)
      } finally {
        setLoading(false)
      }
    } else {
      onChange({ id: a.id, name: a.name })
    }
  }

  const handleClear = () => { onChange(null); setQuery('') }

  /* 선택된 상태 */
  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 border border-indigo-200 rounded-xl bg-indigo-50">
        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">{value.name.charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{value.name}</p>
          <p className="text-[10px] text-indigo-500">소개인 선택됨</p>
        </div>
        <button type="button" onClick={handleClear}
          className="shrink-0 text-slate-400 hover:text-red-500 transition-colors">
          <X size={14} />
        </button>
      </div>
    )
  }

  /* 드롭다운 JSX — body에 portal로 렌더링 */
  const dropdownEl = open ? (
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 99999 }}
      className="bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto"
    >
      {agents.length === 0 && !loading && (
        <div className="px-4 py-3 text-xs text-slate-400 text-center">
          {query ? '검색 결과 없음' : '이름을 입력해 검색하세요'}
        </div>
      )}
      {loading && (
        <div className="px-4 py-3 text-xs text-slate-400 text-center flex items-center justify-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          검색 중...
        </div>
      )}

      {agents.map(a => (
        <button key={a.id} type="button"
          onClick={() => handleSelect(a)}
          className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 transition-colors border-b border-slate-50 last:border-b-0">

          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold
            ${a.type === '내부' ? 'bg-indigo-500' : 'bg-teal-500'}`}>
            {a.type === '내부' ? <Users size={13} /> : <Building2 size={13} />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">{a.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
                ${a.type === '내부' ? 'bg-indigo-100 text-indigo-600' : 'bg-teal-100 text-teal-600'}`}>
                {a.type}
              </span>
              {a._sourceType && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">
                  선택 시 등록
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate">
              {a.type === '내부'
                ? a.user?.team?.name ?? '팀 미배정'
                : a.company ?? a.phone ?? a.customer?.phone ?? '—'}
            </p>
          </div>

          {a._count.deals > 0 && (
            <span className="text-[10px] text-slate-400 shrink-0">{a._count.deals}건</span>
          )}
        </button>
      ))}

      {onCreateNew && (
        <button type="button"
          onClick={() => { onCreateNew(query); setOpen(false) }}
          className="w-full text-left px-4 py-2.5 text-xs text-indigo-500 hover:bg-indigo-50 border-t border-slate-100 flex items-center gap-2 transition-colors font-semibold">
          <Plus size={12} />
          {query ? `"${query}" 새 소개인로 등록` : '새 소개인 등록'}
        </button>
      )}
    </div>
  ) : null

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Users size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => { setOpen(true); updatePos() }}
          placeholder="소개인 이름 검색 (임직원 / 외부 소개인)..."
          className="w-full text-sm border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        )}
      </div>

      {mounted && dropdownEl && createPortal(dropdownEl, document.body)}
    </div>
  )
}
