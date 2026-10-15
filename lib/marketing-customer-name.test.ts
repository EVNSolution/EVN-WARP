import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createClient } from '@libsql/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@/app/generated/prisma/client'
import { customerWrite, type CustomerDb } from './customer-alias'
import { confirmCustomerMerge, previewCustomerMerge } from './customer-merge'
import { handleMarketingCustomerNameRequest } from './marketing-customer-name'

// All test clients use private synthetic databases, never the lib/db singleton.
const directory = mkdtempSync(path.join(tmpdir(), 'warp-marketing-name-'))
const schema = path.resolve('prisma/schema.prisma')
const config = path.join(directory, 'prisma.config.ts')
writeFileSync(config, `export default ${JSON.stringify({ schema, datasource: { url: `file:${directory}/unused.db` } })}`)
const ddl = execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'),
  'migrate', 'diff', '--from-empty', '--to-schema', schema, '--script', '--config', config],
{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const migration = readFileSync('deploy/schema-migrations/2026100601_add_customer_merge.sql', 'utf8')
const KEY = 'synthetic-marketing-name-key-at-least-32-characters'
const ENV = { WARP_MARKETING_API_KEY: KEY }
const SCOPE = { source: 'mleverage-admin', companyScopeId: '55f9a8bb-73f9-4316-bcd7-7dcdce0bdcc3', homepageScopeId: '5c7a6115-a0a9-4e8d-bf65-efce52195fa4' }
const LANDING = { source: 'evn-landing', companyScopeId: 'evnsolution', homepageScopeId: 'pv5' }
const INPUT = { action: 'preview', ...SCOPE, sourceId: 'abcdefab-cdef-4abc-8def-abcdefabcdef',
  phone: '010-1234-5678', name: '합성실명', actor: { id: 'marketing-admin', name: '합성 관리자' } }
let db: PrismaClient
let url: string
let sequence = 0
const connect = () => new PrismaClient({ adapter: new PrismaLibSql({ url }) })

test.beforeEach(async () => {
  url = `file:${directory}/${sequence++}.db`
  const sqlite = createClient({ url })
  await sqlite.executeMultiple(ddl)
  await sqlite.executeMultiple('DROP TABLE CustomerMerge;\n' + migration)
  sqlite.close()
  db = connect()
})
test.afterEach(async () => { await db.$disconnect() })
test.after(async () => {
  if (process.platform !== 'win32') await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
})

async function send(input: unknown = INPUT, options: {
  client?: PrismaClient; key?: string; env?: Readonly<Record<string, string | undefined>>; raw?: boolean
} = {}) {
  const response = await handleMarketingCustomerNameRequest(new Request('http://localhost/api/external/marketing-inquiries/customer-name', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': options.key ?? KEY },
    body: options.raw ? String(input) : JSON.stringify(input),
  }), options.client ?? db, options.env ?? ENV)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  return { status: response.status, body: await response.json() }
}

const customer = (name = '미상(📞 5678)', id = 'unknown') => db.customer.create({ data: { id, name, phone: INPUT.phone } })
async function confirmation(input = INPUT) {
  const preview = await send(input)
  assert.equal(preview.body.status, 'ready')
  return { ...input, action: 'confirm', previewToken: preview.body.previewToken as string }
}
function resign(token: string, updates: Record<string, unknown>) {
  const contents = { ...JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()), ...updates }
  const encoded = Buffer.from(JSON.stringify(contents)).toString('base64url')
  return `${encoded}.${createHmac('sha256', KEY).update(`customer.unknown-name.enrich:${encoded}`).digest('base64url')}`
}

test('dedicated authentication fails closed before reading customer data or malformed input', async () => {
  for (const key of ['', 'not-the-key']) assert.deepEqual(await send('{', { raw: true, key }), { status: 401, body: { ok: false, error: 'unauthorized' } })
  for (const env of [{}, { WARP_LOOKUP_API_KEY: KEY }, { WARP_MARKETING_API_KEY: 'short' }, { WARP_MARKETING_API_KEY: KEY + ' ' }]) {
    assert.deepEqual(await send(INPUT, { env }), { status: 503, body: { ok: false, error: 'not_configured' } })
  }
  assert.equal(await db.customerActivity.count(), 0)
})

