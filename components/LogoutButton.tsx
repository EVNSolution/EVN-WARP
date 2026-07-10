'use client'

import { LogOut } from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'

export default function LogoutButton() {
  const handleLogout = async () => {
    await logoutAction()
    window.location.href = '/login'
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
      style={{ color: '#888' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'
        ;(e.currentTarget as HTMLElement).style.color = '#fff'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
        ;(e.currentTarget as HTMLElement).style.color = '#888'
      }}>
      <LogOut size={14} /> 로그아웃
    </button>
  )
}
