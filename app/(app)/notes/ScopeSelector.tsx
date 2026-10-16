'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'

/**
 * 캘린더 범위 선택 — 개인(기본) | 팀 ▾ | 전체.
 * 개인 = 내가 등록한 활동 전부(소속 팀 무관), 팀 = 그 팀 업무로 등록된 활동(teamId 기준),
 * 전체 = 전 구성원. 「팀」을 처음 누르면 내 팀1이 자동 선택되고, 다시 누르면 팀 목록이 열린다.
 * 팀 목록은 모두에게 같은 고정 순서(PM → 제조운영 → CLEVER → … → 공통), 경영진은 숨긴다.
 */

const STORAGE_KEY = 'warp-notes-scope2' // 'personal' | 'all' | 'team:<팀명>'

// 전사 고정 노출 순서 — 팀 이름에 토큰이 포함되면 그 순서로 배치, 나머지는 뒤에 이름순
const TEAM_ORDER = ['PM', '제조운영', 'CLEVER', '클레버', '사업개발', '마케팅', '경영관리', '기업부설', '공통']
const HIDDEN_TEAMS = ['경영진']

function orderRank(name: string): number {
  const up = name.toUpperCase()
  const i = TEAM_ORDER.findIndex(tok => up.includes(tok.toUpperCase()))
  return i === -1 ? TEAM_ORDER.length : i
}

interface Props {
  monthId: string
  activeTab: string
  myName?: string
  myUserId?: string
  teams: { id: string; name: string }[]
  /** 내 소속 팀 이름 — 우선순위(팀1>팀2>팀3) 순 */
  myTeamNames: string[]
  userParam?: string
  uidParam?: string
  teamParam?: string
}

export default function ScopeSelector({ monthId, activeTab, myName, myUserId, teams, myTeamNames, userParam, uidParam, teamParam }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const hasExplicitScope = !!(userParam || uidParam || teamParam)
  const personalActive = !teamParam && (uidParam ? uidParam === myUserId : userParam === myName) && !!(uidParam || userParam)
  const teamActive = !!teamParam
  // 「전체」는 URL 파라미터가 없는 상태라 명시적 선택인지 저장값으로 판별한다 (하이라이트 누락 버그 수정)
  const [impliedAll, setImpliedAll] = useState(false)
  const allActive = (hasExplicitScope && !personalActive && !teamActive) || (!hasExplicitScope && impliedAll)

  const visibleTeams = teams
    .filter(t => !HIDDEN_TEAMS.includes(t.name))
    .sort((a, b) => orderRank(a.name) - orderRank(b.name) || a.name.localeCompare(b.name))
  // 「팀」 첫 클릭 시 자동 선택되는 팀 — 내 팀1(숨김 팀이면 다음 소속 팀), 없으면 목록 첫 팀
  const myDefaultTeam = myTeamNames.find(n => !HIDDEN_TEAMS.includes(n)) ?? visibleTeams[0]?.name

  const buildHref = (over: { user?: boolean; team?: string }) => {
    const params = new URLSearchParams()
    params.set('month', monthId)
    params.set('tab', activeTab)
    if (over.user && myName) {
      params.set('user', myName)
      if (myUserId) params.set('uid', myUserId)
    }
    if (over.team) params.set('teamName', over.team)
    return `/notes?${params.toString()}`
  }

  const remember = (v: string) => { try { localStorage.setItem(STORAGE_KEY, v) } catch {} }
  const goTeam = (name: string) => { remember(`team:${name}`); setOpen(false); router.push(buildHref({ team: name })) }

  // 명시적 선택이 없을 때(기본 진입) — 마지막 선택을 적용하되, 저장값이 없으면 「개인」이 기본
  useEffect(() => {
    if (hasExplicitScope || !myName) return
    let saved: string | null = null
    try { saved = localStorage.getItem(STORAGE_KEY) } catch {}
    if (saved === 'all') { setImpliedAll(true); return }
    if (saved?.startsWith('team:')) {
      const t = saved.slice(5)
      if (teams.some(x => x.name === t)) { router.replace(buildHref({ team: t })); return }
    }
    router.replace(buildHref({ user: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 바깥 클릭으로 닫기
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const segBase = 'px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer'
  const active  = { backgroundColor: '#C5D42A', color: '#111' }
  const idle    = 'text-white/60 hover:text-white hover:bg-white/10'

  return (
    <div className="flex items-stretch border border-white/20 rounded-lg relative" ref={boxRef}>
      <button type="button"
        onClick={() => { remember('personal'); setOpen(false); router.push(buildHref({ user: true })) }}
        className={`${segBase} rounded-l-lg ${personalActive ? '' : idle}`}
        style={personalActive ? active : {}}>
        개인
      </button>
      <button type="button"
        onClick={() => {
          // 처음 누르면 내 팀1로 바로 전환, 팀 모드에서 다시 누르면 목록 열기
          if (!teamActive) { if (myDefaultTeam) goTeam(myDefaultTeam) }
          else setOpen(v => !v)
        }}
        className={`${segBase} border-x border-white/20 flex items-center gap-1 ${teamActive ? '' : idle}`}
        style={teamActive ? active : {}}>
        {teamActive ? teamParam : '팀'}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <button type="button"
        onClick={() => { remember('all'); setImpliedAll(true); setOpen(false); router.push(buildHref({})) }}
        className={`${segBase} rounded-r-lg ${allActive ? '' : idle}`}
        style={allActive ? active : {}}>
        전체
      </button>

      {/* 팀 선택 팝오버 */}
      {open && (
        <div className="absolute top-full right-0 mt-2 z-50 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 overflow-hidden">
          <p className="px-3.5 pt-1 pb-1.5 text-[10px] font-semibold text-slate-400">팀 선택</p>
          {visibleTeams.map(t => {
            const isCur = teamParam === t.name
            return (
              <button key={t.id} type="button" onClick={() => goTeam(t.name)}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 text-left text-xs transition-colors ${
                  isCur ? 'bg-[#C5D42A]/15 text-[#5d6e00] font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'
                }`}>
                <span className="truncate">{t.name}</span>
                {isCur && <Check size={13} className="shrink-0 text-[#7a9200]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