test('exact fields, scope, actor, real name and Korean mobile are required; oversized and malformed requests are bounded', async () => {
  const invalid = [
    null, [], {}, { ...INPUT, action: ['preview'] }, { ...INPUT, action: 'update' },
    { ...INPUT, source: 'other' }, { ...INPUT, companyScopeId: 'other' }, { ...INPUT, homepageScopeId: 'other' },
    { ...INPUT, ...LANDING, companyScopeId: SCOPE.companyScopeId }, { ...INPUT, sourceId: 'not-uuid' },
    { ...INPUT, actor: { id: '', name: 'admin' } }, { ...INPUT, actor: { id: 'a', name: ' ' } },
    { ...INPUT, actor: { id: 'a'.repeat(129), name: 'admin' } }, { ...INPUT, actor: { id: 'a', name: 'b', role: 'admin' } },
    { ...INPUT, actor: [] }, { ...INPUT, name: ' 이름 ' }, { ...INPUT, name: 'a'.repeat(101) }, { ...INPUT, name: '이\u0000름' },
    ...['', ' ', '-', '미상', '신원 미상', '미상(📞 5678)', '010-1234-5678', '+82 10 9999 9999', '02-123-4567'].map(name => ({ ...INPUT, name })),
    ...['', '02-123-4567', '01012345678abc', '(010)12345678', '12345', '010123456789'].map(phone => ({ ...INPUT, phone })),
    { ...INPUT, customerId: 'arbitrary' }, { ...INPUT, previewToken: 'not-allowed-on-preview' }, { ...INPUT, action: 'confirm' },
  ]
  for (const input of invalid) assert.deepEqual(await send(input), { status: 400, body: { ok: false, error: 'invalid_request' } })
  for (const raw of ['{', 'x'.repeat(16 * 1024 + 1)]) {
    assert.deepEqual(await send(raw, { raw: true }), { status: 400, body: { ok: false, error: 'invalid_request' } })
  }
  assert.equal(await db.customer.count(), 0)
  assert.equal(await db.customerActivity.count(), 0)
})

test('preview is read-only and ready for exact unknown variants or the same primary mobile as name', async () => {
  for (const name of ['', ' ', '-', '미상', '신원미상', '신원 미상', '미상(📞 5678)', '미상(서울📞 5678)', INPUT.phone, '+82 10 1234 5678']) {
    await db.customer.deleteMany()
    const original = await customer(name)
    const result = await send()
    assert.equal(result.status, 200)
    assert.equal(result.body.status, 'ready')
    assert.deepEqual(result.body.customer, { id: original.id, name, phone: '01012345678' })
    assert.equal(result.body.proposedName, INPUT.name)
    assert.ok(result.body.previewToken.length <= 2048)
    const token = Buffer.from(result.body.previewToken.split('.')[0], 'base64url').toString()
    assert.ok(!token.includes(INPUT.name) && !token.includes(INPUT.actor.name) && !token.includes('01012345678'))
    assert.deepEqual(await db.customer.findUnique({ where: { id: original.id } }), original)
  }
  assert.equal(await db.customerActivity.count(), 0)
})

test('already named and same name return bounded information without an actionable token', async () => {
  for (const name of ['기존실명', '홍미상', '미상컴퍼니', '미상(이름)추가', '01099999999', INPUT.name, ' ' + INPUT.name + ' ']) {
    await db.customer.deleteMany()
    await customer(name)
    const result = await send()
    assert.equal(result.body.status, name.trim() === INPUT.name ? 'same_name' : 'already_named')
    assert.equal(result.body.previewToken, undefined)
    assert.deepEqual(Object.keys(result.body.customer).sort(), ['id', 'name', 'phone'])
  }
  assert.equal(await db.customerActivity.count(), 0)
})

test('missing, secondary-only, lead-only and multiple primary matches never expose candidates or a token', async () => {
  await db.customer.create({ data: { name: '다른 고객', phone: '01099998888', companyPhone: INPUT.phone,
    contactsJson: JSON.stringify([{ name: '담당자', phone: INPUT.phone }]) } })
  await db.salesDeal.create({ data: { name: '연결 없는 리드', phone: INPUT.phone } })
  assert.deepEqual(await send(), { status: 200, body: { ok: true, status: 'not_found', proposedName: INPUT.name } })
  await customer()
  await db.customer.create({ data: { name: '미상', phone: '+82 10 1234 5678' } })
  assert.deepEqual(await send(), { status: 200, body: { ok: true, status: 'ambiguous', proposedName: INPUT.name } })
  assert.equal(await db.customerActivity.count(), 0)
})

