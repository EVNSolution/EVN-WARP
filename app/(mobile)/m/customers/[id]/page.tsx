import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { resolveCustomerId } from '@/lib/customer-alias'
import CustomerDetailClient from '@/app/(app)/customers/[id]/CustomerDetailClient'

export default async function MobileCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: requestedId } = await params
  const id = await resolveCustomerId(prisma, requestedId)
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const me = await prisma.user.findUnique({
    where: { id: session.user.id }, select: { name: true, employmentType: true },
  })
  if (!me) redirect('/login')
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      leads: { orderBy: { createdAt: 'desc' } },
      activities: { orderBy: { date: 'desc' } },
    },
  })

  if (!customer) notFound()
  if (me.employmentType === '사외' && customer.assignee !== me.name) notFound()
  if (id !== requestedId) redirect(`/m/customers/${encodeURIComponent(id)}`)

  return (
    <CustomerDetailClient
      customer={JSON.parse(JSON.stringify(customer))}
      backHref="/m/customers"
      myName={me?.name ?? ''}
    />
  )
}
