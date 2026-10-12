'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquareText } from 'lucide-react'

export default function SuggestionNavItem({ isAdmin, compact = false }: { isAdmin: boolean; compact?: boolean }) {
  const pathname = usePathname()
  const active = pathname.startsWith('/suggestions')
  const [unanswered, setUnanswered] = useState(0)

  useEffect(() => {
    if (!isAdmin) return
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/suggestions')
        if (!res.ok) return
        const data: { status: string }[] = await res.json()
        setUnanswered(data.filter(s => s.status !== '답변완료').length)
      } catch {}
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30_000)
    return () => clearInterval(interval)
  }, [isAdmin])

  if (compact) {
    return (
      <Link
        href="/suggestions"
        className="relative flex flex-col items-center gap-1 py-1.5 rounded-lg transition-all"
        style={{ color: active ? '#C5D42A' : '#888' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = active ? '#C5D42A' : '#ccc' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = active ? '#C5D42A' : '#888' }}
      >
        <span className="relative">
          <MessageSquareText size={15} />
          {unanswered > 0 && (
            <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] rounded-full text-[9px] font-bold flex items-center justify-center px-0.5 text-black"
              style={{ backgroundColor: '#C5D42A' }}>
              {unanswered > 9 ? '9+' : unanswered}
            </span>
          )}
        </span>
        <span className="text-[10px] leading-none">제안</span>
      </Link>
    )
  }

  return (
    <Link
      href="/suggestions"
      className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
      style={{ color: active ? '#C5D42A' : '#555' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = active ? '#C5D42A' : '#999' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = active ? '#C5D42A' : '#555' }}
    >
      <MessageSquareText size={13} />
      제안함
      {unanswered > 0 && (
        <span
          className="absolute top-1.5 left-6 min-w-[16px] h-4 rounded-full text-[9px] font-bold flex items-center justify-center px-0.5 text-black"
          style={{ backgroundColor: '#C5D42A' }}
        >
          {unanswered > 9 ? '9+' : unanswered}
        </span>
      )}
    </Link>
  )
}
