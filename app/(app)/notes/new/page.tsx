import { prisma } from '@/lib/db'
import ActivityForm from '@/components/ActivityForm'

type SearchParams = { taskId?: string; date?: string; type?: string }

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { taskId, date, type } = await searchParams

  const [teams, tasks] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.strategyTask.findMany({
      where:   { suspended: false },
      select:  { id: true, code: true, title: true, teamId: true, strategy: true, parentId: true,
        kpiItems:        { where: { type: '정량' }, select: { id: true, label: true, unit: true, taskId: true }, orderBy: { index: 'asc' } },
        countermeasures: { select: { id: true, index: true, description: true }, orderBy: { index: 'asc' } } },
      orderBy: [{ teamId: 'asc' }, { teamSeq: 'asc' }],
    }),
  ])

  const preTask = taskId ? tasks.find(t => t.id === taskId) : undefined

  return (
    <ActivityForm
      teams={teams}
      tasks={tasks}
      mode="new"
      initial={{
        taskId:  preTask?.id,
        teamId:  preTask?.teamId,
        date:    date,
        type:    type,
      }}
      returnUrl="/notes"
    />
  )
}
