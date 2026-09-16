import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createPrisma } from '@/lib/db'

import { handleMarketingInquiryRequest, type MarketingInquiry } from './marketing-inquiries'

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'warp-marketing-inquiries-'))
const prisma = createPrisma(`file:${path.join(temporaryDirectory, 'test.db')}`)
const KEY = 'marketing-test-key-that-is-at-least-32-chars'
const ENV = { WARP_MARKETING_API_KEY: KEY }

function payload(sourceId: string, overrides: Partial<MarketingInquiry> = {}): MarketingInquiry {
  return {
    source: 'mleverage-admin',
    companyScopeId: '55f9a8bb-73f9-4316-bcd7-7dcdce0bdcc3',
    homepageScopeId: '5c7a6115-a0a9-4e8d-bf65-efce52195fa4',
    sourceId,
    inquiryDate: '2026-09-15',
    inquiryTime: '09:07',
    sourceStatus: '상담대기',
    name: '홍길동',
    phone: '010-1234-5678',
    ...overrides,
  }
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

test.before(async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE Customer (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      companyPhone TEXT,
      contactsJson TEXT,
      customerSegment TEXT,
      status TEXT NOT NULL DEFAULT '잠재고객',
      source TEXT,
      collectedAt DATETIME,
      assignee TEXT,
      isAgent INTEGER NOT NULL DEFAULT 0,
      memo TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE CustomerActivity (
      id TEXT PRIMARY KEY NOT NULL,
      customerId TEXT NOT NULL,
      type TEXT NOT NULL,
      date DATETIME NOT NULL,
      content TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customerId) REFERENCES Customer(id) ON DELETE CASCADE
    )
  `)
})

test.beforeEach(async () => {
  await prisma.customerActivity.deleteMany()
  await prisma.customer.deleteMany()
})

test.after(async () => {
  await prisma.$disconnect()
  rmSync(temporaryDirectory, { recursive: true, force: true })
})

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
      id: 'existing-customer', name: '기존 이름', phone: '010 1234 5678', customerSegment: 'B2B',
      status: '활성', source: '소개', assignee: '담당자', memo: '기존 메모',
    },
    select: { id: true },
  })
  const result = await send(payload('00000000-0000-4000-8000-000000000003', { name: '새 이름' }))

  assert.equal(result.body.customerId, 'existing-customer')
  assert.equal(await prisma.customer.count(), 2)
  assert.deepEqual(await prisma.customer.findUnique({
    where: { id: 'existing-customer' },
    select: { name: true, phone: true, customerSegment: true, status: true, source: true, assignee: true, memo: true },
  }), {
    name: '기존 이름', phone: '010 1234 5678', customerSegment: 'B2B', status: '활성',
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
  const result = await send(payload('00000000-0000-4000-8000-000000000004'))

  assert.equal(result.response.status, 409)
  assert.deepEqual(result.body, { error: 'ambiguous_phone' })
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
  assert.equal(await prisma.customer.count(), 1)
  assert.equal(await prisma.customerActivity.count(), 2)
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
    [{ ...valid, phone: '123' }],
    [{ ...valid, sourceStatus: 1 }],
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