test('both source scopes update only name and append audit; receipt, customer fields and lead stay intact', async () => {
  for (const scope of [SCOPE, LANDING]) {
    const phone = scope.source === SCOPE.source ? INPUT.phone : '01022223333'
    const input = { ...INPUT, ...scope, phone }
    const before = await db.customer.create({ data: { name: '미상', phone, email: 'synthetic@example.invalid',
      status: '활성', source: '소개', assignee: '보존 담당자', memo: '기존 메모', grade: '골드', tags: '["VIP"]', contactsJson: '[]',
      companyName: '합성 법인', updatedAt: new Date('2026-01-01T00:00:00Z') } })
    const lead = await db.salesDeal.create({ data: { customerId: before.id, name: '보존 리드명', phone,
      source: '소개', assignee: '원래 담당자', stageCode: '1-3', memo: '보존 상담', checklistJson: '{"1-2-1":true}' } })
    const receipt = await db.customerActivity.create({ data: { id: `original_${scope.source}`, customerId: before.id,
      type: '기타', date: new Date(), content: '원본 문의 유지', result: 'marketing:customer-lead-v1' } })
    const result = await send(await confirmation(input))
    assert.equal(result.status, 200)
    assert.equal(result.body.status, 'updated')
    assert.deepEqual(result.body.customer, { id: before.id, name: input.name, phone: phone.replaceAll('-', '') })
    const after = await db.customer.findUniqueOrThrow({ where: { id: before.id } })
    assert.deepEqual({ ...after, name: before.name, updatedAt: before.updatedAt }, before)
    assert.ok(after.updatedAt > before.updatedAt)
    assert.deepEqual(await db.salesDeal.findUnique({ where: { id: lead.id } }), lead)
    assert.deepEqual(await db.customerActivity.findUnique({ where: { id: receipt.id } }), receipt)
    const audit = await db.customerActivity.findUniqueOrThrow({ where: { id: result.body.auditId } })
    assert.equal(audit.customerId, before.id)
    assert.ok(audit.content!.includes('변경 전 이름: 미상') && audit.content!.includes(`변경 후 이름: ${input.name}`))
    for (const value of [input.source, input.sourceId, input.actor.name, input.actor.id, audit.date.toISOString()]) assert.ok(audit.content!.includes(value))
    assert.equal(JSON.parse(audit.result!).updatedAt, after.updatedAt.toISOString())
    assert.ok(!JSON.stringify(audit).includes(KEY))
  }
  assert.equal(await db.customer.count(), 2)
  assert.equal(await db.salesDeal.count(), 2)
  assert.equal(await db.customerActivity.count(), 4)
})

test('signed preview binds source, scope, inquiry, mobile, proposed name and actor; formatting equivalence is safe', async () => {
  await customer()
  const confirm = await confirmation()
  for (const change of [{ ...LANDING }, { sourceId: '00000000-0000-4000-8000-000000000002' },
    { phone: '01099998888' }, { name: '다른실명' }, { actor: { ...INPUT.actor, id: 'other' } }, { actor: { ...INPUT.actor, name: '다른 관리자' } }]) {
    assert.deepEqual(await send({ ...confirm, ...change }), { status: 409, body: { ok: false, error: 'stale_preview' } })
  }
  assert.equal(await db.customerActivity.count(), 0)
  const result = await send({ ...confirm, sourceId: confirm.sourceId.toUpperCase(), phone: '+82 10 1234 5678' })
  assert.equal(result.body.status, 'updated')
})

