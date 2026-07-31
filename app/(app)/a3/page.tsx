import { prisma } from '@/lib/db'
import Link from 'next/link'
import { Plus, ChevronRight, PauseCircle } from 'lucide-react'
import A3SubTaskGroups from '@/components/A3SubTaskGroups'
import { A3ExpandProvider, A3ExpandAllButton } from '@/components/A3ExpandContext'
import { STATUS_STYLE, dDay, stratColor } from '@/lib/a3'

export default async function A3ListPage() {
  const tasks = await prisma.strategyTask.findMany({
    where: { parentId: null },
    include: {
      team: true,
      subTasks: {
        include: {
          team: true,
          subTasks: { orderBy: { subSeq: 'asc' } },
        },
        orderBy: { subSeq: 'asc' },
      },
    },
    orderBy: [{ teamId: 'asc' }, { teamSeq: 'asc' }],
  })

  const active    = tasks.filter(t => !t.suspended)
  const suspended = tasks.filter(t => t.suspended)

  return (
    <A3ExpandProvider>
      <div className="p-8">
        <div className="flex items-center justify-between px-6 py-4 mb-6 rounded-xl" style={{ backgroundColor: '#111111' }}>
          <div>
            <h1 className="text-xl font-bold text-white">전략과제 A3</h1>
            <p className="text-xs mt-0.5" style={{ color: '#C5D42A' }}>전략과제별 A3 등록 및 실행 현황</p>
          </div>
          <div className="flex items-center gap-2">
            {tasks.length > 0 && <A3ExpandAllButton />}
            <Link href="/a3/new"
              className="flex items-center gap-2 text-white border border-white/20 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
              <Plus size={16} /> 신규 세부전략과제 등록
            </Link>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <p className="text-lg font-medium mb-2">등록된 전략과제가 없습니다</p>
            <p className="text-sm">&quot;신규 세부전략과제 등록&quot; 버튼으로 첫 번째 과제를 등록하세요</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {active.map(task => (
              <TaskRow key={task.id} task={task} dimmed={task.status === '완료'} />
            ))}
            {suspended.map(task => (
              <SuspendedTaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </A3ExpandProvider>
  )
}

/* ── 서브 컴포넌트 ──────────────────────────────── */

function TaskRow({ task, dimmed }: { task: any; dimmed?: boolean }) {
  const s       = stratColor(task.strategy)
  const hasSubs = task.subTasks?.length > 0
  const dd      = dDay(task.endDate)
  const stCls   = STATUS_STYLE[task.status] ?? 'bg-gray-100 text-gray-500'

  return (
    <div className={`border rounded-xl overflow-hidden ${s.container} ${dimmed ? 'opacity-60' : ''}`}>

      {/* ─ 전략과제 (헤더) ─ */}
      <Link href={`/a3/${task.id}`}
        className={`flex items-center gap-3 bg-white border-l-[5px] ${s.leftBar} px-4 py-3.5 ${s.hoverParent} transition-colors group`}>

        {/* 전략 + 과제명 통합 pill */}
        <span className={`text-sm font-bold px-3 py-1 rounded-lg flex-1 min-w-0 truncate ${s.bold}`}>
          {task.strategy}. {task.title}
        </span>

        {/* 메타 */}
        <span className="text-xs text-slate-400 font-medium shrink-0">오너 {task.owner ?? '미배정'}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${stCls}`}>
          {task.status}
        </span>
        {task.confirmed && <span className="text-xs text-green-500 shrink-0">✓확정</span>}
        {dd && <span className={`text-xs font-medium shrink-0 ${dd.cls}`}>{dd.label}</span>}
        <ChevronRight size={15} className="text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
      </Link>

      {/* ─ 하부과제: 팀별 그룹 아코디언 ─ */}
      {hasSubs && (
        <A3SubTaskGroups
          subTasks={task.subTasks}
          parentTaskId={task.id}
          teamSummaries={task.teamSummaries ? JSON.parse(task.teamSummaries) : {}}
        />
      )}

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
      {task.suspendedAt && (
        <span className="text-xs text-orange-400 shrink-0">
          {new Date(task.suspendedAt).toLocaleDateString('ko-KR')} 중단
        </span>
      )}
      <ChevronRight size={15} className="text-slate-300 group-hover:text-orange-400 transition-colors shrink-0" />
    </Link>
  )
}
