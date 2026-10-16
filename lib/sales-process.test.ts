import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createClient } from '@libsql/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@/app/generated/prisma/client'
import { customerWrite, CustomerMergeError } from './customer-alias'
import {
  depositError,
  depositQueue,
  emptySalesProcess,
  isGateComplete,
  koreaToday,
  quoteError,
  readSalesProcess,
  readInquiryStatus,
  transitionError,
  validDate,
  type QueueDeal,
  type SalesProcessData,
} from './sales-process'
import { parseChecks, parseProcessInput, prepareSalesProcessWrite } from './sales-process-write'
import { deleteProcessAuditRequest, processAuditAdmin } from './sales-process-audit'

function validProcess(): SalesProcessData {
  return {
    inquiryStatus: '상담 대기',
    callbackAt: '',
    finalQuote: {
      date: '2020-01-02',
      model: 'PV5',
      spec: '냉동 하이탑',
      amountWon: 45000000,
      documentId: 'quote-document',
    },
    deposit: {
      status: 'paid',
      amountWon: 100000,
      date: '2020-01-03',
      time: '09:30',
      model: 'PV5',
      spec: '냉동 하이탑',
      documentId: 'deposit-document',
      reviewPending: false,
    },
  }
}

const initialQuotation = [{ docKey: 'initial_quotation', fileSize: 10 }]

