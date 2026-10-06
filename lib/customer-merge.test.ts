import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createClient } from '@libsql/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@/app/generated/prisma/client'
import { confirmCustomerMerge, customerMergeFields, findCustomerDuplicates, previewCustomerMerge, requireMergeActor } from './customer-merge'
import { customerWrite, CustomerMergeError, requireCurrentCustomerId, resolveCustomerId } from './customer-alias'
import { normalizeCustomerMobile } from './customer-mobile'
import { handleCustomerMergeRequest } from './customer-merge-http'
import { handleMarketingInquiryRequest } from './marketing-inquiries'

// Never import lib/db (its singleton can open a checkout DB). All connections and CLI config are private temp files.
const directory = mkdtempSync(path.join(tmpdir(), 'warp-customer-merge-test-'))
const schema = path.resolve('prisma/schema.prisma')
const config = path.join(directory, 'prisma.config.ts')
writeFileSync(config, `export default ${JSON.stringify({ schema, datasource: { url: `file:${directory}/unused.db` } })}`)
const ddl = execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'),
  'migrate', 'diff', '--from-empty', '--to-schema', schema, '--script', '--config', config], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const migration = readFileSync('deploy/schema-migrations/2026100601_add_customer_merge.sql', 'utf8')
let db: PrismaClient
let url: string
let sequence = 0
const clients: PrismaClient[] = []
function connect() {
  const client = new PrismaClient({ adapter: new PrismaLibSql({ url }) })
  clients.push(client)
  return client
}

test.beforeEach(async () => {
  url = `file:${directory}/${sequence++}.db`
  const sqlite = createClient({ url })
  await sqlite.executeMultiple(ddl)
  // Apply the real forward migration, including the deletion/audit guards.
  await sqlite.executeMultiple('DROP TABLE CustomerMerge;\n' + migration)
  sqlite.close()
  db = connect()
  await db.user.create({ data: { id: 'admin', name: '테스트 관리자', email: 'admin@example.invalid', password: 'unused', role: 'admin' } })
  await db.customer.create({ data: { id: 'keep', name: '김보존', phone: '010-1234-5678', memo: '원본 유지', source: '전시회', assignee: '담당A' } })
  await db.customer.create({ data: { id: 'remove', name: '김통합', phone: '+82 10 1234 5678', memo: '원본 통합', source: '마케팅', assignee: '담당B' } })
})
test.afterEach(async () => { await Promise.all(clients.splice(0).map(client => client.$disconnect())) })
test.after(() => rmSync(directory, { recursive: true, force: true }))

async function confirmation(keepId = 'keep', removeId = 'remove') {
  const p = await previewCustomerMerge(db, 'admin', keepId, removeId)
  return { keepId, removeId, previewToken: p.previewToken,
    choices: Object.fromEntries(p.fields.filter(f => f.requiresChoice).map(f => [f.key, 'keep' as const])), confirmed: true as const }
}
async function rejectsStatus(work: Promise<unknown>, status: number) {
  await assert.rejects(work, (error: unknown) => error instanceof CustomerMergeError && error.status === status)
}

async function relations() {
  await db.salesDeal.create({ data: { id: 'deal', customerId: 'remove', name: '개별 리드 원본명', phone: '01012345678',
    stage: '계약', stageCode: '3-1', salesStatus: '진행중', totalPrice: 7123, vehiclePrice: 5000, memo: '독립 메모',
    meetings: { create: { id: 'meeting', type: '전화', meetingAt: new Date(), filesJson: '[{"path":"/api/uploads/deal/file.pdf"}]' } },
    stageHistory: { create: { id: 'history', fromStageCode: '2-1', toStageCode: '3-1' } },
    documents: { create: { id: 'document', stageCode: '3-1', docKey: 'contract', docLabel: '계약', fileName: '원본.pdf', storedName: 'original.pdf', filePath: '/old/file.pdf', fileSize: 50, mimeType: 'application/pdf' } },
    shares: { create: { id: 'share', targetUser: '담당A' } },
  } })
  await db.customerActivity.create({ data: { id: 'receipt', customerId: 'remove', type: '이벤트', date: new Date(), content: '원문', result: '접수' } })
  await db.agent.create({ data: { id: 'agent', customerId: 'remove', name: '소개자' } })
  await db.buildupEvent.create({ data: { id: 'event', eventKey: 'quote_created:1', type: 'quote_created', buildupQuoteId: 1, warpCustomerId: 'remove', payloadJson: '{"original":true}' } })
  await db.salesDeal.create({ data: { id: 'kept-deal', customerId: 'keep', name: '유지 리드', phone: '01012345678', stageCode: '1-1' } })
}

