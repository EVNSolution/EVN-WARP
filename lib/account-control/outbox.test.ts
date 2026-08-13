import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { buildAccountContext } from '@/clever_account_interceptor/typescript'
import { createPrisma } from '@/lib/db'

import type { HqGatewayConfig } from './config'
import { dispatchDueAccountEvidence } from './dispatcher'
import { AccountActionConflictError, accountActionFingerprint, executeAccountAction } from './outbox'

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'warp-account-control-'))
const prisma = createPrisma(`file:${path.join(temporaryDirectory, 'test.db')}`)
const context = buildAccountContext({
  authority: 'system:warp',
  subject: 'warp-user-001',
  correlationId: 'warp-local-test-001',
})
const gatewayConfig: HqGatewayConfig = {
  actionUrl: 'http://127.0.0.1:8000/api/v1/actions',
  authorization: 'Bearer warp-web.LOCAL-TEST-SECRET',
  timeoutMs: 1_000,
}

test.before(async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE Team (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX Team_name_key ON Team(name)')
  await prisma.$executeRawUnsafe(`
    CREATE TABLE AccountEvidenceOutbox (
      id TEXT PRIMARY KEY NOT NULL,
      idempotencyKey TEXT NOT NULL,
      requestFingerprint TEXT NOT NULL,
      accountAuthority TEXT NOT NULL,
      accountSubject TEXT NOT NULL,
      correlationId TEXT NOT NULL,
      action TEXT NOT NULL,
      outcome TEXT NOT NULL DEFAULT 'committed',
      occurredAt DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attemptCount INTEGER NOT NULL DEFAULT 0,
      nextAttemptAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lastErrorCode TEXT,
      hqOperationId TEXT,
      hqGatewayRequestId TEXT,
      deliveredAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL
    )
  `)
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX AccountEvidenceOutbox_idempotencyKey_key ON AccountEvidenceOutbox(idempotencyKey)')
  await prisma.$executeRawUnsafe('CREATE INDEX AccountEvidenceOutbox_status_nextAttemptAt_idx ON AccountEvidenceOutbox(status, nextAttemptAt)')
})

test.beforeEach(async () => {
  await prisma.accountEvidenceOutbox.deleteMany()
  await prisma.team.deleteMany()
})

test.after(async () => {
  await prisma.$disconnect()
  rmSync(temporaryDirectory, { recursive: true, force: true })
})

test('business change and evidence Outbox commit atomically and replay without repeating the change', async () => {
  const action = 'warp.account.team.update'
  const input = {
    context,
    idempotencyKey: 'warp-operation-001',
    action,
    requestFingerprint: accountActionFingerprint(action, 'team-001'),
  }
  const first = await executeAccountAction(prisma, {
    ...input,
    execute: transaction => transaction.team.create({ data: { id: 'team-001', name: 'Team One' } }),
  })
  let replayExecuted = false
  const replay = await executeAccountAction(prisma, {
    ...input,
    execute: async () => {
      replayExecuted = true
      return null
    },
  })

  assert.equal(first.replayed, false)
  assert.equal(replay.replayed, true)
  assert.equal(replayExecuted, false)
  assert.equal(await prisma.team.count(), 1)
  assert.equal(await prisma.accountEvidenceOutbox.count(), 1)
})

test('changed payload under the same idempotency key is rejected', async () => {
  const action = 'warp.account.team.update'
  await executeAccountAction(prisma, {
    context,
    idempotencyKey: 'warp-operation-conflict',
    action,
    requestFingerprint: accountActionFingerprint(action, 'team-001'),
    execute: transaction => transaction.team.create({ data: { id: 'team-001', name: 'Team One' } }),
  })

  await assert.rejects(
    executeAccountAction(prisma, {
      context,
      idempotencyKey: 'warp-operation-conflict',
      action,
      requestFingerprint: accountActionFingerprint(action, 'team-002'),
      execute: transaction => transaction.team.create({ data: { id: 'team-002', name: 'Team Two' } }),
    }),
    AccountActionConflictError,
  )
  assert.equal(await prisma.team.count(), 1)
})

