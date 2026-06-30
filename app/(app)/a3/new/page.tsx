import { prisma } from '@/lib/db'
import { CEO_TEAM_ID } from '@/lib/constants'
import A3Form from '@/components/A3Form'

export default async function NewA3Page(props: PageProps<'/a3/new'>) {
  const searchParams = await props.searchParams
  const presetParentId = searchParams?.parentId as string | undefined

  const [teams, parentTasks] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    // 상위 과제 목록 = 경영진 팀의 최상위 과제 (전략과제 A, B)
    prisma.strategyTask.findMany({
      where: { teamId: CEO_TEAM_ID, parentId: null },
      select: { id: true, code: true, title: true, teamId: true, strategy: true },
      orderBy: { teamSeq: 'asc' },
    }),
  ])

  return (
    <A3Form
      teams={teams}
      parentTasks={parentTasks}
      ceoTeamId={CEO_TEAM_ID}
      mode="new"
      initial={presetParentId ? { parentId: presetParentId } : undefined}
    />
  )
}
