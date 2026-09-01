import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { canViewAllLeads } from '@/lib/permissions'
import MobilePipelineClient from './MobilePipelineClient'

export const dynamic = 'force-dynamic'

export default async function MobilePipelinePage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const me      = session.user as any
  const myName  = me?.name ?? ''
  const isAdmin = await canViewAllLeads(me?.id)

  const deals = await prisma.salesDeal.findMany({
    where: isAdmin
      ? { salesStatus: { not: '완료' } }
      : { salesStatus: { not: '완료' }, assignee: myName },
    select: {
      id: true, name: true, phone: true, assignee: true,
      stageCode: true, stage: true, salesStatus: true, customerType: true,
      customer: { select: { phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const assignees = isAdmin
    ? ([...new Set(deals.map(d => d.assignee).filter(Boolean))] as string[]).sort()
    : []

  return (
    <MobilePipelineClient
      deals={deals}
      assignees={assignees}
      isAdmin={isAdmin}
      myName={myName}
    />
  )
}
