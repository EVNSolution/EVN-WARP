import { prisma } from '@/lib/db'
import { CEO_TEAM_ID } from '@/lib/constants'
import A3Form from '@/components/A3Form'

export default async function NewA3Page(props: PageProps<'/a3/new'>) {
  const searchParams = await props.searchParams
  const presetParentId = searchParams?.parentId as string | undefined

  const [teams, presetParent] = await Promise.all([
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
  ])

  return (
    <A3Form
      teams={teams}
      presetParent={presetParent}
      ceoTeamId={CEO_TEAM_ID}
      mode="new"
    />
  )
}
