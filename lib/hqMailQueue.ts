import 'server-only'

import { prisma } from '@/lib/db'
import { drainHqMailQueueWithPrisma, type PrismaLike } from '@/lib/hqMailQueueCore'

export async function dispatchDueHqMailQueue({ limit = 10 }: { limit?: number } = {}) {
  return drainHqMailQueueWithPrisma(prisma as unknown as PrismaLike, { limit })
}