const include = { meetings: true, stageHistory: true, documents: true, shares: true }

test('domestic mobile normalization includes legacy mobiles and excludes names, missing phones and landlines', async () => {
  for (const input of ['010-1234-5678', '010 1234 5678', '+82 10-1234-5678', '0082 01012345678', '+82 01012345678']) {
    assert.equal(normalizeCustomerMobile(input), '01012345678')
  }
  for (const input of ['0111234567', '+82 16 123 4567', '0082 19 1234 5678']) assert.ok(normalizeCustomerMobile(input))
  for (const input of [null, '', '0101234567', '010123456789', '0212345678', '07012345678', '010abc12345678', '010.1234.5678']) {
    assert.equal(normalizeCustomerMobile(input), null)
  }
  await db.customer.createMany({ data: [
    { id: 'empty1', name: '이름 같음' }, { id: 'empty2', name: '이름 같음', phone: '' },
    { id: 'land1', name: '회사', phone: '02-1234-5678' }, { id: 'land2', name: '회사', phone: '0212345678' },
  ] })
  await relations()
  await db.salesDeal.create({ data: { id: 'unlinked', name: '독립', phone: '0082 10 1234 5678' } })
  await db.salesDeal.create({ data: { id: 'mismatch', name: '잘못된 연결', phone: '01099998888', customerId: 'keep' } })
  const result = await findCustomerDuplicates(db, 'admin')
  assert.equal(result.total, 6)
  assert.equal(result.dupCount, 1)
  assert.equal(result.groupCount, 1)
  assert.equal(result.groups[0].phone, '01012345678')
  assert.equal(result.leadTotal, 4)
  assert.equal(result.leadGroupCount, 2)
  assert.equal(result.leadGroups.find(g => g.phone === '01012345678')?.leads.length, 3)
  assert.equal(result.leadGroups.find(g => g.phone === '01099998888')?.associationMismatch, true)
})

test('current DB role gates lookup, preview and confirmation, including external admin and deleted/demoted sessions', async () => {
  await rejectsStatus(findCustomerDuplicates(db, undefined), 401)
  await rejectsStatus(previewCustomerMerge(db, 'missing', 'keep', 'remove'), 403)
  const body = await confirmation()
  for (const data of [{ role: 'user' }, { role: 'admin', employmentType: '사외' }, { role: 'ceo', employmentType: '사외' }]) {
    await db.user.update({ where: { id: 'admin' }, data })
    await rejectsStatus(findCustomerDuplicates(db, 'admin'), 403)
    await rejectsStatus(previewCustomerMerge(db, 'admin', 'keep', 'remove'), 403)
    await rejectsStatus(confirmCustomerMerge(db, 'admin', body), 403)
  }
  await db.user.update({ where: { id: 'admin' }, data: { role: 'ceo', employmentType: '사내' } })
  assert.equal((await requireMergeActor(db, 'admin')).role, 'ceo')
  await db.user.delete({ where: { id: 'admin' } })
  await rejectsStatus(confirmCustomerMerge(db, 'admin', body), 403)
})

