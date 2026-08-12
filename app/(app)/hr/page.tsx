import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { canManageUsers } from '@/lib/permissions'
import HrClient from './HrClient'

export default async function HrPage() {
  const session = await auth()
  const meSession = session?.user as any
  if (!meSession?.id) redirect('/login')

  // 사이드바 메뉴는 경영관리 권한에게만 노출되지만, 근태 신청·증명서 발급 등
  // 개인 셀프서비스는 전 직원이 (활동유형 "HR" 경유 등으로) 이용할 수 있어야 하므로
  // 페이지 자체는 막지 않고 관리자 전용 기능만 컴포넌트 내부에서 isManager로 가린다.
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
    <Suspense>
      <HrClient
        isManager={isManager}
        me={{ ...me, hireDate: me.hireDate ? me.hireDate.toISOString() : null }}
        myLeaves={JSON.parse(JSON.stringify(myLeaves))}
        pendingLeaves={JSON.parse(JSON.stringify(pendingLeaves))}
        teams={teams}
        allUsers={allUsers}
        myHrRecords={JSON.parse(JSON.stringify(myHrRecords))}
      />
    </Suspense>
  )
}
