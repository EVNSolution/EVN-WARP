import { prisma } from '@/lib/db'
import Link from 'next/link'
import { Plus, ChevronRight, PauseCircle } from 'lucide-react'

const STATUS_STYLE: Record<string, string> = {
  '진행중': 'bg-blue-100 text-blue-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-gray-100 text-gray-500',
  '지연':   'bg-red-100 text-red-600',
}

const STRAT: Record<string, {
  container: string; border: string; leftBar: string
  badge: string; hoverParent: string; subHover: string
}> = {
  A: {
    container:   'bg-indigo-50/50 border-indigo-200',
    border:      'border-indigo-200',
    leftBar:     'border-l-indigo-500',
    badge:       'bg-indigo-600 text-white',
    hoverParent: 'hover:bg-indigo-50',
    subHover:    'hover:bg-indigo-50/40',
  },
  B: {
    container:   'bg-emerald-50/50 border-emerald-200',
    border:      'border-emerald-200',
    leftBar:     'border-l-emerald-500',
    badge:       'bg-emerald-600 text-white',
    hoverParent: 'hover:bg-emerald-50',
    subHover:    'hover:bg-emerald-50/40',
  },
}
const STRAT_DEFAULT = STRAT.A

function dDay(endDate: Date) {
  const diff = Math.ceil((endDate.getTime() - Date.now()) / 86400000)
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, cls: 'text-red-500' }
  if (diff === 0) return { label: 'D-day', cls: 'text-orange-500' }
  return { label: `D-${diff}`, cls: 'text-slate-400' }
}