test('all business scalars are previewed; empty fill, zero/false conflicts and unknown-name preference are explicit', async () => {
  await db.customer.update({ where: { id: 'keep' }, data: { name: '신원미상(서울 📞 5678)', companyName: '  ', birthYear: 0, hasVehicle: false, grade: '실버', customerSegment: 'B2C' } })
  await db.customer.update({ where: { id: 'remove' }, data: { companyName: '회사명', birthYear: 1985, hasVehicle: true, grade: '골드', customerSegment: 'B2B' } })
  const p = await previewCustomerMerge(db, 'admin', 'keep', 'remove')
  const fields = new Map(p.fields.map(f => [f.key, f]))
  const customer = await db.customer.findUniqueOrThrow({ where: { id: 'keep' } })
  assert.deepEqual([...fields.keys()].sort(), Object.keys(customer).filter(key => !['id', 'createdAt', 'updatedAt'].includes(key)).sort())
  assert.equal(fields.get('name')?.resultValue, '김통합')
  assert.equal(fields.get('name')?.mode, 'automatic')
  assert.equal(fields.get('companyName')?.mode, 'fill')
  for (const key of ['birthYear', 'hasVehicle', 'grade', 'customerSegment', 'assignee', 'source'] as const) assert.equal(fields.get(key)?.requiresChoice, true)
  const [a, b] = await Promise.all(['keep', 'remove'].map(id => db.customer.findUniqueOrThrow({ where: { id } })))
  for (const name of ['미상', '미상(📞 1234)', '미상(🚚 5678)', '신원미상']) {
    assert.equal(customerMergeFields({ ...a, name }, b).find(f => f.key === 'name')?.resultValue, b.name)
  }
  assert.equal(customerMergeFields({ ...a, name: '김미상' }, b).find(f => f.key === 'name')?.mode, 'conflict')
})

test('merge preserves all related records, both original snapshots, conflicting metadata objects and original file paths', async () => {
  await relations()
  await db.customer.update({ where: { id: 'keep' }, data: { contactsJson: '[{"id":"contact","name":"첫째","phone":"01011112222"}]',
    documentsJson: '[{"type":"사업자","path":"/api/uploads/customers/keep/a.pdf"}]', tags: '["기존"]', vehicleListJson: '[{"name":"PV5","count":1}]' } })
  await db.customer.update({ where: { id: 'remove' }, data: { contactsJson: '[{"id":"contact","name":"둘째","phone":"01033334444"}]',
    documentsJson: '[{"type":"사업자","path":"/api/uploads/customers/remove/b.pdf"}]', tags: '["추가","기존"]', vehicleListJson: '[{"name":"PV5","count":2}]' } })
  const originalKeep = await db.customer.findUniqueOrThrow({ where: { id: 'keep' } })
  const originalRemove = await db.customer.findUniqueOrThrow({ where: { id: 'remove' } })
  const deal = await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' }, include })
  const activity = await db.customerActivity.findUniqueOrThrow({ where: { id: 'receipt' } })
  const agent = await db.agent.findUniqueOrThrow({ where: { id: 'agent' } })
  const event = await db.buildupEvent.findUniqueOrThrow({ where: { id: 'event' } })
  const p = await previewCustomerMerge(db, 'admin', 'keep', 'remove')
  assert.deepEqual(p.counts, { leads: 1, activities: 1, agents: 1, events: 1 })
  assert.deepEqual(await confirmCustomerMerge(db, 'admin', await confirmation()), { ok: true, message: '고객 통합이 완료되었습니다.', customerId: 'keep' })
  assert.equal(await db.customer.count(), 1)
  const kept = await db.customer.findUniqueOrThrow({ where: { id: 'keep' } })
  assert.match(kept.memo!, /원본 유지/); assert.match(kept.memo!, /원본 통합/)
  assert.match(kept.memo!, /통합 고객:/)
  assert.deepEqual(JSON.parse(kept.documentsJson!), [...JSON.parse(originalKeep.documentsJson!), ...JSON.parse(originalRemove.documentsJson!)])
  assert.deepEqual(JSON.parse(kept.vehicleListJson!), [{ name: 'PV5', count: 1 }, { name: 'PV5', count: 2 }])
  assert.deepEqual(JSON.parse(kept.tags!), ['기존', '추가'])
  const contacts = JSON.parse(kept.contactsJson!)
  assert.equal(contacts.length, 2); assert.notEqual(contacts[0].id, contacts[1].id)
  assert.deepEqual(contacts[1], { ...JSON.parse(originalRemove.contactsJson!)[0], id: contacts[1].id })
  assert.equal(p.fields.find(f => f.key === 'contactsJson')?.resultValue, kept.contactsJson)
  assert.deepEqual(await db.salesDeal.findUnique({ where: { id: 'deal' }, include }), { ...deal, customerId: 'keep' })
  assert.deepEqual(await db.customerActivity.findUnique({ where: { id: 'receipt' } }), { ...activity, customerId: 'keep' })
  assert.deepEqual(await db.agent.findUnique({ where: { id: 'agent' } }), { ...agent, customerId: 'keep' })
  assert.deepEqual(await db.buildupEvent.findUnique({ where: { id: 'event' } }), { ...event, warpCustomerId: 'keep' })
  const audit = await db.customerMerge.findUniqueOrThrow({ where: { sourceId: 'remove' } })
  const archived = JSON.parse(audit.snapshotJson)
  assert.deepEqual(archived.keep, JSON.parse(JSON.stringify(originalKeep)))
  assert.deepEqual(archived.remove, JSON.parse(JSON.stringify(originalRemove)))
  assert.equal(archived.leads.length, 2)
  assert.equal(audit.actorId, 'admin'); assert.ok(audit.createdAt)
  assert.equal(archived.remove.contactsJson, originalRemove.contactsJson)
  await assert.rejects(db.customerMerge.update({ where: { sourceId: 'remove' }, data: { actorName: '변경' } }))
  await assert.rejects(db.customerMerge.delete({ where: { sourceId: 'remove' } }))
})

