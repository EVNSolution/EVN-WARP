import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import ActivityForm from '@/components/ActivityForm'

type SearchParams = { taskId?: string; date?: string; type?: string; start?: string }

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { taskId, date, type, start } = await searchParams
  // 캘린더 주간 그리드의 빈 시간대 클릭 → 그 시각으로 시작시간 프리필 (+1시간 종료)
  const startTime = start && /^([01]?\d|2[0-3]):[0-5]\d$/.test(start) ? start : undefined
  const endTime = startTime
    ? `${String(Math.min(Number(startTime.slice(0, 2)) + 1, 23)).padStart(2, '0')}:${startTime.slice(3)}`
    : undefined

  const [session, teams, tasks, users, vehicles] = await Promise.all([
    auth(),
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.strategyTask.findMany({
      where:   { suspended: false },
      select:  { id: true, code: true, title: true, teamId: true, strategy: true, parentId: true,
        team: { select: { name: true } },
        kpiItems:        { where: { type: '정량' }, select: { id: true, label: true, unit: true, taskId: true }, orderBy: { index: 'asc' } },
        countermeasures: { select: { id: true, index: true, description: true, owner: true }, orderBy: { index: 'asc' } } },
      orderBy: [{ teamId: 'asc' }, { teamSeq: 'asc' }],
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } }),
    prisma.vehicle.findMany({ where: { active: true }, select: { id: true, name: true, plateNo: true }, orderBy: { name: 'asc' } }),
  ])

  const preTask = taskId ? tasks.find(t => t.id === taskId) : undefined
  const me = session?.user as any
  const myUserId   = me?.id   as string | undefined
  const myUserName = me?.name as string | undefined
  // 독립활동 기본 팀 = 작성자의 팀1 (가나다순 첫 팀이 기본으로 잡히던 문제 방지)
  const myTeam = myUserId
    ? await prisma.user.findUnique({ where: { id: myUserId }, select: { teamId: true } })
    : null

  return (
    <ActivityForm
      teams={teams}
      tasks={tasks}
      users={users}
      vehicles={vehicles}
      mode="new"
      initial={{
        taskId:   preTask?.id,
        teamId:   preTask?.teamId ?? myTeam?.teamId ?? undefined,
        date:     date,
        type:     type,
        startTime,
        endTime,
        userId:   myUserId,
        userName: myUserName,
      }}
      returnUrl="/notes"
    />
  )
}
