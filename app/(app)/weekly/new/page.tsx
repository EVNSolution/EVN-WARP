import { prisma } from '@/lib/db'
import WeeklyForm from '@/components/WeeklyForm'
import { getWeekId, getWeekStart, adjacentWeek } from '@/lib/week'

type SearchParams = { week?: string; weekStart?: string; taskId?: string; teamId?: string }

export default async function NewWeeklyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { week, weekStart, taskId, teamId } = await searchParams

  const currentWeekId = getWeekId(new Date())
  const weekId = week ?? currentWeekId
  const weekStartIso = weekStart ?? getWeekStart(weekId).toISOString()
  const prevWeekId = adjacentWeek(weekId, -1)

  const [teams, tasks, prevUpdate] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.strategyTask.findMany({
      where: { parentId: { not: null } },
      select: { id: true, code: true, title: true, teamId: true },
      orderBy: [{ teamId: 'asc' }, { teamSeq: 'asc' }],
    }),
    taskId
      ? prisma.weeklyUpdate.findFirst({
          where: { taskId, week: prevWeekId },
          select: { status: true },
        })
      : null,
  ])

  const initial = taskId
    ? { taskId, teamId, status: prevUpdate?.status ?? undefined }
    : undefined

  return (
    <WeeklyForm
      teams={teams}
      tasks={tasks}
      weekId={weekId}
      weekStart={weekStartIso}
      initial={initial}
      mode="new"
      returnWeek={weekId}
    />
  )
}
