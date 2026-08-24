'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const STORAGE_KEY = 'warp-notes-scope' // 'personal' | 'all'

export default function PersonalScopeToggle({
  hrefPersonal,
  hrefAll,
  isPersonalActive,
  hasExplicitScope,
}: {
  hrefPersonal: string
  hrefAll: string
  isPersonalActive: boolean
  hasExplicitScope: boolean // URL에 user/uid 파라미터가 이미 있으면 true — 그때는 그 값을 그대로 존중한다
}) {
  const router = useRouter()

  // URL에 아직 명시적 선택이 없을 때만(=기본 진입) 마지막으로 선택했던 값을 적용한다
  useEffect(() => {
    if (hasExplicitScope) return
    let saved: string | null = null
    try { saved = localStorage.getItem(STORAGE_KEY) } catch {}
    if (saved === 'personal') router.replace(hrefPersonal)
    // 'all'이거나 저장된 값이 없으면 지금 보이는 기본값(전체)을 그대로 둔다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const remember = (scope: 'personal' | 'all') => {
    try { localStorage.setItem(STORAGE_KEY, scope) } catch {}
  }

  return (
    <div className="flex border border-white/20 rounded-lg overflow-hidden text-xs font-bold">
      <Link
        href={hrefPersonal}
        onClick={() => remember('personal')}
        className={`px-3.5 py-2 transition-colors ${
          isPersonalActive ? 'text-[#111] font-black' : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
        style={isPersonalActive ? { backgroundColor: '#C5D42A' } : {}}>
        개인
      </Link>
      <Link
        href={hrefAll}
        onClick={() => remember('all')}
        className={`px-3.5 py-2 border-l border-white/20 transition-colors ${
          !isPersonalActive ? 'text-[#111] font-black' : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
        style={!isPersonalActive ? { backgroundColor: '#C5D42A' } : {}}>
        전체
      </Link>
    </div>
  )
}
