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

  const selectCls = "text-xs font-semibold text-white bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/40"
  // 드롭다운을 펼쳤을 때 나오는 옵션 목록은 브라우저가 대체로 흰 배경으로 그리므로,
  // select 자체의 흰 글자색이 그대로 상속되면 안 보이게 된다 — option에 어두운 글자색을 따로 지정
  const optionCls = "text-slate-800 bg-white"

  return (
    <div className="flex items-center gap-3 shrink-0">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-semibold text-white/50">팀</label>
        <select
          value={teamParam ?? ''}
          onChange={e => navigate({ teamName: e.target.value })}
          className={selectCls}
        >
          <option value="" className={optionCls}>전체</option>
          {teams.map(t => <option key={t.id} value={t.name} className={optionCls}>{t.name}</option>)}
        </select>
      </div>
      {userNames.length > 1 && (
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-white/50">작성자</label>
          <select
            value={userParam ?? ''}
            onChange={e => navigate({ user: e.target.value })}
            className={selectCls}
          >
            <option value="" className={optionCls}>전체</option>
            {userNames.map(name => <option key={name} value={name} className={optionCls}>{name}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
