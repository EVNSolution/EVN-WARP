import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import CustomerDetailClient from './CustomerDetailClient'

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { id } = await params
  const { returnTo } = await searchParams
  const session = await auth()
  const me      = session?.user as any
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      leads: { orderBy: { createdAt: 'desc' } },
      activities: { orderBy: { date: 'desc' } },
    },
  })
  if (!customer) notFound()
  if (me?.employmentType === '사외' && customer.assignee !== me?.name) notFound()
  return <CustomerDetailClient customer={JSON.parse(JSON.stringify(customer))} returnTo={returnTo} />
}
