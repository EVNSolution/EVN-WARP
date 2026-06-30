'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Target, Users, BookOpen, Filter, UserRound, Settings2 } from 'lucide-react'
import LogoutButton from './LogoutButton'

const navItems = [
  { href: '/dashboard', label: '경영 대시보드', icon: LayoutDashboard },
  { href: '/a3',        label: '전략과제 A3',   icon: Target },
  { href: '/weekly',    label: '주간업무',  icon: Users },
  { href: '/notes',     label: '업무공간',  icon: BookOpen },
  { href: '/funnel',    label: '영업퍼널',  icon: Filter },
]

interface Props { userName: string; userEmail: string }

export default function Sidebar({ userName, userEmail }: Props) {
  const pathname = usePathname()

  return (
    <aside className="w-56 min-h-screen flex flex-col" style={{ backgroundColor: '#111111' }}>

      {/* 로고 */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 11, color: '#bbb', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          EV<span style={{ color: '#C5D42A' }}>&</span>Solution
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.04em', lineHeight: 1 }}>
          WARP
        </div>
        <div style={{ fontSize: 10, marginTop: 5, color: '#C5D42A', fontStyle: 'italic', letterSpacing: '0.04em' }}>
          green &amp; reliable
        </div>
      </div>

      {/* 내비게이션 */}
      <nav className="flex-1 px-3 py-4" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
              style={{
                fontWeight: active ? 600 : 400,
                color: active ? '#ffffff' : '#c0c0c0',
                backgroundColor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'
                  ;(e.currentTarget as HTMLElement).style.color = '#ffffff'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = '#c0c0c0'
                }
              }}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                  style={{ width: 3, height: '54%', backgroundColor: '#C5D42A' }} />
              )}
              <Icon size={17} style={{ color: active ? '#C5D42A' : '#888', flexShrink: 0 }} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* 보조 메뉴 */}
      <div className="px-3 pb-2 space-y-0.5">
        <Link
          href="/customers"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
          style={{ color: pathname.startsWith('/customers') ? '#C5D42A' : '#555' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#999' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = pathname.startsWith('/customers') ? '#C5D42A' : '#555' }}
        >
          <UserRound size={13} />
          고객 관리 (CRM)
        </Link>
        <Link
          href="/admin"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
          style={{ color: pathname.startsWith('/admin') ? '#C5D42A' : '#555' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#999' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = pathname.startsWith('/admin') ? '#C5D42A' : '#555' }}
        >
          <Settings2 size={13} />
          데이터 관리
        </Link>
      </div>

      {/* 유저 정보 + 로그아웃 */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
            style={{ backgroundColor: '#C5D42A' }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{userName}</p>
            <p className="text-[10px] truncate" style={{ color: '#666' }}>{userEmail}</p>
          </div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  )
}
