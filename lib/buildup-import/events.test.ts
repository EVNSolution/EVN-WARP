import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAttachmentFileName, eventSummary, parseDealEvent } from './events'

const VALID = {
  event_key: 'quote_created:12',
  type: 'quote_created',
  occurred_at: '2026-08-18T00:00:00Z',
  quote: { id: 12, quote_no: '26-0012', status: 'draft', model_code: 'PV5_OPENBED', supply_price: 100, final_price: 45_000_000 },
  customer: { id: 3, name: '홍길동', phone: '010-1234-5678', warp_customer_id: 'warp-1' },
}

test('정상 payload 를 파싱하고 초과 필드는 버린다', () => {
  const p = parseDealEvent({ ...VALID, hacker_field: 'x', quote: { ...VALID.quote, memo: '내부' } })
  assert.ok(p)
  assert.equal(p.type, 'quote_created')
  assert.equal(p.quote.final_price, 45_000_000)
  assert.equal((p as unknown as Record<string, unknown>).hacker_field, undefined)
  assert.equal((p.quote as unknown as Record<string, unknown>).memo, undefined)
  assert.equal(p.customer?.warp_customer_id, 'warp-1')
})

test('고객 없는 이벤트도 유효하다 (customer: null)', () => {
  const p = parseDealEvent({ ...VALID, customer: null })
  assert.ok(p)
  assert.equal(p.customer, null)
})

test('quote_updated 도 유효한 타입이다', () => {
  const p = parseDealEvent({ ...VALID, type: 'quote_updated', event_key: 'quote_updated:12' })
  assert.ok(p)
  assert.equal(p.type, 'quote_updated')
})

test('형식 위반은 전부 null — 타입·키·quote.id', () => {
  assert.equal(parseDealEvent(null), null)
  assert.equal(parseDealEvent('str'), null)
  assert.equal(parseDealEvent({ ...VALID, type: 'unknown_type' }), null)
  assert.equal(parseDealEvent({ ...VALID, event_key: '' }), null)
  assert.equal(parseDealEvent({ ...VALID, event_key: 'k'.repeat(81) }), null)
  assert.equal(parseDealEvent({ ...VALID, quote: { quote_no: 'x' } }), null)
})

test('첨부 파일명 — 연월일6자리_고객이름_서류명, 수정본은 _v2부터', () => {
  // 2026-08-18 15:00 KST (UTC 06:00)
  const date = new Date('2026-08-18T06:00:00Z')
  assert.equal(
    buildAttachmentFileName({ date, customerName: '박신규', label: '견적서', version: 1, ext: '.pdf' }),
    '260818_박신규_견적서.pdf',
  )
  assert.equal(
    buildAttachmentFileName({ date, customerName: '박신규', label: '견적서', version: 3, ext: '.pdf' }),
    '260818_박신규_견적서_v3.pdf',
  )
  // KST 자정 경계 — UTC 17시는 한국 기준 다음날
  assert.equal(
    buildAttachmentFileName({ date: new Date('2026-08-18T17:00:00Z'), customerName: '박신규', label: '특장계약서', version: 1, ext: '.jpg' }),
    '260819_박신규_특장계약서.jpg',
  )
  // 위험 문자·공백 제거, 이름 없으면 고객미상
  assert.equal(
    buildAttachmentFileName({ date, customerName: '주식회사/한빛 물류', label: '견적서', version: 1, ext: '.pdf' }),
    '260818_주식회사한빛물류_견적서.pdf',
  )
  assert.equal(
    buildAttachmentFileName({ date, customerName: null, label: '견적서', version: 2, ext: '.pdf' }),
    '260818_고객미상_견적서_v2.pdf',
  )
})

test('요약 한 줄 — 고객·차종·금액·견적번호', () => {
  const p = parseDealEvent(VALID)!
  assert.equal(eventSummary(p), '홍길동 · PV5_OPENBED · 45,000,000원 · 견적번호 26-0012')
  const noName = parseDealEvent({ ...VALID, customer: null, quote: { ...VALID.quote, quote_no: null, final_price: 0 } })!
  assert.equal(eventSummary(noName), '고객 미상 · PV5_OPENBED · 견적 #12')
})
