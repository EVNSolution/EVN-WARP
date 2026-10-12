import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { NextRequest } from 'next/server'
import { createClient } from '@libsql/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@/app/generated/prisma/client'
import { listCustomers } from './customer-list'

// All fixtures are synthetic, in a private temporary DB. Never import lib/db.
const directory = mkdtempSync(path.join(tmpdir(), 'warp-customer-list-test-'))
const schema = path.resolve('prisma/schema.prisma')
const config = path.join(directory, 'prisma.config.ts')
const url = `file:${directory}/customers.db`
writeFileSync(config, `export default ${JSON.stringify({ schema, datasource: { url } })}`)
const ddl = execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'),
  'migrate', 'diff', '--from-empty', '--to-schema', schema, '--script', '--config', config],
{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const db = new PrismaClient({ adapter: new PrismaLibSql({ url }) })
const total = 1240
const customerId = (i: number) => `customer-${String(i).padStart(6, '0')}`
const fixtureDate = (i: number) => `2026-10-0${1 + Math.floor(i / 333)}T00:00:00.000+00:00`

test.before(async () => {
  const sqlite = createClient({ url })
  try {
    await sqlite.executeMultiple(ddl)
    const statements: string[] = []
    for (let i = 1; i <= total; i++) {
      const id = customerId(i)
      const date = fixtureDate(i)
      const assignee = i <= 1006 ? 'External Test' : 'Internal Test'
      statements.push(`INSERT INTO Customer (id,name,assignee,phone,companyName,soleBusinessName,vehiclePlateNo,contactsJson,memo,createdAt,updatedAt)
        VALUES ('${id}','Test ${i}','${assignee}','01012345678','Test Company','Test Sole','TEST-PLATE','[{"name":"Contact Test","phone":"010-9999-0000"}]','Preserved memo','${date}','${date}');`)
      // Empty relations and multiple leads/activities must both survive batching.
      if (i % 7 === 0) continue
      for (let j = 1; j <= 3; j++) {
        statements.push(`INSERT INTO SalesDeal (id,customerId,name,stageCode,salesStatus,updatedAt)
          VALUES ('${id}-lead-${j}','${id}','Independent lead ${j}','${j}-1','진행중','${date}');`)
        // The newest activity is deliberately not the last ID or insertion.
        const activityDate = j === 2 ? '2026-10-10' : '2026-09-01'
        statements.push(`INSERT INTO CustomerActivity (id,customerId,type,date)
          VALUES ('${id}-activity-${j}','${id}','전화','${activityDate}T00:00:00.000+00:00');`)
      }
    }
    await sqlite.executeMultiple(`BEGIN;${statements.join('\n')}COMMIT;`)
  } finally { sqlite.close() }
  await db.user.create({ data: { id: 'external', name: 'External Test', email: 'external@example.invalid',
    password: 'unused', role: 'user', employmentType: '사외' } })
  await db.user.create({ data: { id: 'internal', name: 'Internal Test', email: 'internal@example.invalid',
    password: 'unused', role: 'admin', employmentType: '사내' } })
})
test.after(async () => {
  await db.$disconnect()
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()))
  await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
})

function assertRelations(customers: Awaited<ReturnType<typeof listCustomers>>) {
  for (const customer of customers) {
    const i = Number(customer.id.slice('customer-'.length))
    assert.equal(customer.memo, 'Preserved memo')
    assert.deepEqual(customer.leads.map(lead => ({ ...lead })).sort((a, b) => a.id.localeCompare(b.id)),
      i % 7 === 0 ? [] : [1, 2, 3].map(j => ({ id: `${customer.id}-lead-${j}`, stageCode: `${j}-1`, salesStatus: '진행중' })))
    assert.deepEqual(customer.activities, i % 7 === 0 ? [] : [{
      id: `${customer.id}-activity-2`, date: new Date('2026-10-10T00:00:00.000Z'), type: '전화',
    }])
  }
}

test('reproduces the original unbounded relation query P2029 at 1006 customers', async () => {
  await assert.rejects(db.customer.findMany({
    where: { id: { lte: customerId(1006) } },
    orderBy: { createdAt: 'desc' },
    include: {
      leads: { select: { id: true, stageCode: true, salesStatus: true } },
      activities: { select: { id: true, date: true, type: true }, orderBy: { date: 'desc' }, take: 1 },
    },
  }), (error: unknown) => !!error && typeof error === 'object' && 'code' in error && error.code === 'P2029')
})

for (const count of [0, 200, 999, 1000, 1006, 1200, 1201]) {
  test(`returns all ${count} customers, all leads and exactly their latest activity`, async () => {
    const customers = await listCustomers(db, { id: { lte: customerId(count) } })
    assert.deepEqual(customers.map(customer => customer.id),
      Array.from({ length: count }, (_, i) => customerId(count - i)))
    assertRelations(customers)
  })
}