test('requires all conflict choices, rejects arbitrary patch keys, invalid choices and invalid pair/phones', async () => {
  const body = await confirmation()
  await rejectsStatus(confirmCustomerMerge(db, 'admin', { ...body, choices: {} }), 400)
  await rejectsStatus(confirmCustomerMerge(db, 'admin', { ...body, choices: { ...body.choices, id: 'remove' } }), 400)
  await rejectsStatus(confirmCustomerMerge(db, 'admin', { ...body, choices: { ...body.choices, name: ['keep'] } }), 400)
  await rejectsStatus(confirmCustomerMerge(db, 'admin', { ...body, name: '공격' }), 400)
  await rejectsStatus(confirmCustomerMerge(db, 'admin', { ...body, confirmed: false }), 400)
  await rejectsStatus(confirmCustomerMerge(db, 'admin', { ...body, previewToken: 'invalid' }), 409)
  await rejectsStatus(previewCustomerMerge(db, 'admin', 'keep', 'keep'), 400)
  await rejectsStatus(previewCustomerMerge(db, 'admin', 'keep', 'missing'), 409)
  for (const phone of [null, '0212345678', '01099998888']) {
    await db.customer.update({ where: { id: 'remove' }, data: { phone } })
    await rejectsStatus(previewCustomerMerge(db, 'admin', 'keep', 'remove'), 409)
  }
  assert.equal(await db.customer.count(), 2)
})

test('invalid serialized arrays refuse preview/confirm without erasing either original', async () => {
  for (const key of ['tags', 'contactsJson', 'documentsJson', 'vehicleListJson']) {
    for (const bad of ['{', '{}', 'null', '"text"', '   ']) {
      const b = await confirmation()
      await db.customer.update({ where: { id: 'remove' }, data: { [key]: bad } })
      await rejectsStatus(previewCustomerMerge(db, 'admin', 'keep', 'remove'), 409)
      await rejectsStatus(confirmCustomerMerge(db, 'admin', b), 409)
      assert.equal((await db.customer.findUniqueOrThrow({ where: { id: 'remove' } }))[key as 'tags'], bad)
      await db.customer.update({ where: { id: 'remove' }, data: { [key]: null } })
    }
  }
  assert.equal(await db.customerMerge.count(), 0)
})

test('stale preview detects same-count edits and added dependencies including uploads, meetings and histories', async () => {
  await relations()
  const edits = [
    () => db.customer.update({ where: { id: 'keep' }, data: { documentsJson: '[{"path":"/new.pdf"}]' } }),
    () => db.customer.update({ where: { id: 'remove' }, data: { contactsJson: '[{"id":"new"}]' } }),
    () => db.salesDeal.update({ where: { id: 'deal' }, data: { totalPrice: 9876 } }),
    () => db.customerActivity.update({ where: { id: 'receipt' }, data: { content: '수정' } }),
    () => db.agent.update({ where: { id: 'agent' }, data: { memo: '변경' } }),
    () => db.buildupEvent.update({ where: { id: 'event' }, data: { payloadJson: '{"changed":true}' } }),
    () => db.leadMeeting.update({ where: { id: 'meeting' }, data: { filesJson: '[{"path":"/new-meeting.pdf"}]' } }),
    () => db.stageHistory.update({ where: { id: 'history' }, data: { toStageCode: '4-1' } }),
    () => db.dealDocument.update({ where: { id: 'document' }, data: { filePath: '/new-contract.pdf' } }),
    () => db.dealShare.update({ where: { id: 'share' }, data: { targetUser: '담당B' } }),
    () => db.customerActivity.create({ data: { customerId: 'keep', type: '이벤트', date: new Date() } }),
  ]
  for (const edit of edits) {
    const body = await confirmation()
    await edit()
    await rejectsStatus(confirmCustomerMerge(db, 'admin', body), 409)
  }
  assert.equal(await db.customerMerge.count(), 0)
  assert.equal(await db.customer.count(), 2)
})

