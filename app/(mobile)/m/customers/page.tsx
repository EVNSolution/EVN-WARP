import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import MobileCustomersClient from './MobileCustomersClient'

export const dynamic = 'force-dynamic'

export default async function MobileCustomersPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const me = session.user as { id?: string; name?: string; employmentType?: string }
  const actor = me.id ? await prisma.user.findUnique({
    where: { id: me.id },
    select: { name: true, role: true, employmentType: true },
  }) : null
  if (!actor) redirect('/login')
  const isExternal = actor.employmentType === '사외'
  const canMergeCustomers = !!actor
    && ['admin', 'ceo'].includes(actor.role)
    && actor.employmentType !== '사외'

  const customers = await prisma.customer.findMany({
    where: isExternal ? { assignee: actor.name } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      customerSegment: true,
      assignee: true,
      leads: { select: { id: true } },
    },
  })

  return (
    <MobileCustomersClient
      customers={customers}
      canMergeCustomers={canMergeCustomers}
      canRefresh={!isExternal}
    />
  )
}
