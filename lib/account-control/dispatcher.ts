import type { PrismaClient } from '@/app/generated/prisma/client'
import { buildAccountContext, outboundHeaders } from '@/clever_account_interceptor/typescript'

import type { HqGatewayConfig } from './config'

type DispatchOptions = {
  prisma: PrismaClient
  config: HqGatewayConfig
  fetchImpl?: typeof fetch
  limit?: number
  now?: Date
}

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])
const SAFE_CODE_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,63}$/

function retryDelayMs(attemptCount: number): number {
  return Math.min(300, 2 ** Math.max(0, attemptCount - 1)) * 1_000
}

function safeResponseCode(body: unknown, status: number): string {
  const code = typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : undefined
  return typeof code === 'string' && SAFE_CODE_PATTERN.test(code) ? code : `hq_http_${status}`
}

export async function dispatchDueAccountEvidence(options: DispatchOptions) {
  const fetchImpl = options.fetchImpl ?? fetch
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100)
  const now = options.now ?? new Date()
  const staleBefore = new Date(now.getTime() - 5 * 60_000)

  await options.prisma.accountEvidenceOutbox.updateMany({
    where: { status: 'dispatching', updatedAt: { lt: staleBefore } },
    data: { status: 'retryable', lastErrorCode: 'stale_dispatch', nextAttemptAt: now },
  })

  const due = await options.prisma.accountEvidenceOutbox.findMany({
    where: { status: { in: ['pending', 'retryable'] }, nextAttemptAt: { lte: now } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  const summary = { delivered: 0, retryable: 0, terminal: 0, skipped: 0 }

  for (const item of due) {
    const claimed = await options.prisma.accountEvidenceOutbox.updateMany({
      where: { id: item.id, status: item.status, attemptCount: item.attemptCount },
      data: { status: 'dispatching', attemptCount: { increment: 1 }, lastErrorCode: null },
    })
    if (claimed.count !== 1) {
      summary.skipped += 1
      continue
    }

    const attemptCount = item.attemptCount + 1
    const context = buildAccountContext({
      authority: item.accountAuthority,
      subject: item.accountSubject,
      correlationId: item.correlationId,
    })
    const headers = {
      ...outboundHeaders(context, item.idempotencyKey),
      Authorization: options.config.authorization,
      'Content-Type': 'application/json',
    }

    try {
      const response = await fetchImpl(options.config.actionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: item.action, outcome: item.outcome, occurred_at: item.occurredAt.toISOString() }),
        signal: AbortSignal.timeout(options.config.timeoutMs),
      })
      const body: unknown = await response.json().catch(() => null)
      const operationId = typeof body === 'object' && body !== null ? (body as { operation_id?: unknown }).operation_id : undefined

      if (response.ok && typeof operationId === 'string' && operationId) {
        await options.prisma.accountEvidenceOutbox.update({
          where: { id: item.id },
          data: {
            status: 'delivered',
            hqOperationId: operationId.slice(0, 64),
            hqGatewayRequestId: (response.headers.get('X-Gateway-Request-ID') ?? '').slice(0, 64) || null,
            deliveredAt: now,
            nextAttemptAt: now,
            lastErrorCode: null,
          },
        })
        summary.delivered += 1
        continue
      }

      const errorCode = response.ok ? 'invalid_hq_response' : safeResponseCode(body, response.status)
      if (!response.ok && !RETRYABLE_STATUSES.has(response.status)) {
        await options.prisma.accountEvidenceOutbox.update({
          where: { id: item.id },
          data: { status: 'terminal', lastErrorCode: errorCode, nextAttemptAt: now },
        })
        summary.terminal += 1
        continue
      }
      await options.prisma.accountEvidenceOutbox.update({
        where: { id: item.id },
        data: {
          status: 'retryable',
          lastErrorCode: errorCode,
          nextAttemptAt: new Date(now.getTime() + retryDelayMs(attemptCount)),
        },
      })
      summary.retryable += 1
    } catch {
      await options.prisma.accountEvidenceOutbox.update({
        where: { id: item.id },
        data: {
          status: 'retryable',
          lastErrorCode: 'network_error',
          nextAttemptAt: new Date(now.getTime() + retryDelayMs(attemptCount)),
        },
      })
      summary.retryable += 1
    }
  }

  return summary
}
