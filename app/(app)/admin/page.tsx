import { prisma } from '@/lib/db'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const [totalCustomers, linkedDeals, unlinkedDeals, customersWithDetail] = await Promise.all([
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
  ])

  return (
    <AdminClient
      stats={{ totalCustomers, linkedDeals, unlinkedDeals, customersWithDetail }}
    />
  )
}
