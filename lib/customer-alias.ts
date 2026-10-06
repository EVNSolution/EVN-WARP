import type { Prisma, PrismaClient } from '@/app/generated/prisma/client'

export type CustomerDb = Prisma.TransactionClient

export class CustomerMergeError extends Error {
  constructor(public status: number, message: string, public customerId?: string) {
    super(message)
  }
}

export function customerErrorResponse(error: unknown) {
  const known = error instanceof CustomerMergeError
  return Response.json({
    error: known ? error.message : '고객 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    ...(known && error.customerId ? {
      customerId: error.customerId,
      redirectTo: `/customers/${encodeURIComponent(error.customerId)}`,
    } : {}),
  }, { status: known ? error.status : 503, headers: { 'Cache-Control': 'no-store' } })
}

export async function resolveCustomerId(db: CustomerDb, id: string): Promise<string> {
  const seen = new Set<string>()
  let current = id
  while (!seen.has(current)) {
    seen.add(current)
    const alias = await db.customerMerge.findUnique({ where: { sourceId: current }, select: { targetId: true } })
    if (!alias) return current
    current = alias.targetId
  }
  throw new CustomerMergeError(409, '고객 연결을 확인해 주세요.')
}

export async function requireCurrentCustomerId(db: CustomerDb, id: unknown): Promise<string> {
  if (typeof id !== 'string' || !id || id.length > 128) {
    throw new CustomerMergeError(400, '고객 ID를 확인해 주세요.')
  }
  const canonical = await resolveCustomerId(db, id)
  if (canonical !== id) throw new CustomerMergeError(409, '통합된 고객입니다. 현재 고객으로 이동한 뒤 다시 시도해 주세요.', canonical)
  if (!await db.customer.findUnique({ where: { id }, select: { id: true } })) {
    throw new CustomerMergeError(404, '고객을 찾을 수 없습니다.')
  }
  return id
}

function isBusy(error: unknown): boolean {
  // Inspect only for retry classification; never expose/log database diagnostics.
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string; cause?: unknown; meta?: unknown }
  return e.code === 'P2034' || /SQLITE_BUSY|database is locked/.test(e.message ?? '')
    || (e.cause !== error && isBusy(e.cause)) || (e.meta !== error && isBusy(e.meta))
}

export async function customerWrite<T>(db: PrismaClient, work: (tx: CustomerDb) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async tx => {
        await tx.$executeRaw`PRAGMA busy_timeout = 0`
        // Reserve SQLite's single writer BEFORE any snapshot/authorization reads.
        await tx.$executeRaw`UPDATE "Customer" SET "id" = "id" WHERE 0`
        return work(tx)
      }, { timeout: 15000 })
    } catch (error) {
      if (!isBusy(error) || attempt >= 5) throw error
      await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)))
    }
  }
}
