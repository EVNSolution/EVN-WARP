import { randomUUID } from 'node:crypto'

import {
  buildWarpNotificationMailPayload,
  drainHqMailQueueStore,
  hqMailIdempotencyKey,
  isInternalEmployeeEmail,
  safeHqErrorCode,
  type HqFetch,
  type HqMailDrainSummary,
  type HqMailQueueRow,
  type HqMailQueueStore,
} from './hqMailCore'

export type PrismaLike = {
  $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>
  $queryRaw: <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T>
}

export async function enqueueHqMailForNotification(
  db: PrismaLike,
  {
    notificationId,
    userId,
    message,
    link,
    internalDomain = process.env.CLEVER_HQ_INTERNAL_EMAIL_DOMAIN || 'evnsolution.com',
  }: {
    notificationId: string
    userId: string
    message: string
    link?: string | null
    internalDomain?: string
  }
): Promise<boolean> {
  const users = await db.$queryRaw<Array<{ email: string | null }>>`
    SELECT email FROM "User" WHERE id = ${userId} LIMIT 1
  `
  const recipientEmail = users[0]?.email || ''
  if (!isInternalEmployeeEmail(recipientEmail, internalDomain)) return false

  const payload = buildWarpNotificationMailPayload({ recipientEmail, message, link })
  const inserted = await db.$executeRaw`
    INSERT OR IGNORE INTO "HqMailRequest" (
      id, "notificationId", "idempotencyKey", status, "payloadJson", "attemptCount", "nextAttemptAt", "createdAt", "updatedAt"
    )
    VALUES (
      ${randomUUID()}, ${notificationId}, ${hqMailIdempotencyKey(notificationId)}, 'queued', ${JSON.stringify(payload)}, 0, datetime('now'), datetime('now'), datetime('now')
    )
  `
  return inserted > 0
}

export function prismaHqMailQueueStore(db: PrismaLike): HqMailQueueStore {
  return {
    async claimDue(limit: number, includeDeferred = false): Promise<HqMailQueueRow[]> {
      const candidates = includeDeferred
        ? await db.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM "HqMailRequest"
          WHERE "operationId" IS NULL
            AND (
              status = 'queued'
              OR (status = 'processing' AND "nextAttemptAt" <= datetime('now'))
            )
          ORDER BY "createdAt" ASC
          LIMIT ${limit}
        `
        : await db.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM "HqMailRequest"
          WHERE "operationId" IS NULL
            AND (
              (status = 'queued' AND "nextAttemptAt" <= datetime('now'))
              OR (status = 'processing' AND "nextAttemptAt" <= datetime('now'))
            )
          ORDER BY "createdAt" ASC
          LIMIT ${limit}
        `

      const claimed: HqMailQueueRow[] = []
      for (const candidate of candidates) {
        const updated = includeDeferred
          ? await db.$executeRaw`
            UPDATE "HqMailRequest"
            SET status = 'processing',
                "nextAttemptAt" = datetime('now', '+30 seconds'),
                "updatedAt" = datetime('now')
            WHERE id = ${candidate.id}
              AND "operationId" IS NULL
              AND (
                status = 'queued'
                OR (status = 'processing' AND "nextAttemptAt" <= datetime('now'))
              )
          `
          : await db.$executeRaw`
            UPDATE "HqMailRequest"
            SET status = 'processing',
                "nextAttemptAt" = datetime('now', '+30 seconds'),
                "updatedAt" = datetime('now')
            WHERE id = ${candidate.id}
              AND "operationId" IS NULL
              AND (
                (status = 'queued' AND "nextAttemptAt" <= datetime('now'))
                OR (status = 'processing' AND "nextAttemptAt" <= datetime('now'))
              )
          `
        if (updated <= 0) continue
        const rows = await db.$queryRaw<HqMailQueueRow[]>`
          SELECT id, "notificationId", "idempotencyKey", "payloadJson", "attemptCount"
          FROM "HqMailRequest"
          WHERE id = ${candidate.id} AND status = 'processing' AND "operationId" IS NULL
          LIMIT 1
        `
        if (rows[0]) claimed.push(rows[0])
        if (claimed.length >= limit) break
      }
      return claimed
    },
    async markAccepted(id: string, operationId: string) {
      const updated = await db.$executeRaw`
        UPDATE "HqMailRequest"
        SET status = 'accepted',
            "operationId" = ${operationId},
            "lastErrorCode" = NULL,
            "attemptCount" = "attemptCount" + 1,
            "updatedAt" = datetime('now')
        WHERE id = ${id} AND status = 'processing' AND "operationId" IS NULL
      `
      return updated > 0
    },
    async markRetry(id: string, errorCode: string) {
      const updated = await db.$executeRaw`
        UPDATE "HqMailRequest"
        SET status = 'queued',
            "lastErrorCode" = ${safeHqErrorCode(errorCode)},
            "attemptCount" = "attemptCount" + 1,
            "nextAttemptAt" = datetime('now', '+60 seconds'),
            "updatedAt" = datetime('now')
        WHERE id = ${id} AND status = 'processing' AND "operationId" IS NULL
      `
      return updated > 0
    },
    async markHeld(id: string, errorCode: string) {
      const updated = await db.$executeRaw`
        UPDATE "HqMailRequest"
        SET status = 'held',
            "lastErrorCode" = ${safeHqErrorCode(errorCode)},
            "attemptCount" = "attemptCount" + 1,
            "updatedAt" = datetime('now')
        WHERE id = ${id} AND status = 'processing' AND "operationId" IS NULL
      `
      return updated > 0
    },
  }
}

export async function drainHqMailQueueWithPrisma(
  db: PrismaLike,
  {
    limit = 10,
    baseUrl = process.env.CLEVER_HQ_BASE_URL,
    authorization = process.env.CLEVER_HQ_AUTHORIZATION,
    fetchImpl,
    timeoutMs,
    includeDeferred = false,
  }: {
    limit?: number
    baseUrl?: string
    authorization?: string
    fetchImpl?: HqFetch
    timeoutMs?: number
    includeDeferred?: boolean
  } = {}
): Promise<HqMailDrainSummary> {
  return drainHqMailQueueStore({
    store: prismaHqMailQueueStore(db),
    limit,
    baseUrl,
    authorization,
    fetchImpl,
    timeoutMs,
    includeDeferred,
  })
}
