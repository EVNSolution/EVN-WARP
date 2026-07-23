import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildWarpNotificationMailPayload,
  drainHqMailQueueStore,
  hqMailIdempotencyKey,
} from '../lib/hqMailCore.ts'
import { isHqMailEnabled, resolveWarpDbTarget } from '../lib/dbTarget.ts'

class MemoryStore {
  rows = []

  enqueue(notificationId, payloadJson) {
    if (this.rows.some((row) => row.notificationId === notificationId)) return false
    this.rows.push({
      id: `row-${notificationId}`,
      notificationId,
      idempotencyKey: hqMailIdempotencyKey(notificationId),
      payloadJson,
      attemptCount: 0,
      status: 'queued',
      operationId: null,
      lastErrorCode: null,
    })
    return true
  }

  async claimDue(limit) {
    const claimed = this.rows.filter((row) => row.status === 'queued').slice(0, limit)
    claimed.forEach((row) => {
      row.status = 'processing'
    })
    return claimed
  }

  async markAccepted(id, operationId) {
    const row = this.rows.find((candidate) => candidate.id === id)
    if (!row || row.status !== 'processing' || row.operationId) return false
    row.status = 'accepted'
    row.operationId = operationId
    row.attemptCount += 1
    row.lastErrorCode = null
    return true
  }

  async markRetry(id, errorCode) {
    const row = this.rows.find((candidate) => candidate.id === id)
    if (!row || row.status !== 'processing' || row.operationId) return false
    row.status = 'queued'
    row.attemptCount += 1
    row.lastErrorCode = errorCode
    return true
  }

  async markHeld(id, errorCode) {
    const row = this.rows.find((candidate) => candidate.id === id)
    if (!row || row.status !== 'processing' || row.operationId) return false
    row.status = 'held'
    row.attemptCount += 1
    row.lastErrorCode = errorCode
    return true
  }
}

function payload(email = 'approver@evnsolution.com') {
  return buildWarpNotificationMailPayload({
    recipientEmail: email,
    message: '[출장] 승인 요청이 도착했습니다',
    link: '/trip/trip-1/print',
  })
}

test('outage keeps an identical durable request queued', async () => {
  const store = new MemoryStore()
  store.enqueue('notif-outage', JSON.stringify(payload()))

  const summary = await drainHqMailQueueStore({
    store,
    limit: 5,
    baseUrl: 'http://hq.test',
    authorization: 'Bearer client.secret',
    fetchImpl: async () => {
      throw new Error('network includes private body but must not escape')
    },
  })

  assert.deepEqual(summary, { due: 1, accepted: 0, queued: 1, held: 0 })
  assert.equal(store.rows[0].status, 'queued')
  assert.equal(store.rows[0].operationId, null)
  assert.equal(store.rows[0].idempotencyKey, 'warp.notification.notif-outage')
  assert.equal(store.rows[0].payloadJson, JSON.stringify(payload()))
  assert.equal(store.rows[0].lastErrorCode, 'hq_unavailable')
})

test('recovery marks accepted and stores the HQ operation id', async () => {
  const store = new MemoryStore()
  store.enqueue('notif-recovery', JSON.stringify(payload()))

  const summary = await drainHqMailQueueStore({
    store,
    limit: 5,
    baseUrl: 'http://hq.test',
    authorization: 'Bearer client.secret',
    fetchImpl: async () => ({
      status: 202,
      async json() {
        return { ok: true, code: 'accepted', operation_id: '11111111-1111-4111-8111-111111111111' }
      },
    }),
  })

  assert.deepEqual(summary, { due: 1, accepted: 1, queued: 0, held: 0 })
  assert.equal(store.rows[0].status, 'accepted')
  assert.equal(store.rows[0].operationId, '11111111-1111-4111-8111-111111111111')
})

