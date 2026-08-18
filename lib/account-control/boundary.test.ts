import assert from 'node:assert/strict'
import test from 'node:test'

import { ACCOUNT_SUBJECT_HEADER, CORRELATION_ID_HEADER } from '@/clever_account_interceptor/typescript'

import { AccountBoundaryError, buildForwardedAccountHeaders, verifyAuthenticatedAccountContext } from './boundary'

test('global boundary overwrites a caller-supplied account subject', () => {
  const incoming = new Headers({
    [ACCOUNT_SUBJECT_HEADER]: 'forged-user',
    [CORRELATION_ID_HEADER]: 'warp-request-001',
  })
  const forwarded = buildForwardedAccountHeaders(incoming, 'authenticated-user')

  assert.equal(forwarded.headers.get(ACCOUNT_SUBJECT_HEADER), 'authenticated-user')
  assert.equal(forwarded.headers.get(CORRELATION_ID_HEADER), 'warp-request-001')
  assert.equal(forwarded.context.authority, 'system:warp')
})

test('server boundary independently rejects a subject that differs from the authenticated session', () => {
  const headers = new Headers({
    [ACCOUNT_SUBJECT_HEADER]: 'forged-user',
    [CORRELATION_ID_HEADER]: 'warp-request-002',
  })

  assert.throws(
    () => verifyAuthenticatedAccountContext(headers, 'authenticated-user'),
    (error: unknown) => error instanceof AccountBoundaryError
      && error.code === 'account_context_denied'
      && error.status === 403,
  )
})

test('server boundary requires both authenticated and forwarded account context', () => {
  assert.throws(
    () => verifyAuthenticatedAccountContext(new Headers(), null),
    (error: unknown) => error instanceof AccountBoundaryError
      && error.code === 'account_context_required'
      && error.status === 401,
  )
  assert.throws(
    () => verifyAuthenticatedAccountContext(new Headers(), 'authenticated-user'),
    (error: unknown) => error instanceof AccountBoundaryError
      && error.code === 'account_context_required'
      && error.status === 422,
  )
})