test('tampered, malformed, expired, future and wrong-key tokens cannot write', async () => {
  await customer()
  const confirm = await confirmation()
  const expiredAt = Date.now() - 600_001
  const futureAt = Date.now() + 60_000
  for (const token of ['bad', confirm.previewToken + '.x', 'x' + confirm.previewToken,
    resign(confirm.previewToken, { issuedAt: expiredAt, expiresAt: expiredAt + 600_000 }),
    resign(confirm.previewToken, { issuedAt: futureAt, expiresAt: futureAt + 600_000 }),
    resign(confirm.previewToken, { version: 2 }), resign(confirm.previewToken, { expiresAt: Date.now() + 9_000_000 })]) {
    assert.deepEqual(await send({ ...confirm, previewToken: token }), { status: 400, body: { ok: false, error: 'invalid_preview' } })
  }
  const rotated = KEY + '-rotated'
  assert.deepEqual(await send(confirm, { key: rotated, env: { WARP_MARKETING_API_KEY: rotated } }), { status: 400, body: { ok: false, error: 'invalid_preview' } })
  assert.equal(await db.customerActivity.count(), 0)
})

test('customer name, metadata, phone, uniqueness or existence changes make preview stale', async () => {
  const changes = [
    () => db.customer.update({ where: { id: 'unknown' }, data: { name: '실명수정' } }),
    () => db.customer.update({ where: { id: 'unknown' }, data: { name: '신원미상' } }),
    () => db.customer.update({ where: { id: 'unknown' }, data: { memo: '다른담당자 수정', updatedAt: new Date(Date.now() + 1000) } }),
    () => db.customer.update({ where: { id: 'unknown' }, data: { phone: '01055556666' } }),
    () => customer('중복 고객', 'second'),
    () => db.customer.delete({ where: { id: 'unknown' } }),
  ]
  for (const change of changes) {
    await db.customer.deleteMany()
    await customer()
    const confirm = await confirmation()
    await change()
    const before = await db.customer.findMany()
    assert.deepEqual(await send(confirm), { status: 409, body: { ok: false, error: 'stale_preview' } })
    assert.deepEqual(await db.customer.findMany(), before)
  }
  assert.equal(await db.customerActivity.count(), 0)
})

test('merge after preview never redirects a name write to the canonical customer', async () => {
  await customer()
  const confirm = await confirmation()
  await customer('미상', 'keep')
  await db.user.create({ data: { id: 'merge-admin', name: '통합 관리자', email: 'merge@example.invalid', password: 'unused', role: 'admin' } })
  const p = await previewCustomerMerge(db, 'merge-admin', 'keep', 'unknown')
  await confirmCustomerMerge(db, 'merge-admin', { keepId: 'keep', removeId: 'unknown', previewToken: p.previewToken,
    choices: Object.fromEntries(p.fields.filter(f => f.requiresChoice).map(f => [f.key, 'keep'])), confirmed: true })
  const before = await db.customer.findMany()
  assert.deepEqual(await send(confirm), { status: 409, body: { ok: false, error: 'stale_preview' } })
  assert.deepEqual(await db.customer.findMany(), before)
  assert.equal(await db.customerActivity.count(), 0)
})

test('duplicate confirms on independent connections create one audit; subsequent edits cannot be falsely replayed', async () => {
  await customer()
  const confirm = await confirmation()
  const other = connect()
  try {
    const results = await Promise.all([send(confirm), send(confirm, { client: other })])
    assert.deepEqual(results.map(result => result.body.status).sort(), ['unchanged', 'updated'])
    assert.equal(results[0].body.auditId, results[1].body.auditId)
    assert.equal(await db.customerActivity.count(), 1)
    const stableCustomer = await db.customer.findUniqueOrThrow({ where: { id: 'unknown' } })
    assert.equal((await send(confirm)).body.status, 'unchanged')
    assert.deepEqual(await db.customer.findUnique({ where: { id: 'unknown' } }), stableCustomer)
    assert.equal(await db.customerActivity.count(), 1)
    await db.customer.update({ where: { id: 'unknown' }, data: { name: '새실명' } })
    assert.deepEqual(await send(confirm), { status: 409, body: { ok: false, error: 'stale_preview' } })
    assert.equal((await db.customer.findUniqueOrThrow({ where: { id: 'unknown' } })).name, '새실명')
  } finally { await other.$disconnect() }
})

