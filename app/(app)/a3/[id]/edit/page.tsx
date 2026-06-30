import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { CEO_TEAM_ID } from '@/lib/constants'
import A3Form from '@/components/A3Form'

export default async function EditA3Page(props: PageProps<'/a3/[id]/edit'>) {
  const { id } = await props.params
  const [task, teams, parentTasks] = await Promise.all([
    prisma.strategyTask.findUnique({
      where: { id },
      include: { monthlyTargets: true, countermeasures: true, kpiItems: true },
    }),
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    // 상위 과제 목록 = 경영진 팀의 최상위 과제 (전략과제 A, B)
    prisma.strategyTask.findMany({
      where: { teamId: CEO_TEAM_ID, parentId: null },
      select: { id: true, code: true, title: true, teamId: true, strategy: true },
      orderBy: { teamSeq: 'asc' },
    }),
  ])
  if (!task) notFound()

  const initial = {
    ...task,
    startDate: task.startDate.toISOString(),
    endDate: task.endDate.toISOString(),
    monthlyTargets: task.monthlyTargets,
    countermeasures: task.countermeasures,
    kpiItems: task.kpiItems,
  }

  return (
    <A3Form
      teams={teams}
      parentTasks={parentTasks}
      ceoTeamId={CEO_TEAM_ID}
      initial={initial}
      mode="edit"
    />
  )
}
