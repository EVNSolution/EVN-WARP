import { prisma } from '@/lib/db'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const [
    totalCustomers, linkedDeals, unlinkedDeals, customersWithDetail,
    users, teams,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.salesDeal.count({ where: { customerId: { not: null } } }),
    prisma.salesDeal.count({ where: { customerId: null } }),
    prisma.customer.count({
      where: {
        OR: [
          { vehicleMaker: { not: null } },
          { shipperName:  { not: null } },
          { companyName:  { not: null } },
          { email:        { not: null } },
          { gender:       { not: null } },
        ],
      },
    }),
    prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true, teamId: true,
        team: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.team.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])

  return (
    <AdminClient
      stats={{ totalCustomers, linkedDeals, unlinkedDeals, customersWithDetail }}
      users={users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      teams={teams}
    />
  )
}