type Element = { props: { customers?: Awaited<ReturnType<typeof listCustomers>>; children?: Element | Element[] } }
function loadModule(file: string, actor: 'external' | 'internal' = 'internal') {
  const filename = path.resolve(file)
  const require = createRequire(filename)
  const exports: Record<string, unknown> = {}
  const user = actor === 'external'
    ? { id: actor, name: 'External Test', employmentType: '사외' }
    : { id: actor, name: 'Internal Test', employmentType: '사내' }
  runInNewContext(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports, URL,
    require: (id: string) => id === '@/lib/db' ? { prisma: db }
      : id === '@/auth' ? { auth: async () => ({ user }) }
      : id === '@/lib/customer-list' ? { listCustomers }
      : id === 'react/jsx-runtime' ? { jsx: (_type: unknown, props: Element['props']) => ({ props }), jsxs: (_type: unknown, props: Element['props']) => ({ props }) }
      : /CustomerListClient|MobileCustomersClient|BuildupEventNotice/.test(id) ? { default: () => null }
      : require(id),
  }, { filename })
  return exports
}
function customersFromElement(element: Element): Awaited<ReturnType<typeof listCustomers>> | undefined {
  if (element.props?.customers) return element.props.customers
  for (const child of [element.props?.children].flat()) {
    if (child && typeof child === 'object') {
      const customers = customersFromElement(child)
      if (customers) return customers
    }
  }
}

for (const file of ['app/(app)/customers/page.tsx', 'app/(mobile)/m/customers/page.tsx']) {
  for (const actor of ['external', 'internal'] as const) {
    test(`${file}: ${actor} keeps its existing customer scope across 1000 rows`, async () => {
      const page = loadModule(file, actor).default as () => Promise<Element>
      const customers = customersFromElement(await page())!
      const count = actor === 'external' ? 1006 : total
      assert.equal(customers.length, count)
      assert.equal(new Set(customers.map(customer => customer.id)).size, count)
      assert.deepEqual([...customers.map(customer => customer.id)].sort(),
        Array.from({ length: count }, (_, i) => customerId(i + 1)))
      if (actor === 'external') assert.ok(customers.every(customer => customer.assignee === 'External Test'))
      for (const customer of customers) {
        const i = Number(customer.id.slice('customer-'.length))
        assert.equal(customer.leads.length, i % 7 === 0 ? 0 : 3)
      }
      if (file.includes('(app)')) assertRelations(customers)
      else assert.deepEqual(Object.keys(customers[0]).sort(),
        ['id', 'name', 'phone', 'status', 'customerSegment', 'assignee', 'leads'].sort())
    })
  }
}

test('actual GET handler preserves complete JSON and every search mode over 1000 results', async () => {
  const get = loadModule('app/api/customers/route.ts').GET as (req: NextRequest) => Promise<Response>
  for (const query of ['', 'q=Test', 'mode=name&q=Contact', 'mode=phone&q=010-1234',
    'mode=phone&q=010-9999', 'mode=company&q=Company', 'mode=company&q=Sole', 'mode=plate&q=PLATE']) {
    const response = await get(new NextRequest(`https://warp.test/api/customers?${query}`))
    assert.equal(response.status, 200)
    const customers = await response.json() as Awaited<ReturnType<typeof listCustomers>>
    assert.equal(customers.length, total, query)
    assert.equal(new Set(customers.map(customer => customer.id)).size, total, query)
    for (const customer of customers) {
      customer.activities = customer.activities.map(activity => ({ ...activity, date: new Date(activity.date) }))
    }
    assertRelations(customers)
  }
  const response = await get(new NextRequest('https://warp.test/api/customers?mode=name&q=no-match'))
  assert.deepEqual(await response.json(), [])
})

test('text timestamps with different storage formats retain every customer across tied page boundaries', async () => {
  const sqlite = createClient({ url })
  try {
    await sqlite.executeMultiple(`UPDATE Customer SET createdAt = CASE
      WHEN CAST(SUBSTR(id, 10) AS INTEGER) % 3 = 0 THEN '2026-10-04T00:00:00.000Z'
      WHEN CAST(SUBSTR(id, 10) AS INTEGER) % 3 = 1 THEN '2026-10-04T00:00:00.000+00:00'
      ELSE '2026-10-04 00:00:00' END;`)
  } finally { sqlite.close() }
  const customers = await listCustomers(db)
  assert.equal(customers.length, total)
  assert.deepEqual(customers.map(customer => customer.id).sort(),
    Array.from({ length: total }, (_, i) => customerId(i + 1)))
  assertRelations(customers)
})