test('confirm waits for an independent customer writer and checks its committed update', async () => {
  await customer()
  const confirm = await confirmation()
  const other = connect()
  let ready!: () => void, release!: () => void
  const started = new Promise<void>(resolve => { ready = resolve })
  const gate = new Promise<void>(resolve => { release = resolve })
  const write = customerWrite(other, async tx => {
    await tx.customer.update({ where: { id: 'unknown' }, data: { name: '동시수정 실명' } })
    ready(); await gate
  })
  try {
    await Promise.race([started, write.then(() => { throw new Error('Writer did not reach gate') })])
    const result = send(confirm)
    setTimeout(release, 50)
    await write
    assert.deepEqual(await result, { status: 409, body: { ok: false, error: 'stale_preview' } })
    assert.equal((await db.customer.findUniqueOrThrow({ where: { id: 'unknown' } })).name, '동시수정 실명')
    assert.equal(await db.customerActivity.count(), 0)
  } finally { release(); await other.$disconnect() }
})

test('confirm racing an actual merge waits and rejects the retired customer rather than changing its replacement', async () => {
  await customer()
  const confirm = await confirmation()
  await customer('미상', 'keep')
  await db.user.create({ data: { id: 'merge-admin', name: '통합 관리자', email: 'merge@example.invalid', password: 'unused', role: 'admin' } })
  const p = await previewCustomerMerge(db, 'merge-admin', 'keep', 'unknown')
  const other = connect()
  const transaction = other.$transaction.bind(other)
  let ready!: () => void, release!: () => void
  const started = new Promise<void>(resolve => { ready = resolve })
  const gate = new Promise<void>(resolve => { release = resolve })
  const held = new Proxy(other, { get: (target, key) => key === '$transaction'
    ? (work: (tx: CustomerDb) => Promise<unknown>, options?: { timeout?: number }) =>
      transaction(async tx => { const result = await work(tx); ready(); await gate; return result }, options)
    : Reflect.get(target, key) })
  try {
    const merge = confirmCustomerMerge(held, 'merge-admin', { keepId: 'keep', removeId: 'unknown', previewToken: p.previewToken,
      choices: Object.fromEntries(p.fields.filter(f => f.requiresChoice).map(f => [f.key, 'keep'])), confirmed: true })
    await Promise.race([started, merge.then(() => { throw new Error('Merge did not reach gate') })])
    const result = send(confirm)
    setTimeout(release, 50)
    await merge
    assert.deepEqual(await result, { status: 409, body: { ok: false, error: 'stale_preview' } })
    assert.equal((await db.customer.findUniqueOrThrow({ where: { id: 'keep' } })).name, '미상')
    assert.equal(await db.customer.count(), 1)
    assert.equal(await db.customerActivity.count(), 0)
  } finally { release(); await other.$disconnect() }
})

test('deleted or modified audit cannot acknowledge a successful retry or create another activity', async () => {
  await customer()
  const confirm = await confirmation()
  const result = await send(confirm)
  await db.customerActivity.update({ where: { id: result.body.auditId }, data: { result: '{"capability":"other"}' } })
  assert.deepEqual(await send(confirm), { status: 409, body: { ok: false, error: 'stale_preview' } })
  assert.equal(await db.customerActivity.count(), 1)
  await db.customerActivity.delete({ where: { id: result.body.auditId } })
  assert.deepEqual(await send(confirm), { status: 409, body: { ok: false, error: 'stale_preview' } })
  assert.equal(await db.customerActivity.count(), 0)
  assert.equal((await db.customer.findUniqueOrThrow({ where: { id: 'unknown' } })).name, INPUT.name)
})

test('audit write failure rolls back the name and exposes only a generic safe error', async () => {
  const before = await customer()
  const confirm = await confirmation()
  const transaction = db.$transaction.bind(db)
  const broken = new Proxy(db, { get(target, key) {
    if (key !== '$transaction') return Reflect.get(target, key)
    return (work: (tx: CustomerDb) => Promise<unknown>, options?: { timeout?: number }) => transaction(async tx => {
      const proxied = new Proxy(tx, { get(inner, member) {
        if (member !== 'customerActivity') return Reflect.get(inner, member)
        return { ...tx.customerActivity, create: async () => { throw new Error('synthetic sensitive diagnostic') } }
      } })
      return work(proxied)
    }, options)
  } })
  assert.deepEqual(await send(confirm, { client: broken }), { status: 503, body: { ok: false, error: 'temporarily_unavailable' } })
  assert.deepEqual(await db.customer.findUnique({ where: { id: before.id } }), before)
  assert.equal(await db.customerActivity.count(), 0)
})
