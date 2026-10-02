'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Maximize, Minimize, Printer, X } from 'lucide-react'

// 주간업무 팀별 보고 — PPT 슬라이드쇼처럼 전체 화면 + 키보드(←/→/Space/PageUp·Down/Home/End/F/Esc) 이동
export default function WeeklySlideShell({
  title, subtitle, page, total, prevHref, nextHref, firstHref, lastHref, closeHref, printHref, children,
}: {
  title:     string
  subtitle:  string
  page:      number
  total:     number
  prevHref:  string | null
  nextHref:  string | null
  firstHref: string
  lastHref:  string
  closeHref: string
  printHref: string
  children:  React.ReactNode
}) {
  const router = useRouter()
  const [isFull, setIsFull] = useState(false)

  useEffect(() => {
    const sync = () => setIsFull(!!document.fullscreenElement)
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  useEffect(() => {
    if (prevHref) router.prefetch(prevHref)
    if (nextHref) router.prefetch(nextHref)
  }, [prevHref, nextHref, router])

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen().catch(() => {})
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const go = (href: string | null) => { if (href) { e.preventDefault(); router.push(href) } }
      switch (e.key) {
        case 'ArrowRight': case 'PageDown': case ' ': return go(nextHref)
        case 'ArrowLeft':  case 'PageUp':             return go(prevHref)
        case 'Home': return go(firstHref)
        case 'End':  return go(lastHref)
        case 'f': case 'F': e.preventDefault(); return toggleFull()
        case 'Escape': if (!document.fullscreenElement) go(closeHref); return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prevHref, nextHref, firstHref, lastHref, closeHref, router, toggleFull])

  const btn = 'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-20 disabled:pointer-events-none'

  return (
    <div className="h-screen flex flex-col bg-[#f8f9fa] select-none">
      {/* 슬라이드 머리말 */}
      <header className="flex items-end justify-between px-10 pt-6 pb-4 shrink-0" style={{ backgroundColor: '#111111' }}>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-white/50">
            EV<span style={{ color: '#C5D42A' }}>&amp;</span>Solution · WARP 주간업무 보고
          </p>
          <h1 className="text-3xl font-black text-white tracking-tight mt-1">{title}</h1>
        </div>
        <p className="text-sm font-semibold" style={{ color: '#C5D42A' }}>{subtitle}</p>
      </header>

      {/* 본문 */}
      <main className="flex-1 overflow-y-auto px-10 py-6">
        <div style={{ zoom: 1.15 }}>{children}</div>
      </main>

      {/* 하단 조작 바 */}
      <footer className="flex items-center justify-between px-6 py-2 shrink-0" style={{ backgroundColor: '#111111' }}>
        <span className="text-[11px] text-white/30">← → 이동 · F 전체화면 · Esc 닫기</span>
        <div className="flex items-center gap-1">
          <button className={btn} disabled={!prevHref} onClick={() => prevHref && router.push(prevHref)}><ChevronLeft size={14} /> 이전</button>
          <span className="px-3 text-sm font-bold text-white tabular-nums">{page} / {total}</span>
          <button className={btn} disabled={!nextHref} onClick={() => nextHref && router.push(nextHref)}>다음 <ChevronRight size={14} /></button>
        </div>
        <div className="flex items-center gap-1">
          <button className={btn} onClick={toggleFull}>
            {isFull ? <><Minimize size={13} /> 전체화면 종료</> : <><Maximize size={13} /> 전체화면</>}
          </button>
          <a className={btn} href={printHref} target="_blank" rel="noopener noreferrer"><Printer size={13} /> 인쇄/PDF</a>
          <button className={btn} onClick={() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); router.push(closeHref) }}>
            <X size={13} /> 닫기
          </button>
        </div>
      </footer>
    </div>
  )
}

// 주간업무 화면에서 슬라이드쇼 시작 — 클릭(사용자 제스처) 시점에 전체 화면 진입 후 이동
export function StartSlideshowButton({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter()
  return (
    <button type="button" className={className}
      onClick={() => {
        document.documentElement.requestFullscreen?.().catch(() => {})
        router.push(href)
      }}>
      {children}
    </button>
  )
}

// 인쇄 전용 페이지 진입 시 인쇄 대화상자 자동 열기
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [])
  return null
}
