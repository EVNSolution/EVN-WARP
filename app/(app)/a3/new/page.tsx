import { prisma } from '@/lib/db'
import { CEO_TEAM_ID } from '@/lib/constants'
import A3Form from '@/components/A3Form'

export default async function NewA3Page(props: PageProps<'/a3/new'>) {
  const searchParams = await props.searchParams
  const presetParentId = searchParams?.parentId as string | undefined

  const [teams, presetParent, teamTasks] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    // 세부과제는 항상 팀과제 아래에만 등록된다
    presetParentId
      ? prisma.strategyTask.findUnique({
          where: { id: presetParentId },
          select: {
            id: true, code: true, title: true, teamId: true, strategy: true,
            parent: { select: { title: true, strategy: true } },
          },
        })
      : null,
    // presetParentId 없이 진입한 경우: 담당 팀 선택 후 그 팀의 팀과제 중에서 상위 과제를 고르게 함
    prisma.strategyTask.findMany({
      where: { parentId: { not: null }, parent: { parentId: null } },
      select: {
        id: true, code: true, title: true, teamId: true, strategy: true,
        parent: { select: { title: true, strategy: true } },
      },
      // 전사과제(A, B, C...) 순서대로 먼저, 그 안에서 등록 순
      orderBy: [{ strategy: 'asc' }, { teamId: 'asc' }, { teamSeq: 'asc' }],
    }),
  ])

  return (
    <A3Form
      teams={teams}
      presetParent={presetParent}
      teamTasks={teamTasks}
      ceoTeamId={CEO_TEAM_ID}
      mode="new"
    />
  )
}
