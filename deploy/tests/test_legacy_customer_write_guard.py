import subprocess
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class LegacyCustomerWriteGuardTests(unittest.TestCase):
    def test_proxy_blocks_customer_writes_only_after_merge_schema_exists(self):
        # Run the real proxy with synthetic auth, an in-memory SQLite schema and no app DB imports.
        program = textwrap.dedent(r"""
            const assert = require('node:assert/strict')
            const fs = require('node:fs')
            const vm = require('node:vm')
            globalThis.AsyncLocalStorage = require('node:async_hooks').AsyncLocalStorage
            const ts = require('typescript')
            const { createClient } = require('@libsql/client')
            const { NextRequest, NextResponse } = require('next/server')
            const { unstable_doesMiddlewareMatch } = require('next/experimental/testing/server')
            const db = createClient({ url: 'file::memory:' })
            let queries = 0, forwards = 0, failQuery = false
            const imports = {
              '@/auth': { auth: handler => handler },
              '@/lib/db': { prisma: { $queryRaw: async (strings, ...values) => {
                queries++
                const sql = strings.join('?')
                assert.match(sql, /^\s*SELECT\s+1\s+FROM\s+sqlite_master\b/i)
                assert.doesNotMatch(sql, /\bJOIN\b|;/i)
                assert.deepEqual(values, [])
                if (failQuery) throw new Error('private-database-diagnostic')
                return (await db.execute(sql)).rows
              } } },
              '@/lib/account-control/boundary': {
                AccountBoundaryError: class extends Error {},
                buildForwardedAccountHeaders: (headers, subject) => {
                  const forwarded = new Headers(headers)
                  forwarded.set('x-account-subject', subject)
                  return { headers: forwarded, context: { correlationId: 'test-correlation' } }
                },
              },
              'next/server': { NextResponse: {
                json: (...args) => NextResponse.json(...args),
                redirect: (...args) => NextResponse.redirect(...args),
                next: (...args) => { forwards++; return NextResponse.next(...args) },
              } },
            }
            const exports = {}
            vm.runInNewContext(ts.transpileModule(fs.readFileSync('proxy.ts', 'utf8'), {
              compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
            }).outputText, {
              exports, URL,
              require: id => { assert.ok(Object.hasOwn(imports, id), `Unexpected import: ${id}`); return imports[id] },
            }, { filename: 'proxy.ts' })
            const proxy = exports.default
            const message = '복구 버전에서는 고객 정보 수정이 중단됩니다. 최신 버전 복구 후 진행해 주세요.'
            const paths = ['/api/customers', '/api/customers/', '/api/customers/customer',
              '/api/customers/customer/documents', '/api/customers/customer/contact-card',
              '/api/customers/customer/activities?activityId=activity',
              '/api/%63ustomers/id', '/%61pi/customers/id/documents', '/api/customers%2Fid']
            async function request(method, path, status, checked, forwarded, auth = { user: { id: 'actor' } }) {
              assert.equal(unstable_doesMiddlewareMatch({ config: exports.config, nextConfig: {}, url: path }), true)
              const req = new NextRequest(new URL(path, 'https://warp.test'), { method })
              req.auth = auth
              const beforeQueries = queries, beforeForwards = forwards
              const response = await proxy(req)
              assert.equal(response.status, status, `${method} ${path}`)
              assert.equal(queries - beforeQueries, checked, `${method} ${path}: schema lookup`)
              assert.equal(forwards - beforeForwards, forwarded, `${method} ${path}: handler forwarding`)
              if (forwarded) {
                assert.equal(response.headers.get('x-middleware-next'), '1')
                assert.equal(response.headers.get('x-correlation-id'), 'test-correlation')
              } else {
                assert.equal(response.headers.get('x-middleware-next'), null)
              }
              if (status === 409 || status === 503) {
                assert.equal(response.headers.get('cache-control'), 'no-store')
                const body = await response.json()
                assert.ok(body.error)
                assert.doesNotMatch(body.error, /private-database-diagnostic|sqlite|SELECT/i)
                if (status === 409) assert.equal(body.error, message)
              }
            }
            ;(async () => {
              try {
                // Same proxy instance: absence must not be cached across a forward migration.
                await db.execute('CREATE TABLE CustomerMergeArchive (id TEXT)')
                await db.execute('CREATE VIEW CustomerMerge AS SELECT 1')
                for (const path of paths) for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
                  await request(method, path, 200, 1, 1)
                }
                await db.execute('DROP VIEW CustomerMerge')
                await db.execute('CREATE TABLE CustomerMerge (sourceId TEXT PRIMARY KEY)')
                for (const path of paths) for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
                  await request(method, path, 409, 1, 0)
                }
                // A missing session/subject still follows the existing auth boundary without a DB read.
                await request('PUT', paths[2], 307, 0, 0, null)
                await request('PUT', paths[2], 401, 0, 0, { user: {} })
                failQuery = true
                for (const path of paths) await request('DELETE', path, 503, 1, 0)
                // Reads and unrelated writes must not depend on metadata availability.
                for (const path of paths) for (const method of ['GET', 'HEAD', 'OPTIONS']) {
                  await request(method, path, 200, 0, 1)
                }
                for (const path of ['/api/deals/deal', '/api/activities/activity', '/api/customers-export',
                  '/api/%63ustomers-export', '/api/deals/%ZZ', '/funnel']) {
                  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) await request(method, path, 200, 0, 1)
                }
              } finally { db.close() }
            })().catch(error => { console.error(error); process.exitCode = 1 })
        """)
        result = subprocess.run(
            ["node", "-e", program], cwd=ROOT, capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