test('duplicate notification id produces one HQ request and replay is terminal', async () => {
  const store = new MemoryStore()
  const requestPayload = JSON.stringify(payload())
  assert.equal(store.enqueue('notif-replay', requestPayload), true)
  assert.equal(store.enqueue('notif-replay', requestPayload), false)

  const seen = []
  const summary = await drainHqMailQueueStore({
    store,
    limit: 5,
    baseUrl: 'http://hq.test',
    authorization: 'Bearer client.secret',
    fetchImpl: async (_url, init) => {
      seen.push({
        idempotencyKey: init.headers['Idempotency-Key'],
        body: init.body,
      })
      return {
        status: 200,
        async json() {
          return { ok: true, code: 'replayed', operation_id: '22222222-2222-4222-8222-222222222222' }
        },
      }
    },
  })

  assert.deepEqual(summary, { due: 1, accepted: 1, queued: 0, held: 0 })
  assert.equal(store.rows.length, 1)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].idempotencyKey, 'warp.notification.notif-replay')
  assert.equal(seen[0].body, requestPayload)
  assert.equal(store.rows[0].operationId, '22222222-2222-4222-8222-222222222222')
})

test('idempotency conflict is held and not retried blindly', async () => {
  const store = new MemoryStore()
  store.enqueue('notif-conflict', JSON.stringify(payload()))

  const summary = await drainHqMailQueueStore({
    store,
    limit: 5,
    baseUrl: 'http://hq.test',
    authorization: 'Bearer client.secret',
    fetchImpl: async () => ({
      status: 409,
      async json() {
        return { ok: false, code: 'idempotency_conflict' }
      },
    }),
  })

  assert.deepEqual(summary, { due: 1, accepted: 0, queued: 0, held: 1 })
  assert.equal(store.rows[0].status, 'held')
  assert.equal(store.rows[0].lastErrorCode, 'idempotency_conflict')
})

test('WARP DB target defaults to local dev.db', () => {
  const target = resolveWarpDbTarget({}, '/tmp/warp-app')

  assert.deepEqual(target.config, { url: 'file:/tmp/warp-app/dev.db' })
  assert.equal(target.label, 'file:/tmp/warp-app/dev.db')
})

test('WARP DB target honors WARP_DB_PATH before DATABASE_URL', () => {
  const target = resolveWarpDbTarget({
    WARP_DB_PATH: '/tmp/warp-custom.db',
    DATABASE_URL: 'file:./ignored.db',
  })

  assert.deepEqual(target.config, { url: 'file:/tmp/warp-custom.db' })
  assert.equal(target.label, 'file:/tmp/warp-custom.db')
})

test('WARP DB target honors DATABASE_URL for local file fallback', () => {
  const target = resolveWarpDbTarget({
    DATABASE_URL: 'file:./dev.db',
  })

  assert.deepEqual(target.config, { url: 'file:./dev.db' })
  assert.equal(target.label, 'file:./dev.db')
})

test('WARP DB target uses Turso URL and auth token without leaking token in label', () => {
  const target = resolveWarpDbTarget({
    TURSO_DATABASE_URL: 'libsql://warp-example.turso.io',
    TURSO_AUTH_TOKEN: 'secret-token',
    WARP_DB_PATH: '/tmp/ignored.db',
    DATABASE_URL: 'file:./ignored.db',
  })

  assert.deepEqual(target.config, {
    url: 'libsql://warp-example.turso.io',
    authToken: 'secret-token',
  })
  assert.equal(target.label, 'libsql://warp-example.turso.io (authToken: set)')
  assert.equal(target.label.includes('secret-token'), false)
})

test('WARP DB target requires Turso token when Turso URL is selected', () => {
  assert.throws(
    () => resolveWarpDbTarget({ TURSO_DATABASE_URL: 'libsql://warp-example.turso.io' }),
    /TURSO_AUTH_TOKEN is required/
  )
})

test('HQ mail pilot is opt-in and defaults off', () => {
  assert.equal(isHqMailEnabled({}), false)
  assert.equal(isHqMailEnabled({ CLEVER_HQ_MAIL_ENABLED: 'false' }), false)
  assert.equal(isHqMailEnabled({ CLEVER_HQ_MAIL_ENABLED: 'true' }), true)
  assert.equal(isHqMailEnabled({ CLEVER_HQ_MAIL_ENABLED: 'TRUE' }), true)
})
