import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { buildAccountContext } from '@/clever_account_interceptor/typescript'
import { readHqGatewayConfig, type HqGatewayConfig } from '@/lib/account-control/config'
import { dispatchDueAccountEvidence } from '@/lib/account-control/dispatcher'
import { accountActionFingerprint, executeAccountAction } from '@/lib/account-control/outbox'
import { createPrisma } from '@/lib/db'

function required(name: string): string {
  const value = (process.env[name] ?? '').trim()
  if (!value) throw new Error(`missing_${name.toLocaleLowerCase('en-US')}`)
  return value
}

async function enqueue(prisma: ReturnType<typeof createPrisma>, subject: string, idempotencyKey: string) {
  const action = 'warp.account.team.update'
  await executeAccountAction(prisma, {
    context: buildAccountContext({
      authority: 'system:warp',
      subject,
      correlationId: `correlation-${idempotencyKey}`,
    }),
    idempotencyKey,
    action,
    requestFingerprint: accountActionFingerprint(action, idempotencyKey),
    execute: async () => true,
  })
}

async function main() {
  const correctSubject = required('WARP_LOCAL_HQ_SUBJECT')
  const wrongSubject = required('WARP_LOCAL_HQ_WRONG_SUBJECT')
  const gateway = readHqGatewayConfig({
    CLEVER_HQ_GATEWAY_URL: required('WARP_LOCAL_HQ_URL'),
    CLEVER_HQ_CLIENT_KEY: required('WARP_LOCAL_HQ_CLIENT_KEY'),
    CLEVER_HQ_CLIENT_SECRET: required('WARP_LOCAL_HQ_CLIENT_SECRET'),
  })
  const forgedGateway: HqGatewayConfig = {
    ...gateway,
    authorization: `Bearer ${required('WARP_LOCAL_HQ_CLIENT_KEY')}.forged-local-secret`,
  }
  const unavailableGateway: HqGatewayConfig = {
    ...gateway,
    actionUrl: 'http://127.0.0.1:1/api/v1/actions',
    timeoutMs: 250,
  }
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'warp-hq-integration-'))
  const prisma = createPrisma(`file:${path.join(temporaryDirectory, 'probe.db')}`)

  try {
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

    await enqueue(prisma, correctSubject, 'warp-hq-e2e-recovery')
    const outage = await dispatchDueAccountEvidence({
      prisma,
      config: unavailableGateway,
      now: new Date(Date.now() + 1_000),
    })
    const retryable = await prisma.accountEvidenceOutbox.findUniqueOrThrow({ where: { idempotencyKey: 'warp-hq-e2e-recovery' } })
    const recovery = await dispatchDueAccountEvidence({
      prisma,
      config: gateway,
      now: new Date(retryable.nextAttemptAt.getTime() + 1),
    })

    await enqueue(prisma, wrongSubject, 'warp-hq-e2e-wrong-account')
    const wrongAccount = await dispatchDueAccountEvidence({
      prisma,
      config: gateway,
      now: new Date(Date.now() + 2_000),
    })

    await enqueue(prisma, correctSubject, 'warp-hq-e2e-forged-machine')
    const forgedMachine = await dispatchDueAccountEvidence({
      prisma,
      config: forgedGateway,
      now: new Date(Date.now() + 3_000),
    })

    const rows = await prisma.accountEvidenceOutbox.findMany({ orderBy: { idempotencyKey: 'asc' } })
    const byKey = Object.fromEntries(rows.map(row => [row.idempotencyKey, {
      status: row.status,
      attemptCount: row.attemptCount,
      lastErrorCode: row.lastErrorCode,
      hqOperationId: row.hqOperationId,
    }]))
    process.stdout.write(`${JSON.stringify({ outage, recovery, wrongAccount, forgedMachine, byKey })}\n`)
  } finally {
    await prisma.$disconnect()
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

main().catch(error => {
  const code = error instanceof Error ? error.message : 'hq_local_integration_probe_failed'
  process.stderr.write(`${JSON.stringify({ ok: false, code })}\n`)
  process.exitCode = 1
})
