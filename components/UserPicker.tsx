'use client'

import { useState, useEffect, useRef } from 'react'
import { User } from 'lucide-react'

type UserOption = { id: string; name: string; team: { name: string } | null }

interface Props {
  value: string
  onChange: (name: string) => void
  placeholder?: string
}

export default function UserPicker({ value, onChange, placeholder = '이름 검색...' }: Props) {
  const [users,    setUsers]    = useState<UserOption[]>([])
  const [query,    setQuery]    = useState(value)
  const [open,     setOpen]     = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(setUsers)
      .catch(() => {})
  }, [])

  useEffect(() => { setQuery(value) }, [value])

  const filtered = query.trim()
    ? users.filter(u => u.name.toLowerCase().includes(query.toLowerCase()))
    : users

  const handleSelect = (name: string) => {
    onChange(name)
    setQuery(name)
    setOpen(false)
  }

  const handleBlur = (e: React.FocusEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      <div className="relative">
        <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full text-sm border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        {query && (
          <button type="button" tabIndex={-1}
            onClick={() => { onChange(''); setQuery(''); setOpen(false) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 text-base leading-none">
            ×
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-52 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map(u => (
              <button key={u.id} type="button" tabIndex={0}
                onMouseDown={() => handleSelect(u.name)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2 transition-colors">
                <span className="font-medium text-slate-800">{u.name}</span>
                {u.team && <span className="text-xs text-slate-400">{u.team.name}</span>}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-xs text-slate-400 text-center">검색 결과 없음</div>
          )}
          {query.trim() && !users.find(u => u.name === query.trim()) && (
            <button type="button" tabIndex={0}
              onMouseDown={() => handleSelect(query.trim())}
              className="w-full text-left px-4 py-2.5 text-xs text-slate-400 hover:bg-slate-50 border-t border-slate-100 transition-colors">
              &ldquo;{query.trim()}&rdquo; 직접 입력
            </button>
          )}
        </div>
      )}
    </div>
  )
}
