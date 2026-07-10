'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X } from 'lucide-react'

interface Notif {
  id: string
  tripId: string | null
  type: string
  message: string
  link: string | null
  read: boolean
  createdAt: string
}

const TYPE_ICON: Record<string, string> = {
  approval_request: '📋',
  approved:         '✅',
  rejected:         '❌',
}

export default function NotificationBell() {
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const [toasts, setToasts] = useState<Notif[]>([])
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const knownIds = useRef<Set<string> | null>(null)

  const fetchNotifs = async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data: Notif[] = await res.json()

      if (knownIds.current === null) {
        // 첫 로드 시 미읽음 알림은 최대 3개까지 토스트로 표시
        knownIds.current = new Set(data.map(n => n.id))
        const unread = data.filter(n => !n.read).slice(0, 3)
        if (unread.length > 0) setToasts(unread)
      } else {
        // 이후 폴링에서 새로 온 미읽음 알림만 토스트로 표시
        const newUnread = data.filter(n => !n.read && !knownIds.current!.has(n.id))
        if (newUnread.length > 0) {
          setToasts(prev => [...prev, ...newUnread])
          newUnread.forEach(n => knownIds.current!.add(n.id))
        }
      }

      setNotifs(data)
    } catch {}
  }

  useEffect(() => {
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 30_000)
    return () => clearInterval(interval)
  }, [])

  // 토스트 자동 제거 (6초)
  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1))
    }, 6000)
    return () => clearTimeout(timer)
  }, [toasts])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const unread = notifs.filter(n => !n.read).length

  const handleClick = async (notif: Notif) => {
    if (!notif.read) {
      await fetch(`/api/notifications/${notif.id}`, { method: 'PATCH' })
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
    }
    setOpen(false)
    if (notif.link) router.push(notif.link)
  }

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const handleToastClick = async (toast: Notif) => {
    dismissToast(toast.id)
    await fetch(`/api/notifications/${toast.id}`, { method: 'PATCH' })
    setNotifs(prev => prev.map(n => n.id === toast.id ? { ...n, read: true } : n))
    if (toast.link) router.push(toast.link)
  }

  const markAllRead = async () => {
    const unreadIds = notifs.filter(n => !n.read).map(n => n.id)
    await Promise.all(unreadIds.map(id => fetch(`/api/notifications/${id}`, { method: 'PATCH' })))
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <>
      {/* 토스트 팝업 - 우상단 고정 */}
      <div className="fixed top-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl shadow-2xl px-4 py-3 max-w-xs"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              animation: 'notif-slide-in 0.3s ease-out',
            }}
          >
            <span className="text-lg shrink-0 mt-0.5">{TYPE_ICON[toast.type] ?? '🔔'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 leading-snug break-words">{toast.message}</p>
              {toast.link && (
                <button
                  onClick={() => handleToastClick(toast)}
                  className="mt-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  바로 가기 →
                </button>
              )}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-slate-300 hover:text-slate-500 transition-colors shrink-0 mt-0.5"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes notif-slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* 사이드바 알림 벨 */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="relative flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-all"
          style={{ color: open ? '#ffffff' : '#888' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ccc' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = open ? '#ffffff' : '#888' }}
        >
          <Bell size={13} />
          알림
          {unread > 0 && (
            <span
              className="absolute top-1.5 left-5 min-w-[16px] h-4 rounded-full text-[9px] font-bold flex items-center justify-center px-0.5 text-black"
              style={{ backgroundColor: '#C5D42A' }}
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {open && (
          <div
            className="absolute bottom-10 left-0 w-72 rounded-xl shadow-2xl overflow-hidden z-50"
            style={{ backgroundColor: '#1c1c1c', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span className="text-xs font-bold text-white">
                알림 {unread > 0 && (
                  <span
                    className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-black"
                    style={{ backgroundColor: '#C5D42A' }}
                  >{unread}</span>
                )}
              </span>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] transition-colors"
                  style={{ color: '#555' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#999' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555' }}
                >
                  모두 읽음
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <p className="text-center text-xs py-8" style={{ color: '#444' }}>알림이 없습니다</p>
              ) : (
                notifs.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className="w-full text-left px-4 py-3 flex items-start gap-2.5 text-xs transition-all"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      backgroundColor: n.read ? 'transparent' : 'rgba(197,212,42,0.07)',
                      color: n.read ? '#555' : '#ccc',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = n.read ? 'transparent' : 'rgba(197,212,42,0.07)' }}
                  >
                    <span className="shrink-0 mt-0.5 text-sm">
                      {TYPE_ICON[n.type] ?? '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="leading-snug break-words">{n.message}</p>
                      <p className="mt-0.5 text-[10px]" style={{ color: '#3a3a3a' }}>
                        {new Date(n.createdAt).toLocaleString('ko-KR', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {!n.read && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0 mt-1"
                        style={{ backgroundColor: '#C5D42A' }}
                      />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
