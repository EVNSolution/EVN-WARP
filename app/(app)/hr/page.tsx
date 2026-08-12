import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { canManageUsers } from '@/lib/permissions'
import HrClient from './HrClient'

export default async function HrPage() {
  const session = await auth()
  const meSession = session?.user as any
  if (!meSession?.id) redirect('/login')

  const isManager = await canManageUsers(meSession.id)

  const [me, myLeaves, pendingLeaves, teams, allUsers, myHrRecords] = await Promise.all([
    prisma.user.findUnique({
      where: { id: meSession.id },
      select: { id: true, name: true, position: true, hireDate: true, team: { select: { name: true } } },
    }),
    prisma.leaveRequest.findMany({ where: { userId: meSession.id }, orderBy: { createdAt: 'desc' } }),
    isManager
      ? prisma.leaveRequest.findMany({ where: { status: '대기' }, orderBy: { createdAt: 'asc' } })
      : Promise.resolve([]),
    prisma.team.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, users: { select: { id: true, name: true, position: true }, orderBy: { name: 'asc' } } },
    }),
    isManager
      ? prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
    prisma.hrRecord.findMany({ where: { userId: meSession.id }, orderBy: { effectiveDate: 'desc' } }),
  ])

  if (!me) redirect('/login')

  return (
    <HrClient
      isManager={isManager}
      me={{ ...me, hireDate: me.hireDate ? me.hireDate.toISOString() : null }}
      myLeaves={JSON.parse(JSON.stringify(myLeaves))}
      pendingLeaves={JSON.parse(JSON.stringify(pendingLeaves))}
      teams={teams}
      allUsers={allUsers}
      myHrRecords={JSON.parse(JSON.stringify(myHrRecords))}
    />
  )
}
