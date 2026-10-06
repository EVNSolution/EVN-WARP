import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createClient } from '@libsql/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@/app/generated/prisma/client'
import { customerWrite, type CustomerDb } from './customer-alias'
import { confirmCustomerMerge, previewCustomerMerge } from './customer-merge'

import {
  handleMarketingInquiryCheckRequest,
  handleMarketingInquiryRequest,
  marketingInquiryActivityId,
  type MarketingInquiry,
} from './marketing-inquiries'

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'warp-marketing-inquiries-'))
// All clients and schema operations use isolated temp files; never import lib/db's checkout singleton.
const schema = path.resolve('prisma/schema.prisma')
const config = path.join(temporaryDirectory, 'prisma.config.ts')
writeFileSync(config, `export default ${JSON.stringify({ schema, datasource: { url: `file:${temporaryDirectory}/unused.db` } })}`)
const ddl = execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'),
  'migrate', 'diff', '--from-empty', '--to-schema', schema, '--script', '--config', config],
{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const migration = readFileSync('deploy/schema-migrations/2026100601_add_customer_merge.sql', 'utf8')
let prisma: PrismaClient
let databaseUrl: string
let sequence = 0
function createPrisma(url: string) {
  return new PrismaClient({ adapter: new PrismaLibSql({ url }) })
}
const KEY = 'marketing-test-key-that-is-at-least-32-chars'
const ENV = { WARP_MARKETING_API_KEY: KEY }
const SCOPE = {
  source: 'mleverage-admin',
  companyScopeId: '55f9a8bb-73f9-4316-bcd7-7dcdce0bdcc3',
  homepageScopeId: '5c7a6115-a0a9-4e8d-bf65-efce52195fa4',
}

function payload(sourceId: string, overrides: Partial<MarketingInquiry> = {}): MarketingInquiry {
  return {
    ...SCOPE,
    sourceId,
    inquiryDate: '2026-09-15',
    inquiryTime: '09:07',
    sourceStatus: '상담대기',
    name: '홍길동',
    phone: '010-1234-5678',
    ...overrides,
  }
}

function checkRequest(body: unknown, key = KEY, raw = false) {
  return new Request('http://localhost/api/external/marketing-inquiries/check', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key },
    body: raw ? String(body) : JSON.stringify(body),
  })
}

async function check(body: unknown, key = KEY, raw = false) {
  const response = await handleMarketingInquiryCheckRequest(checkRequest(body, key, raw), prisma, ENV)
  return { response, body: await response.json() }
}

function request(body: unknown, key = KEY, raw = false) {
  return new Request('http://localhost/api/external/marketing-inquiries', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key },
    body: raw ? String(body) : JSON.stringify(body),
  })
}

async function send(body: unknown, key = KEY, raw = false) {
  const response = await handleMarketingInquiryRequest(request(body, key, raw), prisma, ENV)
  return { response, body: await response.json() }
}

test.beforeEach(async () => {
  databaseUrl = `file:${path.join(temporaryDirectory, `${sequence++}.db`)}`
  const sqlite = createClient({ url: databaseUrl })
  await sqlite.executeMultiple(ddl)
  await sqlite.executeMultiple('DROP TABLE CustomerMerge;\n' + migration)
  sqlite.close()
  prisma = createPrisma(databaseUrl)
})

test.afterEach(async () => { await prisma.$disconnect() })
test.after(() => { rmSync(temporaryDirectory, { recursive: true, force: true }) })

async function confirmation(keepId: string, removeId: string) {
  const preview = await previewCustomerMerge(prisma, 'admin', keepId, removeId)
  return { keepId, removeId, previewToken: preview.previewToken,
    choices: Object.fromEntries(preview.fields.filter(field => field.requiresChoice).map(field => [field.key, 'keep'])),
    confirmed: true }
}

async function mergeAdmin() {
  await prisma.user.create({ data: { id: 'admin', name: 'Test admin', email: 'admin@example.invalid', password: 'unused', role: 'admin' } })
}

