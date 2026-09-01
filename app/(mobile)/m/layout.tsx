'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Filter, PlusCircle, Car } from 'lucide-react'

const NAV = [
  { href: '/m/',         icon: Home,       label: '홈' },
  { href: '/m/pipeline', icon: Filter,     label: '파이프라인' },
  { href: '/m/activity', icon: PlusCircle, label: '활동추가' },
  { href: '/m/vehicle',  icon: Car,        label: '차량신청' },
]

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <header className="flex items-center justify-between px-5 h-14 flex-shrink-0" style={{ backgroundColor: '#111111', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div>
          <div style={{ fontSize: 11, color: '#bbb', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
            EV<span style={{ color: '#C5D42A' }}>&</span>Solution
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.04em', lineHeight: 1 }}>
            WARP
          </div>
        </div>
        {/* PC 버전 보기 — 쿠키 설정 후 PC 메인으로 이동 */}
        <button
          onClick={() => {
            document.cookie = 'warp-desktop=1; path=/; max-age=86400'
            window.location.href = '/funnel'
          }}
          style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.03em' }}
          className="active:opacity-60"
        >
          PC 버전
        </button>
      </header>

      {/* 콘텐츠 영역 */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex safe-area-bottom z-50">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = href === '/m/'
            ? pathname === '/m' || pathname === '/m/'
            : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors
                ${active ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