test('injected failure after archive and relinks rolls the entire merge back', async () => {
  await relations()
  const before = await db.customer.findMany({ orderBy: { id: 'asc' } })
  await db.$executeRawUnsafe(`CREATE TRIGGER reject_test_merge BEFORE DELETE ON Customer WHEN OLD.id = 'remove' BEGIN SELECT RAISE(ABORT, 'injected_failure'); END`)
  await assert.rejects(confirmCustomerMerge(db, 'admin', await confirmation()))
  assert.deepEqual(await db.customer.findMany({ orderBy: { id: 'asc' } }), before)
  assert.equal(await db.customerMerge.count(), 0)
  assert.equal((await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })).customerId, 'remove')
  assert.equal((await db.customerActivity.findUniqueOrThrow({ where: { id: 'receipt' } })).customerId, 'remove')
  assert.equal((await db.agent.findUniqueOrThrow({ where: { id: 'agent' } })).customerId, 'remove')
  assert.equal((await db.buildupEvent.findUniqueOrThrow({ where: { id: 'event' } })).warpCustomerId, 'remove')
})

test('idempotent replay, alias chains, immutable source IDs and canonical deletion guards', async () => {
  const body = await confirmation()
  await confirmCustomerMerge(db, 'admin', body)
  await confirmCustomerMerge(db, 'admin', body)
  assert.equal(await db.customerMerge.count(), 1)
  await rejectsStatus(confirmCustomerMerge(db, 'admin', { ...body, choices: { ...body.choices, name: 'remove' } }), 409)
  await rejectsStatus(requireCurrentCustomerId(db, 'remove'), 409)
  await assert.rejects(db.customer.delete({ where: { id: 'keep' } }))
  await assert.rejects(db.customer.create({ data: { id: 'remove', name: '재사용' } }))
  await db.customer.create({ data: { id: 'last', name: '최종', phone: '01012345678' } })
  await confirmCustomerMerge(db, 'admin', await confirmation('last', 'keep'))
  assert.equal(await resolveCustomerId(db, 'remove'), 'last')
  assert.equal((await confirmCustomerMerge(db, 'admin', body)).customerId, 'last')
  await assert.rejects(db.customer.delete({ where: { id: 'last' } }))
})

test('existing marketing sourceId replay keeps activity ID and returns retained customer', async () => {
  const payload = { source: 'mleverage-admin', companyScopeId: '55f9a8bb-73f9-4316-bcd7-7dcdce0bdcc3',
    homepageScopeId: '5c7a6115-a0a9-4e8d-bf65-efce52195fa4', sourceId: '00000000-0000-4000-8000-000000000001',
    inquiryDate: '2026-09-15', inquiryTime: '09:07', sourceStatus: '상담대기', name: '신규문의', phone: '010-1234-5678' }
  const key = 'private-test-key-at-least-32-characters'
  const send = () => handleMarketingInquiryRequest(new Request('https://warp.test/api/external/marketing-inquiries', {
    method: 'POST', headers: { 'x-api-key': key }, body: JSON.stringify(payload),
  }), db, { WARP_MARKETING_API_KEY: key })
  // Temporarily use an unrelated phone for the survivor so the initial receipt has one match.
  await db.customer.update({ where: { id: 'keep' }, data: { phone: '01099998888' } })
  await db.customer.update({ where: { id: 'remove' }, data: { phone: '01012345678' } })
  const first = await (await send()).json()
  assert.equal(first.customerId, 'remove')
  await db.customer.update({ where: { id: 'keep' }, data: { phone: '01012345678' } })
  await confirmCustomerMerge(db, 'admin', await confirmation())
  const replay = await (await send()).json()
  assert.equal(replay.activityId, first.activityId)
  assert.equal(replay.customerId, 'keep'); assert.equal(replay.duplicate, true)
  assert.equal(await db.customerActivity.count(), 1)
})