test('creates named and nameless customers with exact source data', async () => {
  const named = payload('00000000-0000-4000-8000-000000000001')
  const first = await send(named)
  const second = await send(payload('00000000-0000-4000-8000-000000000002', {
    name: '',
    phone: '010-9999-8888',
    inquiryDate: '2026-02-28',
    inquiryTime: '00:05',
  }))

  assert.equal(first.response.status, 200)
  assert.deepEqual(first.body, {
    ok: true,
    customerId: first.body.customerId,
    activityId: `mleverage_${createHash('sha256').update([
      named.source, named.companyScopeId, named.homepageScopeId, named.sourceId,
    ].join(':')).digest('hex')}`,
    created: true,
    duplicate: false,
  })
  assert.equal(second.response.status, 200)
  const customers = await prisma.customer.findMany({
    orderBy: { phone: 'asc' },
    select: { name: true, phone: true, customerSegment: true, status: true, source: true, collectedAt: true },
  })
  assert.deepEqual(customers, [
    { name: '홍길동', phone: '010-1234-5678', customerSegment: 'B2C', status: '잠재고객', source: 'mleverage-admin', collectedAt: new Date('2026-09-15T00:07:00.000Z') },
    { name: '', phone: '010-9999-8888', customerSegment: 'B2C', status: '잠재고객', source: 'mleverage-admin', collectedAt: new Date('2026-02-27T15:05:00.000Z') },
  ])
  const activity = await prisma.customerActivity.findUnique({
    where: { id: first.body.activityId },
    select: { type: true, date: true, content: true },
  })
  assert.deepEqual(activity, {
    type: '이벤트',
    date: new Date('2026-09-15T00:07:00.000Z'),
    content: [
      'mleverage-admin 문의',
      '문의일자: 2026-09-15',
      '문의시간: 09:07',
      '상담상태: 상담대기',
      '성함: 홍길동',
      '연락처: 010-1234-5678',
      '원본 문의 ID: 00000000-0000-4000-8000-000000000001',
    ].join('\n'),
  })
})

test('attaches an exact normalized primary-phone match without changing its profile', async () => {
  await prisma.customer.create({
    data: {
      id: 'non-primary-match', name: '다른 고객', phone: '010-0000-0000',
      companyPhone: '010-1234-5678', contactsJson: '[{"phone":"010-1234-5678"}]',
    },
    select: { id: true },
  })
  await prisma.customer.create({
    data: {
      id: 'existing-customer', name: '기존 이름', phone: '+82 10 1234 5678', customerSegment: 'B2B',
      status: '활성', source: '소개', assignee: '담당자', memo: '기존 메모',
    },
    select: { id: true },
  })
  const result = await send(payload('00000000-0000-4000-8000-000000000003', { name: '새 이름' }))

  assert.equal(result.body.customerId, 'existing-customer')
  assert.equal(result.body.created, false)
  assert.equal(result.body.duplicate, false)
  assert.equal(await prisma.customer.count(), 2)
  assert.deepEqual(await prisma.customer.findUnique({
    where: { id: 'existing-customer' },
    select: { name: true, phone: true, customerSegment: true, status: true, source: true, assignee: true, memo: true },
  }), {
    name: '기존 이름', phone: '+82 10 1234 5678', customerSegment: 'B2B', status: '활성',
    source: '소개', assignee: '담당자', memo: '기존 메모',
  })
})

test('creates distinct customers for the same name with different primary phones', async () => {
  const first = await send(payload('00000000-0000-4000-8000-000000000010'))
  const second = await send(payload('00000000-0000-4000-8000-000000000011', { phone: '010-9999-8888' }))

  assert.notEqual(first.body.customerId, second.body.customerId)
  assert.equal(await prisma.customer.count(), 2)
  assert.equal(await prisma.customerActivity.count(), 2)
})

test('rejects multiple primary-phone matches with no writes', async () => {
  await prisma.customer.createMany({ data: [
    { id: 'duplicate-1', name: 'A', phone: '010-1234-5678' },
    { id: 'duplicate-2', name: 'B', phone: '01012345678' },
  ] })
  for (const overrides of [{}, { rejectExistingCustomer: true as const }]) {
    const result = await send(payload('00000000-0000-4000-8000-000000000004', overrides))
    assert.equal(result.response.status, 409)
    assert.deepEqual(result.body, { error: 'ambiguous_phone' })
  }
  assert.equal(await prisma.customer.count(), 2)
  assert.equal(await prisma.customerActivity.count(), 0)
})

test('replays one source inquiry without adding another customer or activity', async () => {
  const inquiry = payload('00000000-0000-4000-8000-000000000005')
  const first = await send(inquiry)
  const replay = await send(inquiry)

  assert.deepEqual(replay.body, { ...first.body, created: false, duplicate: true })
  assert.equal(await prisma.customer.count(), 1)
  assert.equal(await prisma.customerActivity.count(), 1)
})

test('treats upper- and lowercase spellings of one source UUID as the same inquiry', async () => {
  const inquiry = payload('abcdefab-cdef-4abc-8def-abcdefabcdef')
  const first = await send({ ...inquiry, sourceId: inquiry.sourceId.toUpperCase() })
  const replay = await send(inquiry)

  assert.equal(first.response.status, 200)
  assert.equal(replay.response.status, 200)
  assert.deepEqual(replay.body, { ...first.body, created: false, duplicate: true })
  assert.equal(await prisma.customer.count(), 1)
  assert.equal(await prisma.customerActivity.count(), 1)
})

test('serializes concurrent retries of one source inquiry', async () => {
  const inquiry = payload('00000000-0000-4000-8000-000000000006')
  const results = await Promise.all(Array.from({ length: 6 }, () => send(inquiry)))

  assert.equal(results.filter(result => result.body.created).length, 1)
  assert.equal(results.filter(result => result.body.duplicate).length, 5)
  assert.equal(await prisma.customer.count(), 1)
  assert.equal(await prisma.customerActivity.count(), 1)
})

