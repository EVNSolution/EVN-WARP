'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 캘린더 범위 선택 — 개인(기본) | 팀 ▾ | 전체.
 * 개인 = 내가 등록한 활동 전부(소속 팀 무관), 팀 = 그 팀 업무로 등록된 활동(teamId 기준),
 * 전체 = 전 구성원. 팀 세그먼트는 드롭다운 — 내 소속 팀(팀1 먼저)을 위에 보여준다.
 * 마지막 선택을 기억하고, 명시적 선택이 없으면 「개인」이 기본이다.
 */

const STORAGE_KEY = 'warp-notes-scope2' // 'personal' | 'all' | 'team:<팀명>'

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
  const hasExplicitScope = !!(userParam || uidParam || teamParam)
  const personalActive = !teamParam && (uidParam ? uidParam === myUserId : userParam === myName) && !!(uidParam || userParam)
  const teamActive = !!teamParam
  const allActive = !hasExplicitScope ? false : (!personalActive && !teamActive)

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

  // 명시적 선택이 없을 때(기본 진입) — 마지막 선택을 적용하되, 저장값이 없으면 「개인」이 기본
  useEffect(() => {
    if (hasExplicitScope || !myName) return
    let saved: string | null = null
    try { saved = localStorage.getItem(STORAGE_KEY) } catch {}
    if (saved === 'all') return // 전체 = 파라미터 없음 그대로
    if (saved?.startsWith('team:')) {
      const t = saved.slice(5)
      if (teams.some(x => x.name === t)) { router.replace(buildHref({ team: t })); return }
    }
    router.replace(buildHref({ user: true })) // 기본 = 개인
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const remember = (v: string) => { try { localStorage.setItem(STORAGE_KEY, v) } catch {} }

  // 팀 드롭다운 — 내 소속 팀 먼저(팀1 우선), 나머지는 이름순
  const orderedTeams = [
    ...myTeamNames.map(n => teams.find(t => t.name === n)).filter((t): t is { id: string; name: string } => !!t),
    ...teams.filter(t => !myTeamNames.includes(t.name)),
  ]

  const segBase = 'px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer'
  const active  = { backgroundColor: '#C5D42A', color: '#111' }
  const idle    = 'text-white/60 hover:text-white hover:bg-white/10'

  return (
    <div className="flex items-stretch border border-white/20 rounded-lg overflow-hidden">
      <button type="button"
        onClick={() => { remember('personal'); router.push(buildHref({ user: true })) }}
        className={`${segBase} ${personalActive ? '' : idle}`}
        style={personalActive ? active : {}}>
        개인
      </button>
      <select
        value={teamParam ?? ''}
        onChange={e => {
          const t = e.target.value
          if (!t) return
          remember(`team:${t}`)
          router.push(buildHref({ team: t }))
        }}
        className={`${segBase} border-x border-white/20 bg-transparent appearance-none text-center focus:outline-none ${teamActive ? '' : idle}`}
        style={teamActive ? active : { backgroundColor: 'transparent' }}>
        <option value="" disabled className="text-slate-800 bg-white">팀 ▾</option>
        {orderedTeams.map(t => (
          <option key={t.id} value={t.name} className="text-slate-800 bg-white">
            {t.name}{myTeamNames[0] === t.name ? ' (팀1)' : myTeamNames.includes(t.name) ? ' (소속)' : ''}
          </option>
        ))}
      </select>
      <button type="button"
        onClick={() => { remember('all'); router.push(buildHref({})) }}
        className={`${segBase} ${allActive ? '' : idle}`}
        style={allActive ? active : {}}>
        전체
      </button>
    </div>
  )
}
