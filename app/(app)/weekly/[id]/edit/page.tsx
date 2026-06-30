import { prisma } from '@/lib/db'
import WeeklyForm from '@/components/WeeklyForm'
import { getWeekId } from '@/lib/week'
import { notFound } from 'next/navigation'

type Params = { id: string }
type SearchParams = { week?: string }

export default async function EditWeeklyPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParams>
}) {
  const { id } = await params
  const { week } = await searchParams

  const update = await prisma.weeklyUpdate.findUnique({
    where: { id },
    include: { task: { include: { team: true } }, team: true },
  })
  if (!update) notFound()

  const returnWeek = week ?? update.week ?? getWeekId(new Date())

  const [teams, tasks] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.strategyTask.findMany({
      where: { parentId: { not: null } },
      select: { id: true, code: true, title: true, teamId: true },
      orderBy: [{ teamId: 'asc' }, { teamSeq: 'asc' }],
    }),
  ])

  return (
    <WeeklyForm
      teams={teams}
      tasks={tasks}
      weekId={update.week}
      weekStart={update.weekStart.toISOString()}
      initial={{
        id: update.id,
        taskId: update.taskId,
        teamId: update.teamId,
        status: update.status,
        completed: update.completed ?? '',
        planned: update.planned ?? '',
        mentions: update.mentions ?? '',
      }}
      mode="edit"
      returnWeek={returnWeek}
    />
  )
}