test('keeps distinct same-phone inquiries as two activities on one customer', async () => {
  const [first, second] = await Promise.all([
    send(payload('00000000-0000-4000-8000-000000000007')),
    send(payload('00000000-0000-4000-8000-000000000008', { sourceStatus: '상담완료' })),
  ])

  assert.equal(first.body.customerId, second.body.customerId)
  assert.notEqual(first.body.activityId, second.body.activityId)
  assert.equal([first, second].filter(result => result.body.created).length, 1)
  assert.equal([first, second].filter(result => result.body.duplicate).length, 0)
  assert.equal(await prisma.customer.count(), 1)
  assert.equal(await prisma.customerActivity.count(), 2)
})

test('serializes independent database clients and leaves the database writable after contention', async () => {
  const other = createPrisma(databaseUrl)
  const inquiry = payload('abcdefab-cdef-4abc-8def-abcdefabcdef')
  try {
    const responses = await Promise.all([
      handleMarketingInquiryRequest(request(inquiry), prisma, ENV),
      handleMarketingInquiryRequest(request({ ...inquiry, sourceId: inquiry.sourceId.toUpperCase() }), other, ENV),
    ])
    assert.deepEqual(responses.map(response => response.status), [200, 200])
    const receipts = await Promise.all(responses.map(response => response.json()))
    assert.equal(receipts.filter(receipt => receipt.created).length, 1)
    assert.equal(receipts.filter(receipt => receipt.duplicate).length, 1)
    assert.equal(await other.customer.count(), 1)
    assert.equal(await prisma.customerActivity.count(), 1)
    const next = await handleMarketingInquiryRequest(request(payload('cccccccc-cccc-4ccc-8ccc-cccccccccccc')), other, ENV)
    assert.equal(next.status, 200)
    assert.equal(await prisma.customerActivity.count(), 2)
  } finally {
    await other.$disconnect()
  }
})

