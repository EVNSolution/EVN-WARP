import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { canViewAllLeads } from '@/lib/permissions'
import MobilePipelineClient from './MobilePipelineClient'
import { getStageCode } from '@/lib/pipeline'
import { readInquiryStatus } from '@/lib/sales-process'

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
      customerSegment: true, checklistJson: true, salesProcessJson: true,
      customer: { select: { phone: true, customerSegment: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const assignees = isAdmin
    ? ([...new Set(deals.map(d => d.assignee).filter(Boolean))] as string[]).sort()
    : []

  return (
    <>
    <Link href="/m/pipeline/deposit-queue" className="block mx-4 mt-4 rounded-xl border border-blue-200 bg-white p-3 text-sm text-blue-700">계약금·출고 대기 순번 →</Link>
    <MobilePipelineClient
      deals={deals.map(({ salesProcessJson, checklistJson, ...deal }) => ({ ...deal,
        inquiryStatus: (deal.stageCode ?? getStageCode(deal.stage)) === '1-1' && (deal.customer?.customerSegment ?? deal.customerSegment) !== 'B2B'
          ? readInquiryStatus(salesProcessJson, checklistJson) : null,
      }))}
      assignees={assignees}
      isAdmin={isAdmin}
      myName={myName}
    />
    </>
  )
}
