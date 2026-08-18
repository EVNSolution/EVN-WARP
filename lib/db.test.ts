import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { resolveDatabaseUrl } from './db'

test('production requires an explicit database URL', () => {
  assert.throws(() => resolveDatabaseUrl({ NODE_ENV: 'production' }), /DATABASE_URL/)
})

test('configured database URL wins and development keeps the local fallback', () => {
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: 'file:/var/lib/warp/dev.db' }), 'file:/var/lib/warp/dev.db')
  assert.equal(resolveDatabaseUrl({ NODE_ENV: 'development' }), `file:${path.resolve(process.cwd(), 'dev.db')}`)
})