test('rolls back a failed append, releases the writer, and logs no customer or database error text', async () => {
  const logs: unknown[][] = []
  const logger = test.mock.method(console, 'error', (...args: unknown[]) => logs.push(args))
  const inquiry = payload('dddddddd-dddd-4ddd-8ddd-dddddddddddd')
  await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_marketing_test BEFORE INSERT ON CustomerActivity
    BEGIN SELECT RAISE(ABORT, 'synthetic-private-database-message'); END`)
  try {
    const failed = await send(inquiry)
    assert.equal(failed.response.status, 503)
    assert.deepEqual(failed.body, { error: 'temporarily_unavailable' })
    assert.equal(await prisma.customer.count(), 0)
    assert.equal(await prisma.customerActivity.count(), 0)
    assert.equal(logs.length, 1)
    assert.equal(logs[0][0], 'marketing_inquiry_failed')
    const logged = JSON.stringify(logs)
    for (const privateValue of [inquiry.name, inquiry.phone, KEY, 'synthetic-private-database-message']) {
      assert.equal(logged.includes(privateValue), false)
    }
  } finally {
    logger.mock.restore()
    await prisma.$executeRawUnsafe('DROP TRIGGER reject_marketing_test')
  }
  assert.equal((await send(inquiry)).response.status, 200)
  assert.equal(await prisma.customer.count(), 1)
  assert.equal(await prisma.customerActivity.count(), 1)
})

test('cancels a streamed body without content-length as soon as it exceeds 16KB', async () => {
  let pulls = 0
  let cancelled = false
  const chunks = [new Uint8Array(10 * 1024), new Uint8Array(7 * 1024), new Uint8Array(1)]
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[pulls]
      pulls += 1
      if (chunk) controller.enqueue(chunk)
      else controller.close()
    },
    cancel() {
      cancelled = true
    },
  }, { highWaterMark: 0 })
  const streamedRequest = new Request('http://localhost/api/external/marketing-inquiries', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY },
    body: stream,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })

  assert.equal(streamedRequest.headers.has('content-length'), false)
  const response = await handleMarketingInquiryRequest(streamedRequest, prisma, ENV)
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'bad_payload' })
  assert.equal(cancelled, true)
  assert.equal(pulls, 2)
  assert.equal(await prisma.customer.count(), 0)
  assert.equal(await prisma.customerActivity.count(), 0)
})

test('rejects missing or weak configuration, bad authentication, and invalid input before writes', async () => {
  const valid = payload('00000000-0000-4000-8000-000000000009')
  const missing = await handleMarketingInquiryRequest(request(valid), prisma, {})
  const weak = await handleMarketingInquiryRequest(request(valid), prisma, { WARP_MARKETING_API_KEY: 'short' })
  const spaced = await handleMarketingInquiryRequest(request(valid), prisma, { WARP_MARKETING_API_KEY: ` ${KEY}` })
  const unauthorized = await send(valid, 'wrong-key')
  assert.deepEqual([missing.status, weak.status, spaced.status, unauthorized.response.status], [503, 503, 503, 401])
  assert.deepEqual(await missing.json(), { error: 'not_configured' })
  assert.deepEqual(await weak.json(), { error: 'not_configured' })
  assert.deepEqual(await spaced.json(), { error: 'not_configured' })
  assert.deepEqual(unauthorized.body, { error: 'unauthorized' })

  const invalid: Array<[unknown, boolean?]> = [
    ['{', true],
    [{ ...valid, extra: 'field' }],
    [{ ...valid, source: 'other' }],
    [{ ...valid, sourceId: 'not-a-uuid' }],
    [{ ...valid, inquiryDate: '2026-02-30' }],
    [{ ...valid, inquiryTime: '24:00' }],
    [{ ...valid, name: 'x'.repeat(101) }],
    ...['', 'unknown', '123', '12345678', '1234567890123456'].map(phone => [{ ...valid, phone }] as [unknown]),
    [{ ...valid, sourceStatus: 1 }],
    ...[false, null, 'true', 1].map(rejectExistingCustomer => [{ ...valid, rejectExistingCustomer }] as [unknown]),
    ['x'.repeat(16 * 1024 + 1), true],
  ]
  for (const [body, raw] of invalid) {
    const result = await send(body, KEY, raw)
    assert.equal(result.response.status, 400)
    assert.deepEqual(result.body, { error: 'bad_payload' })
  }
  assert.equal(await prisma.customer.count(), 0)
  assert.equal(await prisma.customerActivity.count(), 0)
})

test('check enforces authentication, fixed scope, exact input, unique source IDs, and the 16KB limit', async () => {
  const item = { sourceId: 'abcdefab-cdef-4abc-8def-abcdefabcdef', phone: '010-1234-5678' }
  const valid = { ...SCOPE, items: [item] }
  const missing = await handleMarketingInquiryCheckRequest(checkRequest(valid), prisma, {})
  const unauthorized = await check(valid, 'wrong-key')
  assert.equal(missing.status, 503)
  assert.deepEqual(await missing.json(), { error: 'not_configured' })
  assert.equal(unauthorized.response.status, 401)
  assert.deepEqual(unauthorized.body, { error: 'unauthorized' })

  const invalid = [
    { ...valid, source: 'other' },
    { ...valid, companyScopeId: '00000000-0000-4000-8000-000000000000' },
    { ...valid, homepageScopeId: '00000000-0000-4000-8000-000000000000' },
    { ...valid, items: [] },
    { ...valid, items: Array.from({ length: 51 }, (_, index) => ({ ...item, sourceId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}` })) },
    { ...valid, items: [item, { ...item, sourceId: item.sourceId.toUpperCase() }] },
    { ...valid, items: [{ ...item, sourceId: 'not-a-uuid' }] },
    { ...valid, items: [{ ...item, phone: '123' }] },
    { ...valid, items: [{ ...item, phone: '0'.repeat(41) }] },
    { ...valid, items: [{ ...item, extra: true }] },
    { ...valid, extra: true },
  ]
  for (const body of invalid) {
    const result = await check(body)
    assert.equal(result.response.status, 400)
    assert.deepEqual(result.body, { error: 'bad_payload' })
  }
  const oversized = await check('x'.repeat(16 * 1024 + 1), KEY, true)
  assert.equal(oversized.response.status, 400)
  assert.deepEqual(oversized.body, { error: 'bad_payload' })
  assert.equal(await prisma.customer.count(), 0)
  assert.equal(await prisma.customerActivity.count(), 0)
})