export default async function A3ListPage() {
  const tasks = await prisma.strategyTask.findMany({
    where: { parentId: null },
    include: {
      team: true,
      subTasks: {
        include: { team: true },
        orderBy: { subSeq: 'asc' },
      },
    },
    orderBy: [{ teamId: 'asc' }, { teamSeq: 'asc' }],
  })

  // 팀별 그룹
  const teamMap = new Map<string, { teamName: string; tasks: typeof tasks }>()
  for (const task of tasks) {
    if (!teamMap.has(task.teamId))
      teamMap.set(task.teamId, { teamName: task.team.name, tasks: [] })
    teamMap.get(task.teamId)!.tasks.push(task)
  }
  const teamEntries = [...teamMap.values()]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between px-6 py-4 mb-6 rounded-xl" style={{ backgroundColor: '#111111' }}>
        <div>
          <h1 className="text-xl font-bold text-white">전략과제 A3</h1>
          <p className="text-xs mt-0.5" style={{ color: '#C5D42A' }}>전략과제별 A3 등록 및 실행 현황</p>
        </div>
        <Link href="/a3/new"
          className="flex items-center gap-2 text-white border border-white/20 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
          <Plus size={16} /> 새 과제 등록
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-24 text-slate-400">
          <p className="text-lg font-medium mb-2">등록된 전략과제가 없습니다</p>
          <p className="text-sm">&quot;새 과제 등록&quot; 버튼으로 첫 번째 과제를 등록하세요</p>
        </div>
      ) : (
        <div className="space-y-8">
          {teamEntries.map(({ teamName, tasks: teamTasks }) => {
            const active    = teamTasks.filter(t => !t.suspended)
            const suspended = teamTasks.filter(t => t.suspended)
            const cntDone   = active.filter(t => t.status === '완료').length
            const cntActive = active.filter(t => t.status !== '완료').length

            return (
              <section key={teamName}>
                {/* 팀 헤더 */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-[3px] h-5 rounded-full shrink-0" style={{ backgroundColor: '#C5D42A' }} />
                  <span className="text-sm font-bold text-slate-800">{teamName}</span>
                  <div className="flex items-center gap-2 text-xs">
                    {cntActive > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">진행 {cntActive}</span>
                    )}
                    {cntDone > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">완료 {cntDone}</span>
                    )}
                    {suspended.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">중단 {suspended.length}</span>
                    )}
                  </div>
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 font-medium shrink-0">{teamTasks.length}건</span>
                </div>

                {/* 과제 카드들 */}
                <div className="grid gap-3">
                  {active.map(task => (
                    <TaskRow key={task.id} task={task} dimmed={task.status === '완료'} />
                  ))}
                  {suspended.map(task => (
                    <SuspendedTaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── 서브 컴포넌트 ──────────────────────────────── */

function TaskRow({ task, dimmed }: { task: any; dimmed?: boolean }) {
  const s       = STRAT[task.strategy] ?? STRAT_DEFAULT
  const hasSubs = task.subTasks?.length > 0
  const dd      = dDay(new Date(task.endDate))
  const stCls   = STATUS_STYLE[task.status] ?? 'bg-gray-100 text-gray-500'

  return (
    <div className={`border rounded-xl overflow-hidden ${s.container} ${dimmed ? 'opacity-60' : ''}`}>

      {/* ─ 전략과제 (헤더) ─ */}
      <Link href={`/a3/${task.id}`}
        className={`flex items-center gap-3 bg-white border-l-[5px] ${s.leftBar} px-4 py-3.5 ${s.hoverParent} transition-colors group`}>

        {/* 전략 + 과제명 통합 pill */}
        <span className={`text-sm font-bold px-3 py-1 rounded-lg flex-1 min-w-0 truncate ${s.badge}`}>
          {task.strategy}. {task.title}
        </span>

        {/* 메타 */}
        <span className="text-sm text-slate-400 shrink-0">{task.team?.name}</span>
        <span className="text-sm text-slate-400 shrink-0">오너 {task.owner}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${stCls}`}>
          {task.status}
        </span>
        {task.confirmed && <span className="text-xs text-green-500 shrink-0">✓확정</span>}
        <span className={`text-xs font-medium shrink-0 ${dd.cls}`}>{dd.label}</span>
        <ChevronRight size={15} className="text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
      </Link>

      {/* ─ 하부과제 목록 ─ */}
      {hasSubs && task.subTasks.map((sub: any, idx: number) => {
        const isLast  = idx === task.subTasks.length - 1
        const subDd   = dDay(new Date(sub.endDate))
        const subStCls = STATUS_STYLE[sub.status] ?? 'bg-gray-100 text-gray-500'

        return (
          <Link key={sub.id} href={`/a3/${sub.id}`}
            className={`flex items-center gap-3 bg-white border-t border-slate-100 px-4 py-3 ${s.subHover} transition-colors group ${isLast ? 'rounded-b-xl' : ''}`}>

            {/* 트리 커넥터 */}
            <div className="flex items-center gap-1.5 pl-5 shrink-0">
              <span className="text-slate-300 font-mono text-xs leading-none select-none">
                {isLast ? '└' : '├'}
              </span>
            </div>

            {/* 코드 */}
            <span className="text-xs text-slate-300 shrink-0 w-32 truncate">
              {sub.code}
            </span>

            {/* 제목 */}
            <span className="flex-1 text-sm text-slate-700 truncate">
              {sub.title}
            </span>

            {/* 메타 */}
            <span className="text-xs text-slate-400 shrink-0">{sub.team?.name}</span>
            <span className="text-xs text-slate-400 shrink-0">오너 {sub.owner}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${subStCls}`}>
              {sub.status}
            </span>
            {sub.confirmed && <span className="text-xs text-green-500 shrink-0">✓확정</span>}
            <span className={`text-xs font-medium shrink-0 ${subDd.cls}`}>{subDd.label}</span>
            <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
          </Link>
        )
      })}

    </div>
  )
}

function SuspendedTaskCard({ task }: { task: any }) {
  return (
    <Link href={`/a3/${task.id}`}
      className="flex items-start gap-3 bg-orange-50/50 border border-orange-200 rounded-xl px-5 py-3.5 hover:bg-orange-50 hover:shadow-sm transition-all group">
      <PauseCircle size={15} className="text-orange-300 shrink-0 mt-0.5" />
      <span className="text-xs font-semibold text-slate-400 shrink-0 w-36 truncate">{task.code}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-500 truncate text-sm">{task.title}</p>
        {task.suspendReason && (
          <p className="text-xs text-orange-500 mt-0.5 truncate">사유: {task.suspendReason}</p>
        )}
      </div>
      <span className="text-sm text-slate-400 shrink-0">{task.team?.name}</span>
      {task.suspendedAt && (
        <span className="text-xs text-orange-400 shrink-0">
          {new Date(task.suspendedAt).toLocaleDateString('ko-KR')} 중단
        </span>
      )}
      <ChevronRight size={15} className="text-slate-300 group-hover:text-orange-400 transition-colors shrink-0" />
    </Link>
  )
}
