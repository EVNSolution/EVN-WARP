import type { Prisma, PrismaClient } from '@/app/generated/prisma/client'

type CustomerReader = Pick<PrismaClient, 'customer'>

// Nested relation reads bind one ID per parent. Stay below SQLite's parameter
// limit on every read, without limiting the number of customers returned.
const PAGE_SIZE = 200
const orderBy = [{ createdAt: 'desc' }, { id: 'desc' }] satisfies Prisma.CustomerOrderByWithRelationInput[]

const include = {
  leads: { select: { id: true, stageCode: true, salesStatus: true } },
  activities: {
    select: { id: true, date: true, type: true },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: 1,
  },
} satisfies Prisma.CustomerInclude

export async function listCustomers(db: CustomerReader, where?: Prisma.CustomerWhereInput) {
  const customers: Prisma.CustomerGetPayload<{ include: typeof include }>[] = []
  let cursor: Prisma.CustomerWhereUniqueInput | undefined
  while (true) {
    const page = await db.customer.findMany({
      where, orderBy, include,
      take: PAGE_SIZE,
      cursor,
      skip: cursor ? 1 : 0,
    })
    customers.push(...page)
    if (page.length < PAGE_SIZE) return customers
    cursor = { id: page[page.length - 1].id }
  }
}
