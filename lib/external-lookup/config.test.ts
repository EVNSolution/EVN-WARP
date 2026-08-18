import assert from 'node:assert/strict'
import test from 'node:test'

import { ExternalLookupConfigurationError, readLookupApiKey, safeKeyEqual } from './config'

const STRONG_KEY = 'a'.repeat(64)

test('accepts a strong key and trims surrounding whitespace', () => {
  assert.equal(readLookupApiKey({ WARP_LOOKUP_API_KEY: ` ${STRONG_KEY} ` }), STRONG_KEY)
})

test('rejects missing, short, or whitespace-containing keys', () => {
  assert.throws(() => readLookupApiKey({}), ExternalLookupConfigurationError)
  assert.throws(() => readLookupApiKey({ WARP_LOOKUP_API_KEY: '' }), ExternalLookupConfigurationError)
  assert.throws(() => readLookupApiKey({ WARP_LOOKUP_API_KEY: 'short-key' }), ExternalLookupConfigurationError)
  assert.throws(
    () => readLookupApiKey({ WARP_LOOKUP_API_KEY: `${'a'.repeat(20)} ${'b'.repeat(20)}` }),
    ExternalLookupConfigurationError,
  )
})

test('safeKeyEqual matches only the exact key, regardless of length', () => {
  assert.equal(safeKeyEqual(STRONG_KEY, STRONG_KEY), true)
  assert.equal(safeKeyEqual(STRONG_KEY, 'b'.repeat(64)), false)
  assert.equal(safeKeyEqual(STRONG_KEY, ''), false)
  assert.equal(safeKeyEqual(STRONG_KEY, STRONG_KEY + 'x'), false)
})
