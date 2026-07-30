import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { CEO_TEAM_ID } from '@/lib/constants'
import A3Form from '@/components/A3Form'

export default async function EditA3Page(props: PageProps<'/a3/[id]/edit'>) {
  const { id } = await props.params
  const [task, teams] = await Promise.all([
    prisma.strategyTask.findUnique({
      where: { id },
      include: {
        monthlyTargets: true, countermeasures: true, kpiItems: true,
        parent: { select: { id: true, code: true, title: true, teamId: true, strategy: true, parent: { select: { title: true, strategy: true } } } },
      },
    }),
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
  ])
  if (!task) notFound()

  const initial = {
    ...task,
    startDate: task.startDate ? task.startDate.toISOString() : '',
    endDate:   task.endDate   ? task.endDate.toISOString()   : '',
    monthlyTargets: task.monthlyTargets,
    countermeasures: task.countermeasures,
    kpiItems: task.kpiItems,
  }

  return (
    <A3Form
      teams={teams}
      presetParent={task.parent}
      ceoTeamId={CEO_TEAM_ID}
      initial={initial}
      mode="edit"
    />
  )
}
