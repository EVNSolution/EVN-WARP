import assert from 'node:assert/strict'
import test from 'node:test'

import { AccountControlConfigurationError, readHqGatewayConfig } from './config'

test('builds local gateway configuration without persisting the secret', () => {
  const config = readHqGatewayConfig({
    CLEVER_HQ_GATEWAY_URL: 'http://127.0.0.1:8000',
    CLEVER_HQ_CLIENT_KEY: 'warp-web',
    CLEVER_HQ_CLIENT_SECRET: 'local-secret',
  })

  assert.equal(config.actionUrl, 'http://127.0.0.1:8000/api/v1/actions')
  assert.equal(config.authorization, 'Bearer warp-web.local-secret')
})

test('rejects missing credentials and non-TLS remote gateways', () => {
  assert.throws(() => readHqGatewayConfig({}), AccountControlConfigurationError)
  assert.throws(
    () => readHqGatewayConfig({
      CLEVER_HQ_GATEWAY_URL: 'http://hq.example.com',
      CLEVER_HQ_CLIENT_KEY: 'warp-web',
      CLEVER_HQ_CLIENT_SECRET: 'secret',
    }),
    AccountControlConfigurationError,
  )
  assert.throws(
    () => readHqGatewayConfig({
      CLEVER_HQ_GATEWAY_URL: 'https://hq.example.com/unexpected-base-path',
      CLEVER_HQ_CLIENT_KEY: 'warp-web',
      CLEVER_HQ_CLIENT_SECRET: 'secret',
    }),
    AccountControlConfigurationError,
  )
  assert.throws(
    () => readHqGatewayConfig({
      CLEVER_HQ_GATEWAY_URL: 'https://hq.example.com',
      CLEVER_HQ_CLIENT_KEY: 'warp-web',
      CLEVER_HQ_CLIENT_SECRET: 'secret.with-delimiter',
    }),
    AccountControlConfigurationError,
  )
})
