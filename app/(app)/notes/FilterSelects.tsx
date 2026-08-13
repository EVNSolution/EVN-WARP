'use client'

import { useRouter } from 'next/navigation'

interface Props {
  monthId: string
  activeTab: string
  userParam?: string
  teamParam?: string
  userNames: string[]
  teams: { id: string; name: string }[]
}

export default function FilterSelects({ monthId, activeTab, userParam, teamParam, userNames, teams }: Props) {
  const router = useRouter()

  const navigate = (next: { user?: string; teamName?: string }) => {
    const params = new URLSearchParams()
    params.set('month', monthId)
    params.set('tab', activeTab)
    const user = next.user !== undefined ? next.user : (userParam ?? '')
    const team = next.teamName !== undefined ? next.teamName : (teamParam ?? '')
    if (user) params.set('user', user)
    if (team) params.set('teamName', team)
    router.push(`/notes?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-4 mb-3 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-slate-500">팀</label>
        <select
          value={teamParam ?? ''}
          onChange={e => navigate({ teamName: e.target.value })}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
        >
          <option value="">전체</option>
          {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      </div>
      {userNames.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">작성자</label>
          <select
            value={userParam ?? ''}
            onChange={e => navigate({ user: e.target.value })}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="">전체</option>
            {userNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
