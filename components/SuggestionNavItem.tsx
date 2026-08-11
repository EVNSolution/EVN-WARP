'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquareText } from 'lucide-react'

export default function SuggestionNavItem({ isAdmin }: { isAdmin: boolean }) {
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
