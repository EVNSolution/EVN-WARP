import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import MobileActivityForm from './MobileActivityForm'

export const dynamic = 'force-dynamic'

type SearchParams = { taskId?: string; date?: string; dealId?: string; dealName?: string }

export default async function MobileActivityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { taskId, dealName } = await searchParams
  const me = session.user as any

  const [teams, tasks, vehicles] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.strategyTask.findMany({
      where:   { suspended: false },
      select: {
        id: true, code: true, title: true, teamId: true, strategy: true, parentId: true,
        team: { select: { name: true } },
      },
      orderBy: [{ teamId: 'asc' }, { teamSeq: 'asc' }],
    }),
    prisma.vehicle.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, plateNo: true } }),
  ])

  const preTask = taskId ? tasks.find(t => t.id === taskId) : undefined

  return (
    <MobileActivityForm
      teams={teams}
      tasks={tasks}
      vehicles={vehicles}
      initial={{
        taskId:   preTask?.id,
        teamId:   preTask?.teamId ?? teams[0]?.id,
        userId:   me?.id   as string | undefined,
        userName: me?.name as string | undefined,
        dealName: dealName ? decodeURIComponent(dealName) : undefined,
      }}
    />
  )
}