function tomorrowInKorea() {
  const date = new Date(`${koreaToday()}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function queueDeal(id: string, process: SalesProcessData, overrides: Partial<QueueDeal> = {}): QueueDeal {
  return {
    id,
    stageCode: '2-1',
    salesStatus: '진행중',
    salesProcessJson: JSON.stringify(process),
    customerSegment: 'B2C',
    ...overrides,
  }
}

test('inquiry defaults and old screens use consultation waiting without losing prior callback or quote facts', () => {
  assert.equal(emptySalesProcess().inquiryStatus, '상담 대기')
  assert.equal(readSalesProcess(null).inquiryStatus, '상담 대기')
  const legacy = { ...validProcess(), inquiryStatus: '신규 문의' as const, callbackAt: '2026-01-05T10:30' }
  const expected = { ...legacy, inquiryStatus: '상담 대기' }
  assert.deepEqual(readSalesProcess(JSON.stringify(legacy)), expected)
  assert.deepEqual(parseProcessInput(legacy), expected)
  assert.equal(readSalesProcess(JSON.stringify({ ...legacy, inquiryStatus: '부재중 대기' })).inquiryStatus, '부재중 대기')
  assert.throws(() => parseProcessInput({ ...legacy, inquiryStatus: '알 수 없음' }), /상담 대기 상태/)
})

test('list inquiry status requires the actual call checkpoint, including legacy and malformed records', () => {
  const json = JSON.stringify({ ...emptySalesProcess(), inquiryStatus: '부재중 대기' })
  assert.equal(readInquiryStatus(json, '{}'), '부재중 대기')
  for (const complete of [true, '2020-01-02T03:04:05.006Z']) {
    assert.equal(readInquiryStatus(json, JSON.stringify({ '1-1-call': complete })), '첫 상담 완료')
  }
  assert.equal(readInquiryStatus(null, '{"1-1-0":true}'), '상담 대기')
  assert.equal(readInquiryStatus(json, '{"1-1-call":"false"}'), '부재중 대기')
  assert.equal(readInquiryStatus(json, 'malformed'), '부재중 대기')
  assert.equal(readInquiryStatus(JSON.stringify({ inquiryStatus: '첫 상담 완료' }), '{}'), '상담 대기')
})

test('all three B2C gates are required and legacy supporting checks do not satisfy them', () => {
  const process = validProcess()
  const all = { '1-1-call': true, '1-2-2': true, '1-2-4': true, '1-3-confirmed': true }

  assert.equal(transitionError('B2C', '1-1', '2-1', all, process, initialQuotation), null)
  for (const [key, label] of [
    ['1-1-call', '전화통화 완료'],
    ['1-2-2', '구매의사 확인'],
    ['1-2-4', '1차 견적서 발송 완료'],
    ['1-3-confirmed', '최종 견적서 확정'],
  ] as const) {
    assert.match(transitionError('B2C', '1-1', '2-1', { ...all, [key]: false }, process, initialQuotation)!, new RegExp(label))
  }

  assert.match(transitionError('B2C', '1-1', '1-2', { '1-1-0': true }, process)!, /전화통화 완료/)
  assert.match(transitionError('B2C', '1-3', '2-1', { '1-3-2': true }, process)!, /최종 견적서 확정/)
})

test('gate completion accepts legacy booleans and exact past ISO timestamps but rejects malformed gate strings', () => {
  const completedAt = '2020-01-02T03:04:05.006Z'
  assert.equal(isGateComplete(true), true)
  assert.equal(isGateComplete(false), false)
  assert.equal(isGateComplete(completedAt), true)
  assert.deepEqual(parseChecks(JSON.stringify({
    '1-1-call': true,
    '1-2-2': false,
    '1-2-4': completedAt,
    '1-3-7': '캐피탈',
  })), {
    '1-1-call': true,
    '1-2-2': false,
    '1-2-4': completedAt,
    '1-3-7': '캐피탈',
  })

  for (const value of [
    'false',
    'true',
    '2020-01-02',
    '2020-01-02T03:04:05Z',
    '2020-02-30T03:04:05.006Z',
  ]) {
    assert.equal(isGateComplete(value), false)
    assert.match(transitionError('B2C', '1-1', '1-2', { '1-1-call': value }, validProcess())!, /전화통화 완료/)
  }
})

test('forward skips enforce every crossed gate and paid-deposit facts while same-stage and B2B remain unaffected', () => {
  const process = validProcess()
  const all = { '1-1-call': true, '1-2-2': true, '1-2-4': true, '1-3-confirmed': true }

  assert.match(transitionError('B2C', '1-1', '2-2', {}, process)!, /전화통화 완료/)
  assert.match(transitionError('B2C', '1-1', '2-2', { ...all, '1-2-4': false }, process)!, /1차 견적서 발송 완료/)
  assert.match(transitionError('B2C', '1-1', '2-2', all, {
    ...process,
    deposit: { ...process.deposit, status: 'refunded' },
  }, initialQuotation)!, /계약금 입금/)
  assert.equal(transitionError('B2C', '1-1', '2-2', all, process, initialQuotation), null)
  assert.equal(transitionError('B2C', '1-3', '1-3', {}, emptySalesProcess()), null)
  assert.equal(transitionError('B2B', '1-1', '3-1', {}, emptySalesProcess()), null)
})

test('potential lead transitions require a nonempty initial quotation, including skipped stages', () => {
  const checks = { '1-1-call': true, '1-2-2': true, '1-2-4': true, '1-2-quote': true }
  for (const documents of [[], [{ docKey: 'quotation', fileSize: 10 }], [{ docKey: 'initial_quotation', fileSize: 0 }]]) {
    assert.match(transitionError('B2C', '1-2', '1-3', checks, emptySalesProcess(), documents)!, /1차 견적서를 업로드/)
    assert.match(transitionError('B2C', '1-1', '2-1', checks, emptySalesProcess(), documents)!, /1차 견적서를 업로드/)
  }
  assert.equal(transitionError('B2C', '1-2', '1-3', checks, emptySalesProcess(), initialQuotation), null)
  assert.equal(transitionError('B2C', '1-2', '1-2', checks, emptySalesProcess()), null)
  assert.equal(transitionError('B2C', '1-2', '1-1', checks, emptySalesProcess()), null)
  assert.equal(transitionError('B2C', '1-3', '1-2', checks, emptySalesProcess()), null)
  assert.equal(transitionError('B2B', '1-2', '1-3', {}, emptySalesProcess()), null)
})

test('dates reject malformed calendar values and future facts without inventing a default', () => {
  assert.equal(validDate('2024-02-29'), true)
  for (const value of ['', '2023-02-29', '2026-13-01', '2026-01-32', '26-01-01']) {
    assert.equal(validDate(value), false)
  }

  const process = validProcess()
  assert.equal(quoteError(process), null)
  assert.equal(depositError(process), null)
  assert.match(quoteError({ ...process, finalQuote: { ...process.finalQuote, date: tomorrowInKorea() } })!, /확정일/)
  assert.match(depositError({ ...process, deposit: { ...process.deposit, date: tomorrowInKorea() } })!, /입금일 확인 필요/)
  assert.throws(() => parseProcessInput({
    ...process,
    finalQuote: { ...process.finalQuote, date: '2026-02-30' },
  }), /실제 확인 날짜/)
  assert.throws(() => parseProcessInput({
    ...process,
    deposit: { ...process.deposit, date: tomorrowInKorea() },
  }), /미래 날짜/)
})

test('queue normalizes the same model/spec, refuses missing-time and exact-time ties, and keeps groups independent', () => {
  const first = validProcess()
  const later = { ...validProcess(), deposit: { ...validProcess().deposit, date: '2020-01-04', time: '08:00', model: ' pv5 ', spec: '냉동   하이탑' } }
  const independent = { ...validProcess(), deposit: { ...validProcess().deposit, model: 'PV5 롱', spec: '상온' } }
  let result = depositQueue([
    queueDeal('first', first),
    queueDeal('later', later),
    queueDeal('independent', independent),
  ])
  assert.equal(result.get('first')?.position, 1)
  assert.equal(result.get('later')?.position, 2)
  assert.equal(result.get('independent')?.position, 1)

  const missingTime = { ...validProcess(), deposit: { ...validProcess().deposit, time: '' } }
  result = depositQueue([queueDeal('timed', validProcess()), queueDeal('missing-time', missingTime)])
  for (const id of ['timed', 'missing-time']) {
    assert.deepEqual(result.get(id), { position: null, message: '같은 날 입금한 건의 입금시각·순서 확인 필요' })
  }

  result = depositQueue([queueDeal('tie-a', validProcess()), queueDeal('tie-b', validProcess())])
  assert.equal(result.get('tie-a')?.position, null)
  assert.equal(result.get('tie-b')?.position, null)
})

test('queue excludes nonstandard amounts, refunds, holds, delivered records, and B2B records', () => {
  const amount = { ...validProcess(), deposit: { ...validProcess().deposit, amountWon: 200000 } }
  const refund = { ...validProcess(), deposit: { ...validProcess().deposit, status: 'refunded' as const } }
  const result = depositQueue([
    queueDeal('amount', amount),
    queueDeal('refund', refund),
    queueDeal('hold', validProcess(), { salesStatus: '판매보류' }),
    queueDeal('delivered', validProcess(), { deliveredAt: new Date('2020-02-01T00:00:00Z') }),
    queueDeal('b2b', validProcess(), { customerSegment: 'B2B' }),
  ])

  for (const id of ['amount', 'refund', 'hold', 'delivered', 'b2b']) assert.equal(result.get(id)?.position, null)
  assert.match(result.get('amount')!.message, /10만원과 다릅니다/)
  assert.match(result.get('refund')!.message, /계약금 입금/)
  assert.equal(result.get('hold')!.message, '출고 대기 대상이 아닙니다.')
  assert.equal(result.get('delivered')!.message, '출고 대기 대상이 아닙니다.')
  assert.equal(result.get('b2b')!.message, 'B2B는 기존 절차를 사용합니다.')
})

// Every Prisma client below points at a private temporary SQLite file; lib/db and runtime env are never imported.
const directory = mkdtempSync(path.join(tmpdir(), 'warp-sales-process-'))
const schema = path.resolve('prisma/schema.prisma')
const config = path.join(directory, 'prisma.config.ts')
writeFileSync(config, `export default ${JSON.stringify({ schema, datasource: { url: `file:${directory}/unused.db` } })}`)
const ddl = execFileSync(process.execPath, [
  path.resolve('node_modules/prisma/build/index.js'),
  'migrate', 'diff', '--from-empty', '--to-schema', schema, '--script', '--config', config,
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

let db: PrismaClient
let sequence = 0
const owner = { id: 'owner-id', name: '담당자' }

test.beforeEach(async () => {
  const url = `file:${path.join(directory, `${sequence++}.db`)}`
  const sqlite = createClient({ url })
  await sqlite.executeMultiple(ddl)
  sqlite.close()
  db = new PrismaClient({ adapter: new PrismaLibSql({ url }) })
})

test.afterEach(async () => { await db.$disconnect() })
test.after(() => rmSync(directory, { recursive: true, force: true }))

async function createDeal(options: {
  id?: string
  stageCode?: string
  segment?: string
  assignee?: string
  process?: SalesProcessData | null
  revision?: number
  checklist?: Record<string, boolean | string> | null
} = {}) {
  return db.salesDeal.create({
    data: {
      id: options.id ?? 'deal',
      name: '합성 테스트 리드',
      stage: '리드',
      stageCode: options.stageCode ?? '1-1',
      customerSegment: options.segment ?? 'B2C',
      assignee: options.assignee ?? owner.name,
      salesProcessJson: options.process === undefined || options.process === null ? null : JSON.stringify(options.process),
      salesProcessRevision: options.revision ?? 0,
      checklistJson: options.checklist ? JSON.stringify(options.checklist) : null,
    },
  })
}

async function createDocument(dealId: string, id: string, docKey: string) {
  await db.dealDocument.create({
    data: {
      id,
      dealId,
      stageCode: docKey === 'evn_deposit_slip' ? '2-1' : '1-3',
      docKey,
      docLabel: docKey,
      fileName: `${id}.pdf`,
      storedName: `${id}.pdf`,
      filePath: `/synthetic/${id}.pdf`,
      fileSize: 10,
      mimeType: 'application/pdf',
    },
  })
}

async function writeProcess(body: Record<string, unknown>, actor = owner, isAdmin = false) {
  return customerWrite(db, async tx => {
    const prepared = await prepareSalesProcessWrite(tx, 'deal', body, actor, isAdmin)
    return tx.salesDeal.update({
      where: { id: 'deal' },
      data: {
        ...prepared.data,
        ...(body.stageCode !== undefined && { stageCode: String(body.stageCode) }),
        ...(body.checklistJson !== undefined && { checklistJson: String(body.checklistJson) }),
      },
    })
  })
}

async function rejectsStatus(work: Promise<unknown>, status: number, message: RegExp) {
  await assert.rejects(work, (error: unknown) => {
    assert.ok(error instanceof CustomerMergeError)
    assert.equal(error.status, status)
    assert.match(error.message, message)
    return true
  })
}

test('legacy same-stage saves do not backfill process JSON, increment revision, or create audit', async () => {
  await createDeal()
  const before = await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })
  await writeProcess({ stageCode: '1-1', salesProcessRevision: 0 })
  const after = await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })

  assert.equal(before.salesProcessJson, null)
  assert.equal(after.salesProcessJson, null)
  assert.equal(after.salesProcessRevision, 0)
  assert.equal(after.stageCode, '1-1')
  assert.equal(await db.salesProcessAudit.count(), 0)
  assert.deepEqual(readSalesProcess(after.salesProcessJson), emptySalesProcess())
})

test('list stage rollback needs a revision and persists without clearing existing lead evidence', async () => {
  const process = validProcess()
  const checks = { '1-1-0': true, '1-2-4': '2020-01-02T03:04:05.006Z', '1-2-note': '기존 상담 기록' }
  await createDeal({ stageCode: '1-2', process, checklist: checks, revision: 7 })
  await createDocument('deal', 'quote-document', 'quotation')
  await createDocument('deal', 'deposit-document', 'evn_deposit_slip')
  const before = await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })

  // Reproduce the old list payload: the server correctly refuses a missing revision.
  await rejectsStatus(writeProcess({ stageCode: '1-1' }), 409, /새로고침/)
  assert.equal((await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })).stageCode, '1-2')
  assert.equal(await db.salesProcessAudit.count(), 0)

  await writeProcess({ stageCode: '1-1', salesProcessRevision: before.salesProcessRevision })
  const reloaded = await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })
  assert.equal(reloaded.stageCode, '1-1')
  assert.equal(reloaded.salesProcessRevision, 8)
  assert.equal(reloaded.salesProcessJson, before.salesProcessJson)
  assert.equal(reloaded.checklistJson, before.checklistJson)
  assert.equal(await db.dealDocument.count(), 2)
  const audit = await db.salesProcessAudit.findFirstOrThrow()
  assert.equal(JSON.parse(audit.beforeJson).stage, '1-2')
  assert.equal(JSON.parse(audit.afterJson).stage, '1-1')
  await rejectsStatus(writeProcess({ stageCode: '1-2', salesProcessRevision: 7 }), 409, /새로고침/)
  await rejectsStatus(writeProcess({ stageCode: '1-2', salesProcessRevision: 8 }), 400, /전화통화 완료/)
  assert.equal((await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })).stageCode, '1-1')
})

test('repeated list changes use each saved revision and keep completed call evidence', async () => {
  await createDeal({ stageCode: '1-2', checklist: { '1-1-call': true } })
  const backward = await writeProcess({ stageCode: '1-1', salesProcessRevision: 0 })
  assert.equal(readInquiryStatus(backward.salesProcessJson, backward.checklistJson), '첫 상담 완료')
  const forward = await writeProcess({ stageCode: '1-2', salesProcessRevision: backward.salesProcessRevision })
  await writeProcess({ stageCode: '1-1', salesProcessRevision: forward.salesProcessRevision })
  const reloaded = await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })
  assert.equal(reloaded.stageCode, '1-1')
  assert.equal(reloaded.salesProcessRevision, 3)
  assert.equal(await db.salesProcessAudit.count(), 3)
  assert.deepEqual(parseChecks(reloaded.checklistJson), { '1-1-call': true })
})

test('saved potential transitions trust only this lead uploaded quotation and retain its evidence', async () => {
  const checks = { '1-2-2': true, '1-2-4': '2020-01-02T03:04:05.006Z', '1-2-1': false, '1-2-note': '기존 기록' }
  await createDeal({ stageCode: '1-2', checklist: checks })
  await createDeal({ id: 'other-deal' })
  await createDocument('other-deal', 'foreign-initial', 'initial_quotation')
  await createDocument('deal', 'wrong-kind', 'final_quotation')
  const body = { stageCode: '1-3', salesProcessRevision: 0, documents: initialQuotation, '1-2-quote': true }
  await rejectsStatus(writeProcess(body), 400, /1차 견적서를 업로드/)
  await createDocument('deal', 'own-initial', 'initial_quotation')
  await db.dealDocument.update({ where: { id: 'own-initial' }, data: { fileSize: 0 } })
  await rejectsStatus(writeProcess(body), 400, /1차 견적서를 업로드/)
  assert.equal(await db.salesProcessAudit.count(), 0)
  assert.equal((await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })).stageCode, '1-2')
  await db.dealDocument.update({ where: { id: 'own-initial' }, data: { fileSize: 10 } })
  await writeProcess(body)
  const saved = await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })
  assert.equal(saved.stageCode, '1-3')
  assert.deepEqual(parseChecks(saved.checklistJson), checks)
  const audit = await db.salesProcessAudit.findFirstOrThrow()
  assert.deepEqual(JSON.parse(audit.afterJson).initialQuotationIds, ['own-initial'])
})

test('transaction commits the process, revision, and immutable audit evidence together', async () => {
  await createDeal()
  const process = { ...emptySalesProcess(), inquiryStatus: '상담 대기' as const, callbackAt: '2026-01-05T10:30' }
  const saved = await writeProcess({ salesProcess: process, salesProcessRevision: 0, salesProcessReason: '최초 상담 기록' })

  assert.equal(saved.salesProcessRevision, 1)
  assert.deepEqual(readSalesProcess(saved.salesProcessJson), process)
  const audits = await db.salesProcessAudit.findMany()
  assert.equal(audits.length, 1)
  assert.equal(audits[0].actorId, owner.id)
  assert.equal(audits[0].actorName, owner.name)
  assert.equal(audits[0].reason, '최초 상담 기록')
  assert.equal(JSON.parse(audits[0].beforeJson).stage, '1-1')
  assert.equal(JSON.parse(audits[0].afterJson).process.inquiryStatus, '상담 대기')
})

test('stale revisions and unauthorized assignments fail without process or audit writes', async () => {
  await createDeal()
  const process = { ...emptySalesProcess(), inquiryStatus: '부재중 대기' as const }

  await rejectsStatus(writeProcess({ salesProcess: process, salesProcessRevision: 9 }), 409, /새로고침/)
  await rejectsStatus(writeProcess({ salesProcess: process, salesProcessRevision: 0 }, { id: 'other', name: '다른 담당자' }), 403, /담당 리드/)
  const stored = await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })
  assert.equal(stored.salesProcessJson, null)
  assert.equal(stored.salesProcessRevision, 0)
  assert.equal(await db.salesProcessAudit.count(), 0)
})

test('inquiry state can change without a correction reason while retaining a hidden callback', async () => {
  const old = { ...emptySalesProcess(), inquiryStatus: '신규 문의' as const, callbackAt: '2026-01-05T10:30' }
  await createDeal({ process: old })
  const process = { ...readSalesProcess(JSON.stringify(old)), inquiryStatus: '부재중 대기' as const }
  const saved = await writeProcess({ salesProcess: process, salesProcessRevision: 0 })
  assert.equal(saved.salesProcessRevision, 1)
  assert.deepEqual(readSalesProcess(saved.salesProcessJson), process)
  assert.equal((await db.salesProcessAudit.findFirstOrThrow()).reason, '영업 절차 확인')
})

test('call check and inquiry status persist in one audited revision and unchecking resets consultation waiting', async () => {
  await createDeal({ process: { ...emptySalesProcess(), inquiryStatus: '부재중 대기' } })
  const saved = await writeProcess({ checklistJson: JSON.stringify({ '1-1-call': true }), salesProcessRevision: 0 })
  assert.equal(readSalesProcess(saved.salesProcessJson).inquiryStatus, '첫 상담 완료')
  assert.equal(saved.stageCode, '1-1')
  assert.equal(saved.salesProcessRevision, 1)
  const audit = await db.salesProcessAudit.findFirstOrThrow()
  assert.equal(JSON.parse(audit.afterJson).process.inquiryStatus, '첫 상담 완료')
  assert.equal(JSON.parse(audit.afterJson).checks['1-1-call'], true)
  const reset = await writeProcess({ checklistJson: '{}', salesProcessRevision: 1 })
  assert.equal(readSalesProcess(reset.salesProcessJson).inquiryStatus, '상담 대기')
  assert.equal(reset.salesProcessRevision, 2)
  assert.equal(await db.salesProcessAudit.count(), 2)
})

test('a submitted completion label cannot replace the call checkpoint or override its checked state', async () => {
  await createDeal()
  const spoofed = { ...emptySalesProcess(), inquiryStatus: '첫 상담 완료' as const }
  const unchanged = await writeProcess({ salesProcess: spoofed, salesProcessRevision: 0 })
  assert.equal(readSalesProcess(unchanged.salesProcessJson).inquiryStatus, '상담 대기')
  const checked = await writeProcess({ salesProcess: emptySalesProcess(), checklistJson: '{"1-1-call":true}', salesProcessRevision: unchanged.salesProcessRevision })
  assert.equal(readSalesProcess(checked.salesProcessJson).inquiryStatus, '첫 상담 완료')
  await rejectsStatus(writeProcess({ checklistJson: '{}', salesProcessRevision: 0 }), 409, /새로고침/)
  assert.equal(readSalesProcess((await db.salesDeal.findUniqueOrThrow({where:{id:'deal'}})).salesProcessJson).inquiryStatus, '첫 상담 완료')
})

test('foreign or wrong-family documents are rejected without audit writes', async () => {
  await createDeal()
  await createDeal({ id: 'other-deal' })
  await createDocument('other-deal', 'foreign-quote', 'quotation')
  await createDocument('deal', 'wrong-deposit', 'quotation')

  const foreign = validProcess()
  foreign.finalQuote.documentId = 'foreign-quote'
  foreign.deposit.documentId = ''
  await rejectsStatus(writeProcess({ salesProcess: foreign, salesProcessRevision: 0 }), 400, /이 리드에 저장된/)

  const wrongFamily = validProcess()
  wrongFamily.finalQuote.documentId = ''
  wrongFamily.deposit.documentId = 'wrong-deposit'
  await rejectsStatus(writeProcess({ salesProcess: wrongFamily, salesProcessRevision: 0 }), 400, /이 리드에 저장된/)
  assert.equal(await db.salesProcessAudit.count(), 0)
})

test('first quote and first deposit after an inquiry-only save do not require a correction reason', async () => {
  const inquiryOnly = { ...emptySalesProcess(), inquiryStatus: '상담 대기' as const }
  await createDeal({ process: inquiryOnly })
  await createDocument('deal', 'quote-document', 'quotation')
  await createDocument('deal', 'deposit-document', 'evn_deposit_slip')

  const firstQuote = {
    ...inquiryOnly,
    finalQuote: { ...validProcess().finalQuote },
  }
  const quoted = await writeProcess({ salesProcess: firstQuote, salesProcessRevision: 0 })
  assert.equal(quoted.salesProcessRevision, 1)
  assert.deepEqual(readSalesProcess(quoted.salesProcessJson).finalQuote, firstQuote.finalQuote)

  const firstDeposit = {
    ...firstQuote,
    deposit: { ...validProcess().deposit, reviewPending: false },
  }
  const deposited = await writeProcess({ salesProcess: firstDeposit, salesProcessRevision: 1 })
  const saved = readSalesProcess(deposited.salesProcessJson)
  assert.equal(deposited.salesProcessRevision, 2)
  assert.deepEqual(saved.deposit, firstDeposit.deposit)
  assert.equal(saved.deposit.reviewPending, false)
  assert.equal(await db.salesProcessAudit.count(), 2)
})

test('corrections to an existing quote or deposit section require a reason', async () => {
  const previous = emptySalesProcess()
  previous.finalQuote.model = '기존 모델'
  await createDeal({ process: previous })
  const changed = { ...previous, finalQuote: { ...previous.finalQuote, model: 'PV5' } }

  await rejectsStatus(writeProcess({ salesProcess: changed, salesProcessRevision: 0 }), 400, /수정 사유/)
  const stored = await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })
  assert.equal(stored.salesProcessJson, JSON.stringify(previous))
  assert.equal(stored.salesProcessRevision, 0)
  assert.equal(await db.salesProcessAudit.count(), 0)
})

test('editing paid deposit facts forces reviewPending and records the correction', async () => {
  const previous = validProcess()
  previous.finalQuote.documentId = ''
  await createDeal({ stageCode: '2-1', process: previous })
  await createDocument('deal', 'deposit-document', 'evn_deposit_slip')
  const changed = { ...previous, deposit: { ...previous.deposit, spec: '냉동 저상', reviewPending: false } }

  const saved = await writeProcess({ salesProcess: changed, salesProcessRevision: 0, salesProcessReason: '고객 확정 사양 정정' })
  const process = readSalesProcess(saved.salesProcessJson)
  assert.equal(process.deposit.spec, '냉동 저상')
  assert.equal(process.deposit.reviewPending, true)
  assert.equal(saved.salesProcessRevision, 1)
  assert.equal((await db.salesProcessAudit.findFirstOrThrow()).reason, '고객 확정 사양 정정')
})

test('a failure after prepareSalesProcessWrite rolls back its audit and leaves legacy data untouched', async () => {
  await createDeal()
  const process = { ...emptySalesProcess(), inquiryStatus: '부재중 대기' as const }

  await assert.rejects(customerWrite(db, async tx => {
    await prepareSalesProcessWrite(tx, 'deal', { salesProcess: process, salesProcessRevision: 0 }, owner, false)
    throw new Error('synthetic update failure')
  }), /synthetic update failure/)

  const stored = await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })
  assert.equal(stored.salesProcessJson, null)
  assert.equal(stored.salesProcessRevision, 0)
  assert.equal(await db.salesProcessAudit.count(), 0)
})

test('B2B writes retain their legacy process boundary without audits or revision changes', async () => {
  await createDeal({ segment: 'B2B' })
  await writeProcess({ stageCode: '2-1', salesProcessRevision: 0 })
  const stored = await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })

  assert.equal(stored.stageCode, '2-1')
  assert.equal(stored.salesProcessJson, null)
  assert.equal(stored.salesProcessRevision, 0)
  assert.equal(await db.salesProcessAudit.count(), 0)
  await rejectsStatus(writeProcess({ salesProcess: emptySalesProcess(), salesProcessRevision: 0 }), 400, /B2B는 기존 절차/)
})

function deletionRequest(origin = 'https://warp.test') {
  return new Request('http://internal:3000/api/deals/deal/process-audit/audit', {
    method: 'DELETE', headers: { origin },
  })
}
const deletionEnv = { AUTH_URL: 'https://warp.test' }

test('history deletion requires a current admin role, not login, ownership or executive-team viewing access', async () => {
  await createDeal()
  await writeProcess({ checklistJson: '{"1-1-call":true}', salesProcessRevision: 0 })
  const audit = await db.salesProcessAudit.findFirstOrThrow()
  const user = await db.user.create({ data: { id: owner.id, name: owner.name, email: 'user@example.invalid', password: 'unused', role: 'user', team: { create: { name: '경영진' } } } })
  for (const [actorId, status] of [[undefined, 401], [user.id, 403], ['missing-user', 403]] as const) {
    const response = await deleteProcessAuditRequest(deletionRequest(), db, actorId, 'deal', audit.id, deletionEnv)
    assert.equal(response.status, status)
  }
  assert.equal(await processAuditAdmin(db, user.id), null)
  assert.equal(await db.salesProcessAuditDeletion.count(), 0)
  await db.user.update({ where: { id: user.id }, data: { role: 'admin' } })
  assert.ok(await processAuditAdmin(db, user.id))
  await db.user.update({ where: { id: user.id }, data: { role: 'user' } })
  assert.equal((await deleteProcessAuditRequest(deletionRequest(), db, user.id, 'deal', audit.id, deletionEnv)).status, 403)
})

test('admin display deletion preserves source history, lead state and revision; retries are idempotent', async () => {
  await createDeal()
  await writeProcess({ checklistJson: '{"1-1-call":true}', salesProcessRevision: 0 })
  const audit = await db.salesProcessAudit.findFirstOrThrow()
  const before = await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } })
  const user = await db.user.create({ data: { name: '관리자', email: 'admin@example.invalid', password: 'unused', role: 'admin' } })
  for (let i = 0; i < 2; i++) {
    const response = await deleteProcessAuditRequest(deletionRequest(), db, user.id, 'deal', audit.id, deletionEnv)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
  }
  assert.equal(await db.salesProcessAuditDeletion.count(), 1)
  assert.deepEqual(await db.salesProcessAudit.findUniqueOrThrow({ where: { id: audit.id } }), audit)
  assert.deepEqual(await db.salesDeal.findUniqueOrThrow({ where: { id: 'deal' } }), before)
  assert.equal(await db.salesProcessAudit.count({ where: { dealId: 'deal', deletion: null } }), 0)
  const deleted = await db.salesProcessAuditDeletion.findFirstOrThrow()
  assert.equal(deleted.actorId, user.id)
  assert.equal(deleted.actorName, user.name)
  assert.ok(deleted.createdAt instanceof Date)
})

test('history deletion binds the record to its lead and rejects foreign origins before writes', async () => {
  await createDeal()
  await createDeal({ id: 'other' })
  await writeProcess({ checklistJson: '{"1-1-call":true}', salesProcessRevision: 0 })
  const audit = await db.salesProcessAudit.findFirstOrThrow()
  const user = await db.user.create({ data: { name: '대표', email: 'ceo@example.invalid', password: 'unused', role: 'ceo' } })
  for (const origin of ['https://evil.test', '']) {
    assert.equal((await deleteProcessAuditRequest(deletionRequest(origin), db, user.id, 'deal', audit.id, deletionEnv)).status, 403)
  }
  assert.equal((await deleteProcessAuditRequest(deletionRequest(), db, user.id, 'other', audit.id, deletionEnv)).status, 404)
  assert.equal((await deleteProcessAuditRequest(deletionRequest(), db, user.id, 'deal', 'missing', deletionEnv)).status, 404)
  assert.equal(await db.salesProcessAuditDeletion.count(), 0)
  assert.equal((await deleteProcessAuditRequest(deletionRequest(), db, user.id, 'deal', audit.id, deletionEnv)).status, 200)
})

test('BuildUP import preserves two distinct amounts and source audit without confirming or advancing', async () => {
  const previous = emptySalesProcess()
  previous.deposit.model = '기존 입금 모델'
  await createDeal({stageCode:'1-3',process:previous})
  await createDocument('deal','buildup-quote','final_quotation')
  const process={...previous,finalQuote:{date:'',model:'PV5',spec:'냉동 저상',amountWon:43000000,grossAmountWon:56000000,documentId:'buildup-quote'}}
  assert.throws(()=>parseProcessInput({...process,finalQuote:{...process.finalQuote,grossAmountWon:-1}}),/총액/)
  const source={quoteId:7,quoteNo:'26-1234',version:'a'.repeat(64),pdfSha256:'b'.repeat(64),updatedAt:'2026-10-16T00:00:00Z',frozen:false}
  await customerWrite(db,async tx=>{
    const prepared=await prepareSalesProcessWrite(tx,'deal',{salesProcess:process,salesProcessRevision:0,checklistJson:'{"1-3-confirmed":false}'},owner,false,source)
    await tx.salesDeal.update({where:{id:'deal'},data:{...prepared.data,checklistJson:'{"1-3-confirmed":false}'}})
  })
  const saved=await db.salesDeal.findUniqueOrThrow({where:{id:'deal'}})
  assert.deepEqual(readSalesProcess(saved.salesProcessJson),process)
  assert.equal(saved.stageCode,'1-3')
  assert.equal(saved.salesProcessRevision,1)
  const audit=await db.salesProcessAudit.findFirstOrThrow()
  assert.deepEqual(JSON.parse(audit.afterJson).buildupQuote,source)
  await rejectsStatus(writeProcess({stageCode:'2-1',salesProcessRevision:1}),400,/최종 견적서 확정/)
})
