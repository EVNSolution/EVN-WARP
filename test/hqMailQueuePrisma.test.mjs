import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createClient } from '@libsql/client'

import { createLibsqlTaggedDb } from '../lib/hqMailLibsql.ts'
import {
  drainHqMailQueueWithPrisma,
  enqueueHqMailForNotification,
  prismaHqMailQueueStore,
} from '../lib/hqMailQueueCore.ts'

async function createTempDb() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'warp-hq-mail-'))
  const dbPath = path.join(dir, 'test.db')
  const url = `file:${dbPath}`
  const client = createClient({ url })
  await client.execute(`
    CREATE TABLE "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE "Notification" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "tripId" TEXT,
      "type" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "link" TEXT,
      "read" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await client.execute(`
    CREATE TABLE "HqMailRequest" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "notificationId" TEXT NOT NULL,
      "idempotencyKey" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'queued',
      "operationId" TEXT,
      "payloadJson" TEXT NOT NULL,
      "attemptCount" INTEGER NOT NULL DEFAULT 0,
      "lastErrorCode" TEXT,
      "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await client.execute('CREATE UNIQUE INDEX "HqMailRequest_notificationId_key" ON "HqMailRequest"("notificationId")')
  await client.execute('CREATE UNIQUE INDEX "HqMailRequest_idempotencyKey_key" ON "HqMailRequest"("idempotencyKey")')
  await client.execute('CREATE INDEX "HqMailRequest_status_nextAttemptAt_idx" ON "HqMailRequest"("status", "nextAttemptAt")')
  const db = createLibsqlTaggedDb(client)
  return {
    db,
    async cleanup() {
      client.close()
      await rm(dir, { recursive: true, force: true })
    },
  }
}

test('libSQL queue persists outage, recovers once, then does not replay accepted rows', async () => {
  const { db, cleanup } = await createTempDb()
  try {
    await db.$executeRaw`INSERT INTO "User" (id, email) VALUES ('user-1', 'approver@evnsolution.com')`

    await db.$executeRaw`
      INSERT INTO "Notification" (id, "userId", "tripId", type, message, link)
      VALUES ('notif-db', 'user-1', 'trip-1', 'approval_request', '[출장] 승인 요청이 도착했습니다', '/trip/trip-1/print')
    `
    const inserted = await enqueueHqMailForNotification(db, {
      notificationId: 'notif-db',
      userId: 'user-1',
      message: '[출장] 승인 요청이 도착했습니다',
      link: '/trip/trip-1/print',
    })
    assert.equal(inserted, true)

    const duplicateInserted = await enqueueHqMailForNotification(db, {
      notificationId: 'notif-db',
      userId: 'user-1',
      message: '[출장] 승인 요청이 도착했습니다',
      link: '/trip/trip-1/print',
    })
    assert.equal(duplicateInserted, false)

    const outage = await drainHqMailQueueWithPrisma(db, {
      limit: 10,
      baseUrl: 'http://hq.test',
      authorization: 'Bearer client.secret',
      fetchImpl: async () => {
        throw new Error('offline')
      },
    })
    assert.deepEqual(outage, { due: 1, accepted: 0, queued: 1, held: 0 })

    let calls = 0
    const recovery = await drainHqMailQueueWithPrisma(db, {
      limit: 10,
      baseUrl: 'http://hq.test',
      authorization: 'Bearer client.secret',
      includeDeferred: true,
      fetchImpl: async (_url, init) => {
        calls += 1
        assert.equal(init.headers['Idempotency-Key'], 'warp.notification.notif-db')
        return {
          status: 202,
          async json() {
            return { ok: true, code: 'accepted', operation_id: '33333333-3333-4333-8333-333333333333' }
          },
        }
      },
    })
    assert.deepEqual(recovery, { due: 1, accepted: 1, queued: 0, held: 0 })
    assert.equal(calls, 1)

    const replay = await drainHqMailQueueWithPrisma(db, {
      limit: 10,
      baseUrl: 'http://hq.test',
      authorization: 'Bearer client.secret',
      fetchImpl: async () => {
        throw new Error('accepted rows must not be resent')
      },
    })
    assert.deepEqual(replay, { due: 0, accepted: 0, queued: 0, held: 0 })

    const rows = await db.$queryRaw`
      SELECT status, "operationId", "attemptCount", "lastErrorCode"
      FROM "HqMailRequest"
      WHERE "notificationId" = 'notif-db'
    `
    assert.deepEqual(rows, [{
      status: 'accepted',
      operationId: '33333333-3333-4333-8333-333333333333',
      attemptCount: 2,
      lastErrorCode: null,
    }])
  } finally {
    await cleanup()
  }
})