test('failed business change leaves neither business data nor Outbox evidence', async () => {
  const action = 'warp.account.team.update'
  await assert.rejects(executeAccountAction(prisma, {
    context,
    idempotencyKey: 'warp-operation-rollback',
    action,
    requestFingerprint: accountActionFingerprint(action, 'team-rollback'),
    execute: async transaction => {
      await transaction.team.create({ data: { id: 'team-rollback', name: 'Rollback Team' } })
      throw new Error('business_failure')
    },
  }))

  assert.equal(await prisma.team.count(), 0)
  assert.equal(await prisma.accountEvidenceOutbox.count(), 0)
})

test('HQ outage keeps evidence retryable and recovery resends the same safe request', async () => {
  const action = 'warp.account.team.update'
  await executeAccountAction(prisma, {
    context,
    idempotencyKey: 'warp-operation-retry',
    action,
    requestFingerprint: accountActionFingerprint(action, 'team-retry'),
    execute: transaction => transaction.team.create({ data: { id: 'team-retry', name: 'Retry Team' } }),
  })
  const firstNow = new Date(Date.now() + 1_000)
  const attempts: Array<{ headers: Headers; body: string }> = []
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    attempts.push({ headers: new Headers(init?.headers), body: String(init?.body) })
    if (attempts.length === 1) throw new Error('hq_down')
    return new Response(JSON.stringify({ ok: true, operation_id: 'hq-operation-001' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json', 'X-Gateway-Request-ID': 'hq-request-001' },
    })
  }

  const failed = await dispatchDueAccountEvidence({ prisma, config: gatewayConfig, fetchImpl, now: firstNow })
  const retryable = await prisma.accountEvidenceOutbox.findUniqueOrThrow({ where: { idempotencyKey: 'warp-operation-retry' } })
  const recovered = await dispatchDueAccountEvidence({
    prisma,
    config: gatewayConfig,
    fetchImpl,
    now: new Date(retryable.nextAttemptAt.getTime() + 1),
  })
  const delivered = await prisma.accountEvidenceOutbox.findUniqueOrThrow({ where: { idempotencyKey: 'warp-operation-retry' } })

  assert.deepEqual(failed, { delivered: 0, retryable: 1, terminal: 0, skipped: 0 })
  assert.deepEqual(recovered, { delivered: 1, retryable: 0, terminal: 0, skipped: 0 })
  assert.equal(attempts.length, 2)
  assert.equal(attempts[0].headers.get('Idempotency-Key'), attempts[1].headers.get('Idempotency-Key'))
  assert.equal(attempts[0].headers.get('X-Clever-Account-Subject'), 'warp-user-001')
  assert.equal(attempts[0].headers.get('X-Correlation-ID'), 'warp-local-test-001')
  assert.equal(attempts[0].body, attempts[1].body)
  assert.equal(delivered.status, 'delivered')
  assert.equal(delivered.attemptCount, 2)
  assert.equal(delivered.hqOperationId, 'hq-operation-001')
  assert.equal(delivered.hqGatewayRequestId, 'hq-request-001')
  assert.doesNotMatch(JSON.stringify(delivered), /LOCAL-TEST-SECRET/)
})

test('HQ account denial becomes terminal without recording the credential', async () => {
  const action = 'warp.account.team.update'
  await executeAccountAction(prisma, {
    context,
    idempotencyKey: 'warp-operation-denied',
    action,
    requestFingerprint: accountActionFingerprint(action, 'team-denied'),
    execute: transaction => transaction.team.create({ data: { id: 'team-denied', name: 'Denied Team' } }),
  })

  const summary = await dispatchDueAccountEvidence({
    prisma,
    config: gatewayConfig,
    now: new Date(Date.now() + 1_000),
    fetchImpl: async () => new Response(JSON.stringify({ ok: false, code: 'account_context_denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }),
  })
  const denied = await prisma.accountEvidenceOutbox.findUniqueOrThrow({ where: { idempotencyKey: 'warp-operation-denied' } })

  assert.deepEqual(summary, { delivered: 0, retryable: 0, terminal: 1, skipped: 0 })
  assert.equal(denied.status, 'terminal')
  assert.equal(denied.lastErrorCode, 'account_context_denied')
  assert.doesNotMatch(JSON.stringify(denied), /LOCAL-TEST-SECRET/)
})