test('separate SQLite clients serialize identical confirmations and reject competing/stale writes', async () => {
  const other = connect()
  const body = await confirmation()
  const results = await Promise.all([confirmCustomerMerge(db, 'admin', body), confirmCustomerMerge(other, 'admin', body)])
  assert.deepEqual(results[0], results[1])
  assert.equal(await db.customerMerge.count(), 1)
  await db.customer.create({ data: { id: 'third', name: '세번째', phone: '01012345678' } })
  const next = await confirmation('keep', 'third')
  let release!: () => void
  let ready!: () => void
  const started = new Promise<void>(resolve => { ready = resolve })
  const gate = new Promise<void>(resolve => { release = resolve })
  const concurrentUpload = customerWrite(other, async tx => {
    await tx.customer.update({ where: { id: 'keep' }, data: { documentsJson: '[{"path":"/concurrent.pdf"}]' } })
    ready(); await gate
  })
  await started
  const waiting = confirmCustomerMerge(db, 'admin', next)
  setTimeout(release, 50)
  await concurrentUpload
  await rejectsStatus(waiting, 409)
  assert.equal(await db.customer.count(), 2)
})

test('HTTP boundaries enforce same origin, bounded JSON, current authorization and opaque Korean failures', async () => {
  const url = 'https://warp.test/api/migrate/merge-customers'
  const body = await confirmation()
  const request = (payload: string, extra: Record<string, string> = {}) => new Request(url, { method: 'POST',
    headers: { origin: 'https://warp.test', 'content-type': 'application/json', ...extra }, body: payload })
  for (const [req, status] of [
    [request(JSON.stringify(body), { origin: 'https://evil.test' }), 403],
    [request(JSON.stringify(body), { origin: '' }), 403],
    [request(JSON.stringify(body), { 'content-type': 'text/plain' }), 415],
    [request('x'.repeat(17000)), 413], [request('{'), 400],
    [request(JSON.stringify({ ...body, previewToken: '' })), 409],
  ] as const) {
    const response = await handleCustomerMergeRequest(req, db, 'admin', {})
    assert.equal(response.status, status)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const message = await response.json()
    assert.ok(message.error.length < 120)
  }
  assert.equal((await handleCustomerMergeRequest(request(JSON.stringify(body)), db, undefined, {})).status, 401)
  await db.$executeRawUnsafe(`CREATE TRIGGER http_fail BEFORE DELETE ON Customer BEGIN SELECT RAISE(ABORT, 'secret-diagnostic'); END`)
  const error = await handleCustomerMergeRequest(request(JSON.stringify(body)), db, 'admin', {})
  assert.equal(error.status, 503)
  assert.doesNotMatch(await error.text(), /secret-diagnostic|INSERT|DELETE|Prisma|김보존/)
})


test('HTTP public-origin configuration supports reverse proxies and fails closed for invalid config or forwarded host spoofing', async () => {
  const body = await confirmation()
  const request = (origin: string) => new Request('http://localhost:3000/api/migrate/merge-customers', {
    method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-forwarded-host': 'evil.test', 'x-forwarded-proto': 'https' },
    body: JSON.stringify(body),
  })
  assert.equal((await handleCustomerMergeRequest(request('https://evil.test'), db, 'admin', { AUTH_URL: 'https://warp.test' })).status, 403)
  assert.equal((await handleCustomerMergeRequest(request('https://warp.test'), db, 'admin', { AUTH_URL: 'broken' })).status, 503)
  assert.equal((await handleCustomerMergeRequest(request('https://warp.test'), db, 'admin', { AUTH_URL: '' })).status, 503)
  assert.equal((await handleCustomerMergeRequest(request('https://warp.test'), db, 'admin', { AUTH_URL: 'ftp://warp.test' })).status, 503)
  assert.equal((await handleCustomerMergeRequest(request('https://warp.test'), db, 'admin', { NEXTAUTH_URL: 'https://warp.test' })).status, 200)
  assert.equal((await handleCustomerMergeRequest(request('https://warp.test'), db, 'admin', { AUTH_URL: 'https://warp.test', NEXTAUTH_URL: 'https://old.test' })).status, 200)
})