test('libSQL claim lease prevents concurrent sends and accepted regression', async () => {
  const { db, cleanup } = await createTempDb()
  try {
    await db.$executeRaw`INSERT INTO "User" (id, email) VALUES ('user-1', 'approver@evnsolution.com')`
    await enqueueHqMailForNotification(db, {
      notificationId: 'notif-lease',
      userId: 'user-1',
      message: '[출장] 승인 요청이 도착했습니다',
      link: '/trip/trip-1/print',
    })

    let releaseFetch
    let fetchCalls = 0
    let drainA
    const fetchEntered = new Promise((resolve) => {
      drainA = drainHqMailQueueWithPrisma(db, {
        limit: 10,
        baseUrl: 'http://hq.test',
        authorization: 'Bearer client.secret',
        fetchImpl: async (_url, init) => {
          fetchCalls += 1
          assert.equal(init.headers['Idempotency-Key'], 'warp.notification.notif-lease')
          resolve()
          await new Promise((release) => {
            releaseFetch = release
          })
          return {
            status: 202,
            async json() {
              return { ok: true, code: 'accepted', operation_id: '44444444-4444-4444-8444-444444444444' }
            },
          }
        },
      })
    })

    await fetchEntered
    const drainB = await drainHqMailQueueWithPrisma(db, {
      limit: 10,
      baseUrl: 'http://hq.test',
      authorization: 'Bearer client.secret',
      includeDeferred: true,
      fetchImpl: async () => {
        throw new Error('unexpired processing lease must not be stolen')
      },
    })
    assert.deepEqual(drainB, { due: 0, accepted: 0, queued: 0, held: 0 })

    releaseFetch()
    const drainAResult = await drainA
    assert.deepEqual(drainAResult, { due: 1, accepted: 1, queued: 0, held: 0 })
    assert.equal(fetchCalls, 1)

    const store = prismaHqMailQueueStore(db)
    const rows = await db.$queryRaw`
      SELECT id, status, "operationId", "attemptCount"
      FROM "HqMailRequest"
      WHERE "notificationId" = 'notif-lease'
    `
    assert.equal(await store.markRetry(rows[0].id, 'late_retry'), false)
    assert.equal(await store.markHeld(rows[0].id, 'late_held'), false)

    const afterLate = await db.$queryRaw`
      SELECT status, "operationId", "attemptCount"
      FROM "HqMailRequest"
      WHERE "notificationId" = 'notif-lease'
    `
    assert.deepEqual(afterLate, [{
      status: 'accepted',
      operationId: '44444444-4444-4444-8444-444444444444',
      attemptCount: 1,
    }])
  } finally {
    await cleanup()
  }
})

test('expired processing lease is recovered with identical idempotency', async () => {
  const { db, cleanup } = await createTempDb()
  try {
    await db.$executeRaw`INSERT INTO "User" (id, email) VALUES ('user-1', 'approver@evnsolution.com')`
    await enqueueHqMailForNotification(db, {
      notificationId: 'notif-expired',
      userId: 'user-1',
      message: '[출장] 승인 요청이 도착했습니다',
      link: '/trip/trip-1/print',
    })

    const store = prismaHqMailQueueStore(db)
    const claimed = await store.claimDue(1)
    assert.equal(claimed.length, 1)
    await db.$executeRaw`
      UPDATE "HqMailRequest"
      SET "nextAttemptAt" = datetime('now', '-1 second')
      WHERE "notificationId" = 'notif-expired'
    `

    const summary = await drainHqMailQueueWithPrisma(db, {
      limit: 10,
      baseUrl: 'http://hq.test',
      authorization: 'Bearer client.secret',
      fetchImpl: async (_url, init) => {
        assert.equal(init.headers['Idempotency-Key'], 'warp.notification.notif-expired')
        return {
          status: 200,
          async json() {
            return { ok: true, code: 'replayed', operation_id: '55555555-5555-4555-8555-555555555555' }
          },
        }
      },
    })
    assert.deepEqual(summary, { due: 1, accepted: 1, queued: 0, held: 0 })
  } finally {
    await cleanup()
  }
})
