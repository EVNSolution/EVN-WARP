'use client'

import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import ProcessGuideModal from './ProcessGuideModal'

export default function ProcessGuideButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        style={{ background: 'rgba(255,255,255,0.1)', color: '#C5D42A', border: '1px solid rgba(197,212,42,0.3)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(197,212,42,0.15)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)' }}
      >
        <BookOpen size={13} />
        프로세스 가이드
      </button>
      {open && <ProcessGuideModal onClose={() => setOpen(false)} />}
    </>
  )
}
