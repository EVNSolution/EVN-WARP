import { prisma } from '@/lib/db'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const [
    totalCustomers, linkedDeals, unlinkedDeals, customersWithDetail,
    users, teams, products, vehicles,
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
        nickname: true, position: true, ssnFront: true, hireDate: true, phone: true,
        employmentType: true, externalRole: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.team.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.product.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    prisma.vehicle.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])

  const corporateCards = await prisma.corporateCard.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <AdminClient
      stats={{ totalCustomers, linkedDeals, unlinkedDeals, customersWithDetail }}
      users={users.map(u => ({
        ...u,
        hireDate: u.hireDate ? u.hireDate.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
      }))}
      teams={teams}
      products={products}
      vehicles={vehicles}
      corporateCards={corporateCards.map(c => ({ ...c, createdAt: c.createdAt.toISOString() }))}
    />
  )
}