test('check is read-only, batched, name-independent, format-normalized, and only returns own receipts', async () => {
  await prisma.customer.createMany({ data: [
    { id: 'other-customer', name: '완전히 다른 이름', phone: '010-1111-2222' },
    { id: 'international-customer', name: '국제형식', phone: '+82 10 3333 4444' },
    { id: 'company-only', name: '회사번호 전용', phone: null, companyPhone: '010-5555-6666' },
  ] })
  const own = payload('20000000-0000-4000-8000-000000000001', { phone: '010-7777-8888' })
  const created = await send(own)
  const before = [await prisma.customer.findMany(), await prisma.customerActivity.findMany(), await prisma.customerMerge.findMany()]
  await prisma.$executeRawUnsafe('PRAGMA query_only = ON')
  const result = await check({ ...SCOPE, items: [
    { sourceId: own.sourceId, phone: '010-0000-0000' },
    { sourceId: '20000000-0000-4000-8000-000000000002', phone: '+82 10 1111 2222' },
    { sourceId: 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF', phone: '010-3333-4444' },
    { sourceId: '20000000-0000-4000-8000-000000000004', phone: '010-5555-6666' },
  ] })

  assert.equal(result.response.status, 200)
  assert.deepEqual(result.body, { ok: true, results: [
    {
      sourceId: own.sourceId,
      exists: true,
      receipt: { ok: true, customerId: created.body.customerId, activityId: created.body.activityId, created: false, duplicate: true },
    },
    { sourceId: '20000000-0000-4000-8000-000000000002', exists: true },
    { sourceId: 'abcdefab-cdef-4abc-8def-abcdefabcdef', exists: true },
    { sourceId: '20000000-0000-4000-8000-000000000004', exists: false },
  ] })
  await prisma.$executeRawUnsafe('PRAGMA query_only = OFF')
  assert.deepEqual([await prisma.customer.findMany(), await prisma.customerActivity.findMany(), await prisma.customerMerge.findMany()], before)
  assert.equal(JSON.stringify(result.body.results.slice(1)).includes('customerId'), false)
})

test('rejectExistingCustomer blocks existing phones while legacy registration still appends', async () => {
  await prisma.customer.create({
    data: { id: 'existing', name: '기존 고객', phone: '+82 10 1234 5678' },
    select: { id: true },
  })
  const guarded = payload('30000000-0000-4000-8000-000000000001', { rejectExistingCustomer: true })
  const rejected = await send(guarded)
  assert.equal(rejected.response.status, 409)
  assert.deepEqual(rejected.body, { error: 'phone_exists' })
  assert.equal(await prisma.customer.count(), 1)
  assert.equal(await prisma.customerActivity.count(), 0)

  const legacy = await send(payload('30000000-0000-4000-8000-000000000002'))
  assert.equal(legacy.response.status, 200)
  assert.equal(legacy.body.customerId, 'existing')
  assert.equal(await prisma.customer.count(), 1)
  assert.equal(await prisma.customerActivity.count(), 1)
})

test('guard serializes competing writes and checks replay before phone_exists', async () => {
  const inquiries = [
    payload('40000000-0000-4000-8000-000000000001', { rejectExistingCustomer: true }),
    payload('40000000-0000-4000-8000-000000000002', { rejectExistingCustomer: true }),
  ]
  const other = createPrisma(databaseUrl)
  const responses = await Promise.all(inquiries.map(async (inquiry, index) => {
    const response = await handleMarketingInquiryRequest(request(inquiry), index ? other : prisma, ENV)
    return { response, body: await response.json() }
  })).finally(() => other.$disconnect())
  assert.deepEqual(responses.map(result => result.response.status).sort(), [200, 409])
  assert.equal(await prisma.customer.count(), 1)
  assert.equal(await prisma.customerActivity.count(), 1)

  const winner = inquiries[responses.findIndex(result => result.response.status === 200)]
  const replay = await send(winner)
  assert.equal(replay.response.status, 200)
  assert.equal(replay.body.created, false)
  assert.equal(replay.body.duplicate, true)
})

test('guard rejects both same-name and different-name customers without any row changes', async () => {
  await prisma.customer.create({ data: { id: 'existing', name: '홍길동', phone: '010 1234 5678', memo: 'unchanged' } })
  const before = await prisma.customer.findMany()
  for (const name of ['홍길동', '다른 이름']) {
    const result = await send(payload('50000000-0000-4000-8000-000000000001', { name, rejectExistingCustomer: true }))
    assert.equal(result.response.status, 409)
    assert.deepEqual(result.body, { error: 'phone_exists' })
    assert.equal(result.response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await prisma.customer.findMany(), before)
    assert.equal(await prisma.customerActivity.count(), 0)
  }
})

test('guard and lookup agree on country codes and legacy mobiles, ignoring invalid and secondary phones', async () => {
  const phones = [
    ['+82 10 1234 5678', '0082 010 1234 5678'],
    ['010-1234-5679', '+82 (0)10-1234-5679'],
    ['01012345680', '821012345680'],
    ['+82 (0)10-1234-5681', '010.1234.5681'],
    ['011-123-4567', '+82 11 123 4567'],
    ['+82 16 1234 5678', '01612345678'],
    ['0171234567', '0082 17 123 4567'],
    ['01812345678', '+82 018 1234 5678'],
    ['0082 19 1234 5678', '01912345678'],
  ]
  for (const [index, [stored, incoming]] of phones.entries()) {
    await prisma.customer.create({ data: { name: '기존 고객', phone: stored } })
    const inquiry = payload(`51000000-0000-4000-8000-${String(index).padStart(12, '0')}`, { phone: incoming, rejectExistingCustomer: true })
    assert.deepEqual((await check({ ...SCOPE, items: [{ sourceId: inquiry.sourceId, phone: incoming }] })).body,
      { ok: true, results: [{ sourceId: inquiry.sourceId, exists: true }] })
    const result = await send(inquiry)
    assert.equal(result.response.status, 409)
    assert.deepEqual(result.body, { error: 'phone_exists' })
  }
  await prisma.customer.create({ data: { name: 'unknown primary contact', phone: 'unknown',
    companyPhone: '01099998888', contactsJson: '[{"phone":"01099998888"}]' } })
  const fresh = payload('51000000-0000-4000-8000-000000000099', { phone: '01099998888', rejectExistingCustomer: true })
  assert.deepEqual((await check({ ...SCOPE, items: [{ sourceId: fresh.sourceId, phone: fresh.phone }] })).body,
    { ok: true, results: [{ sourceId: fresh.sourceId, exists: false }] })
  const result = await send(fresh)
  assert.equal(result.response.status, 200)
  assert.equal(result.body.created, true)
  assert.equal(result.body.duplicate, false)
  assert.equal(await prisma.customer.count(), phones.length + 2)
  assert.equal(await prisma.customerActivity.count(), 1)
})

test('fixed-line and legacy numeric contacts support lookup, guarded creation, rejection and unguarded append', async () => {
  for (const [index, phone] of ['(02) 123-4567', '02-1234-5678', '+1 (212) 555-0100', '123456789012345'].entries()) {
    const inquiry = payload(`58000000-0000-4000-8000-${String(index * 2).padStart(12, '0')}`,
      { phone, ...(index % 2 ? { rejectExistingCustomer: true as const } : {}) })
    const item = { sourceId: inquiry.sourceId, phone }
    assert.deepEqual((await check({ ...SCOPE, items: [item] })).body,
      { ok: true, results: [{ sourceId: item.sourceId, exists: false }] })
    const first = await send(inquiry)
    assert.equal(first.response.status, 200)
    assert.equal(first.body.created, true)
    assert.equal(first.body.duplicate, false)
    const next = payload(`58000000-0000-4000-8000-${String(index * 2 + 1).padStart(12, '0')}`,
      { phone: phone.replace(/\D/g, '') })
    const before = [await prisma.customer.findMany(), await prisma.customerActivity.findMany()]
    assert.deepEqual((await check({ ...SCOPE, items: [{ sourceId: next.sourceId, phone: next.phone }] })).body,
      { ok: true, results: [{ sourceId: next.sourceId, exists: true }] })
    const rejected = await send({ ...next, rejectExistingCustomer: true })
    assert.equal(rejected.response.status, 409)
    assert.deepEqual(rejected.body, { error: 'phone_exists' })
    assert.deepEqual([await prisma.customer.findMany(), await prisma.customerActivity.findMany()], before)
    const appended = await send(next)
    assert.equal(appended.response.status, 200)
    assert.equal(appended.body.customerId, first.body.customerId)
    assert.equal(appended.body.created, false)
    assert.equal(appended.body.duplicate, false)
    assert.deepEqual((await send({ ...inquiry, rejectExistingCustomer: true })).body,
      { ...first.body, created: false, duplicate: true })
  }
  assert.equal(await prisma.customer.count(), 4)
  assert.equal(await prisma.customerActivity.count(), 8)
})

test('unknown and short contacts cannot match each other or conflate distinct nonmobile phones', async () => {
  await prisma.customer.createMany({ data: [null, '', 'unknown', '123', '12345678'].map(phone => ({ name: '미상', phone })) })
  const before = await prisma.customer.findMany()
  for (const phone of ['', 'unknown', '123', '12345678', '1234567890123456']) {
    const inquiry = payload('59000000-0000-4000-8000-000000000001', { phone })
    for (const result of [await send(inquiry), await send({ ...inquiry, rejectExistingCustomer: true }),
      await check({ ...SCOPE, items: [{ sourceId: inquiry.sourceId, phone }] })]) {
      assert.equal(result.response.status, 400)
      assert.deepEqual(result.body, { error: 'bad_payload' })
    }
  }
  assert.deepEqual(await prisma.customer.findMany(), before)
  assert.equal(await prisma.customerActivity.count(), 0)
  const results = []
  for (const [index, phone] of ['02-1234-5678', '031-123-4567'].entries()) {
    const inquiry = payload(`59000000-0000-4000-8000-${String(index + 2).padStart(12, '0')}`, { phone, rejectExistingCustomer: true })
    assert.deepEqual((await check({ ...SCOPE, items: [{ sourceId: inquiry.sourceId, phone }] })).body,
      { ok: true, results: [{ sourceId: inquiry.sourceId, exists: false }] })
    const result = await send(inquiry)
    assert.equal(result.response.status, 200)
    assert.equal(result.body.created, true)
    results.push(result.body.customerId)
  }
  assert.notEqual(results[0], results[1])
  assert.equal(await prisma.customer.count(), 7)
  assert.equal(await prisma.customerActivity.count(), 2)
})

test('check accepts 50 items and never recovers another source or scope receipt by phone', async () => {
  const inquiry = payload('52000000-0000-4000-8000-000000000001', { rejectExistingCustomer: true })
  const first = await send(inquiry)
  const items = Array.from({ length: 50 }, (_, index) => ({
    sourceId: `52000000-0000-4000-8000-${String(index + 2).padStart(12, '0')}`, phone: inquiry.phone,
  }))
  // A deterministic activity belonging to a different scope is still not this caller's receipt.
  await prisma.customerActivity.create({ data: { id: marketingInquiryActivityId({ ...SCOPE, source: 'other', sourceId: items[0].sourceId }),
    customerId: first.body.customerId, type: '이벤트', date: new Date() } })
  const result = await check({ ...SCOPE, items })
  assert.equal(result.response.status, 200)
  assert.equal(result.response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(result.body, { ok: true, results: items.map(item => ({ sourceId: item.sourceId, exists: true })) })
  assert.equal(await prisma.customer.count(), 1)
  assert.equal(await prisma.customerActivity.count(), 2)
})

test('check fails closed before DB access on invalid auth/input and hides unavailable diagnostics', async () => {
  const inquiry = payload('53000000-0000-4000-8000-000000000001')
  const valid = { ...SCOPE, items: [{ sourceId: inquiry.sourceId, phone: inquiry.phone }] }
  const logs: unknown[][] = []
  const logger = test.mock.method(console, 'error', (...args: unknown[]) => logs.push(args))
  const unavailable = test.mock.fn(async () => { throw new Error(`private ${KEY} ${inquiry.phone}`) })
  const original = prisma
  prisma = new Proxy(original, { get: (target, key) => key === '$transaction' ? unavailable : Reflect.get(target, key) })
  try {
    for (const env of [{}, { WARP_MARKETING_API_KEY: 'short' }, { WARP_MARKETING_API_KEY: ` ${KEY}` }]) {
      const response = await handleMarketingInquiryCheckRequest(checkRequest(valid), prisma, env)
      assert.equal(response.status, 503)
      assert.deepEqual(await response.json(), { error: 'not_configured' })
    }
    for (const key of ['', 'wrong-key']) assert.equal((await check(valid, key)).response.status, 401)
    for (const invalid of [null, [], { ...valid, items: [null] }, { ...valid, items: [{ ...valid.items[0], phone: 'unknown' }] }]) {
      assert.equal((await check(invalid)).response.status, 400)
    }
    assert.equal((await check('{', KEY, true)).response.status, 400)
    const invalidUtf8 = checkRequest(valid)
    const bytesRequest = new Request(invalidUtf8.url, { method: 'POST', headers: invalidUtf8.headers, body: new Uint8Array([0xff]) })
    assert.equal((await handleMarketingInquiryCheckRequest(bytesRequest, prisma, ENV)).status, 400)
    assert.equal(unavailable.mock.callCount(), 0)
    for (const result of [await check(valid), await send(inquiry)]) {
      assert.equal(result.response.status, 503)
      assert.deepEqual(result.body, { error: 'temporarily_unavailable' })
      assert.equal(result.response.headers.get('cache-control'), 'no-store')
    }
    assert.deepEqual(logs, [
      ['marketing_inquiry_check_failed', { code: 'unknown' }],
      ['marketing_inquiry_failed', { code: 'unknown' }],
    ])
  } finally {
    prisma = original
    logger.mock.restore()
  }
  assert.equal(await prisma.customer.count(), 0)
  assert.equal(await prisma.customerActivity.count(), 0)
})

test('receipt replay and read-only check survive real merge chains and resolve archived receipt IDs', async () => {
  await mergeAdmin()
  const inquiry = payload('54000000-0000-4000-8000-000000000001', { rejectExistingCustomer: true })
  const first = await send(inquiry)
  await prisma.customer.createMany({ data: [
    { id: 'middle', name: '중간 고객', phone: '+82 10 1234 5678' },
    { id: 'canonical', name: '최종 고객', phone: '01012345678' },
  ] })
  await confirmCustomerMerge(prisma, 'admin', await confirmation('middle', first.body.customerId))
  await confirmCustomerMerge(prisma, 'admin', await confirmation('canonical', 'middle'))
  const expected = { ...first.body, customerId: 'canonical', created: false, duplicate: true }
  assert.equal((await prisma.customerActivity.findUniqueOrThrow({ where: { id: first.body.activityId } })).customerId, 'canonical')
  for (const archived of [false, true]) {
    if (archived) {
      // Model an old retained receipt FK: recovery must resolve the immutable alias chain without repairing/writing it.
      const sqlite = createClient({ url: databaseUrl })
      await sqlite.execute('PRAGMA foreign_keys = OFF')
      await sqlite.execute({ sql: 'UPDATE CustomerActivity SET customerId = ? WHERE id = ?', args: [first.body.customerId, first.body.activityId] })
      sqlite.close()
    }
    const before = [await prisma.customer.findMany(), await prisma.customerActivity.findMany(), await prisma.customerMerge.findMany()]
    assert.deepEqual((await send(inquiry)).body, expected)
    assert.deepEqual((await check({ ...SCOPE, items: [{ sourceId: inquiry.sourceId, phone: '01099998888' }] })).body,
      { ok: true, results: [{ sourceId: inquiry.sourceId, exists: true, receipt: expected }] })
    assert.deepEqual([await prisma.customer.findMany(), await prisma.customerActivity.findMany(), await prisma.customerMerge.findMany()], before)
  }
  const fresh = payload('54000000-0000-4000-8000-000000000002', { rejectExistingCustomer: true })
  assert.deepEqual((await send(fresh)).body, { error: 'phone_exists' })
  const legacy = await send(payload(fresh.sourceId))
  assert.equal(legacy.response.status, 200)
  assert.equal(legacy.body.customerId, 'canonical')
  assert.equal(legacy.body.created, false)
  assert.equal(legacy.body.duplicate, false)
  assert.equal(await prisma.customer.count(), 1)
  assert.equal(await prisma.customerActivity.count(), 2)
})

test('missing canonical receipt fails closed for replay and lookup without writes', async () => {
  const inquiry = payload('55000000-0000-4000-8000-000000000001', { rejectExistingCustomer: true })
  const first = await send(inquiry)
  await prisma.customerMerge.create({ data: { sourceId: first.body.customerId, targetId: 'missing',
    actorId: 'admin', actorName: 'admin', previewToken: 'synthetic', choicesJson: '{}', snapshotJson: '{}' } })
  const before = [await prisma.customer.findMany(), await prisma.customerActivity.findMany(), await prisma.customerMerge.findMany()]
  const logger = test.mock.method(console, 'error', () => {})
  try {
    for (const result of [await send(inquiry), await check({ ...SCOPE, items: [{ sourceId: inquiry.sourceId, phone: inquiry.phone }] })]) {
      assert.equal(result.response.status, 503)
      assert.deepEqual(result.body, { error: 'temporarily_unavailable' })
    }
  } finally { logger.mock.restore() }
  assert.deepEqual([await prisma.customer.findMany(), await prisma.customerActivity.findMany(), await prisma.customerMerge.findMany()], before)
})

test('receiver waits for an in-flight real merge before reading receipts or matching candidates', async () => {
  await mergeAdmin()
  const inquiry = payload('56000000-0000-4000-8000-000000000001', { rejectExistingCustomer: true })
  const first = await send(inquiry)
  await prisma.customer.create({ data: { id: 'canonical', name: '보존 고객', phone: '+82 10 1234 5678' } })
  const body = await confirmation('canonical', first.body.customerId)
  const other = createPrisma(databaseUrl)
  const transaction = other.$transaction.bind(other)
  let ready!: () => void, release!: () => void
  const started = new Promise<void>(resolve => { ready = resolve })
  const gate = new Promise<void>(resolve => { release = resolve })
  const held = new Proxy(other, { get: (target, key) => key === '$transaction'
    ? (work: (tx: CustomerDb) => Promise<unknown>, options?: { timeout?: number }) =>
      transaction(async tx => { const result = await work(tx); ready(); await gate; return result }, options)
    : Reflect.get(target, key) })
  try {
    const merge = confirmCustomerMerge(held, 'admin', body)
    await Promise.race([started, merge.then(() => { throw new Error('Merge did not reach gate') })])
    const replay = send(inquiry)
    const guarded = send(payload('56000000-0000-4000-8000-000000000002', { rejectExistingCustomer: true }))
    const legacy = send(payload('56000000-0000-4000-8000-000000000003'))
    setTimeout(release, 50)
    await merge
    assert.deepEqual((await replay).body, { ...first.body, customerId: 'canonical', created: false, duplicate: true })
    assert.deepEqual((await guarded).body, { error: 'phone_exists' })
    const appended = await legacy
    assert.equal(appended.response.status, 200)
    assert.equal(appended.body.customerId, 'canonical')
    assert.equal(appended.body.created, false)
    assert.equal(appended.body.duplicate, false)
    assert.equal(await prisma.customer.count(), 1)
    assert.deepEqual((await prisma.customerActivity.findMany()).map(activity => activity.customerId), ['canonical', 'canonical'])
  } finally {
    release()
    await other.$disconnect()
  }
})

test('guard waits for customer writes before deciding that a phone is new', async () => {
  const other = createPrisma(databaseUrl)
  let ready!: () => void, release!: () => void
  const started = new Promise<void>(resolve => { ready = resolve })
  const gate = new Promise<void>(resolve => { release = resolve })
  const write = customerWrite(other, async tx => {
    await tx.customer.create({ data: { name: '동시 등록', phone: '+82 10 1234 5678' } })
    ready(); await gate
  })
  try {
    await Promise.race([started, write.then(() => { throw new Error('Write did not reach gate') })])
    const pending = send(payload('57000000-0000-4000-8000-000000000001', { rejectExistingCustomer: true }))
    setTimeout(release, 50)
    await write
    const result = await pending
    assert.equal(result.response.status, 409)
    assert.deepEqual(result.body, { error: 'phone_exists' })
    assert.equal(await prisma.customer.count(), 1)
    assert.equal(await prisma.customerActivity.count(), 0)
  } finally {
    release()
    await other.$disconnect()
  }
})
