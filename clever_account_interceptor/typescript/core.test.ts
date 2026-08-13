import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ACCOUNT_SUBJECT_HEADER,
  CONTRACT_VERSION,
  CORRELATION_ID_HEADER,
  InterceptorError,
  buildAccountContext,
  interceptHeaders,
  outboundHeaders,
  safeEvidence,
  validateIdempotencyKey,
} from './core'

test('contract version is explicit', () => {
  assert.equal(CONTRACT_VERSION, '1.0')
})

test('builds immutable context and safe outbound headers', () => {
  const context = buildAccountContext({
    authority: ' SYSTEM:WARP ',
    subject: ' user-001 ',
    correlationId: 'warp-action-001',
  })

  assert.deepEqual(context, {
    authority: 'system:warp',
    subject: 'user-001',
    correlationId: 'warp-action-001',
  })
  assert.equal(Object.isFrozen(context), true)
  assert.deepEqual(outboundHeaders(context, 'operation-001'), {
    [CORRELATION_ID_HEADER]: 'warp-action-001',
    [ACCOUNT_SUBJECT_HEADER]: 'user-001',
    'Idempotency-Key': 'operation-001',
  })
  assert.deepEqual(safeEvidence(context), {
    authority: 'system:warp',
    subject: 'user-001',
    correlation_id: 'warp-action-001',
  })
})

test('intercepts case-insensitive Headers and generates correlation', () => {
  const context = interceptHeaders(new Headers({ 'x-clever-account-subject': 'user-001' }), 'system:warp')
  assert.equal(context.subject, 'user-001')
  assert.match(context.correlationId, /^[a-f0-9]{32}$/)
})

test('rejects invalid identity and idempotency input', () => {
  const calls = [
    () => buildAccountContext({ authority: 'system:warp', subject: '' }),
    () => buildAccountContext({ authority: 'system:warp', subject: 'user-001', correlationId: 'bad id' }),
    () => buildAccountContext({ authority: '', subject: 'user-001' }),
    () => buildAccountContext({ authority: 'bad authority', subject: 'user-001' }),
    () => validateIdempotencyKey('bad key'),
  ]
  for (const call of calls) assert.throws(call, InterceptorError)
})
