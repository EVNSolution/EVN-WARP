'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { ChevronsUpDown } from 'lucide-react'

type Ctx = { version: number; expandAll: boolean; trigger: () => void }
const A3ExpandContext = createContext<Ctx | null>(null)

export function A3ExpandProvider({ children }: { children: ReactNode }) {
  const [expandAll, setExpandAll] = useState(false)
  const [version, setVersion] = useState(0)
  const trigger = useCallback(() => {
    setExpandAll(v => !v)
    setVersion(v => v + 1)
  }, [])
  return (
    <A3ExpandContext.Provider value={{ version, expandAll, trigger }}>
      {children}
    </A3ExpandContext.Provider>
  )
}

export function useA3Expand() {
  return useContext(A3ExpandContext)
}

export function A3ExpandAllButton() {
  const ctx = useA3Expand()
  if (!ctx) return null
  return (
    <button onClick={ctx.trigger}
      className="flex items-center gap-1.5 text-white border border-white/20 px-3 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
      <ChevronsUpDown size={15} />
      {ctx.expandAll ? '전략과제 접기' : '전략과제 펼치기'}
    </button>
  )
}
