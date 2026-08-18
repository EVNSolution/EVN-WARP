import assert from 'node:assert/strict'
import test from 'node:test'

import { classifyCustomer, toWarpCreateData, type BuildupCustomer, type WarpMatchTarget } from './classify'

function bc(over: Partial<BuildupCustomer> = {}): BuildupCustomer {
  return {
    id: 1, name: '홍길동', ceo_name: null, email: null, phone: '010-1234-5678', tel: null,
    address: null, address_detail: null, reg_no: null, warp_customer_id: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

function wt(over: Partial<WarpMatchTarget> = {}): WarpMatchTarget {
  return {
    id: 'w1', name: '홍길동', companyName: null, phone: '010-1234-5678',
    companyPhone: null, birthInfo: null, soleBusinessNo: null, businessRegNo: null,
    ...over,
  }
}

test('warp_customer_id 가 있으면 이미 연결됨', () => {
  assert.deepEqual(classifyCustomer(bc({ warp_customer_id: 'w1' }), [wt()]), { kind: 'linked' })
})

test('아무것도 안 겹치면 신규', () => {
  const cls = classifyCustomer(bc({ name: '김신규', phone: '010-0000-9999' }), [wt()])
  assert.deepEqual(cls, { kind: 'new' })
})

test('이름+전화가 겹치면 중복 의심 — 이유가 함께 온다', () => {
  const cls = classifyCustomer(bc(), [wt()])
  assert.equal(cls.kind, 'suspect')
  if (cls.kind !== 'suspect') return
  assert.equal(cls.matches[0].warpId, 'w1')
  assert.deepEqual(cls.matches[0].reasons, ['전화 일치', '이름/상호 일치'])
})

test('법인 — 상호가 companyName 과, 유선이 companyPhone 과, 대표가 name 과 겹친다', () => {
  const b = bc({ name: '한빛물류', ceo_name: '김대표', phone: null, tel: '02-555-1234', reg_no: '123-45-67890' })
  const w = wt({ name: '김대표', companyName: '한빛물류', phone: null, companyPhone: '025551234', businessRegNo: '1234567890' })
  const cls = classifyCustomer(b, [w])
  assert.equal(cls.kind, 'suspect')
  if (cls.kind !== 'suspect') return
  assert.deepEqual(cls.matches[0].reasons, ['전화 일치', '이름/상호 일치', '대표자명 일치', '사업자번호 일치'])
})

test('겹치는 이유가 많은 후보가 앞에 온다', () => {
  const weak = wt({ id: 'weak', name: '다른사람', phone: '010-1234-5678' })          // 전화만
  const strong = wt({ id: 'strong' })                                               // 전화+이름
  const cls = classifyCustomer(bc(), [weak, strong])
  assert.equal(cls.kind, 'suspect')
  if (cls.kind !== 'suspect') return
  assert.deepEqual(cls.matches.map(m => m.warpId), ['strong', 'weak'])
})

test('생년월일 8자리 매칭 — 하이픈 형식 무관', () => {
  const cls = classifyCustomer(
    bc({ name: '딴이름', phone: null, reg_no: '1990-01-02' }),
    [wt({ name: '또다른', phone: null, birthInfo: '1990.01.02' })],
  )
  assert.equal(cls.kind, 'suspect')
  if (cls.kind !== 'suspect') return
  assert.deepEqual(cls.matches[0].reasons, ['생년월일 일치'])
})

test('toWarpCreateData — 개인: 생년월일/개인사업자 구분, 주소 합침', () => {
  const ind = toWarpCreateData(bc({ reg_no: '1990-01-02', address: '경기 남양주시', address_detail: '다산동 123' }))
  assert.equal(ind.customerSegment, 'B2C')
  assert.equal(ind.birthInfo, '1990-01-02')
  assert.equal(ind.addressDetail, '경기 남양주시 다산동 123')
  assert.equal(ind.source, 'buildup')

  const sole = toWarpCreateData(bc({ reg_no: '123-45-67890' }))
  assert.equal(sole.isSoleProprietor, true)
  assert.equal(sole.soleBusinessNo, '123-45-67890')
  assert.equal(sole.birthInfo, null)
})

test('toWarpCreateData — 법인: name=대표자·companyName=상호로 뒤집는다', () => {
  const corp = toWarpCreateData(bc({ name: '한빛물류', ceo_name: '김대표', tel: '02-555-1234', reg_no: '123-45-67890' }))
  assert.equal(corp.customerSegment, 'B2B')
  assert.equal(corp.name, '김대표')
  assert.equal(corp.companyName, '한빛물류')
  assert.equal(corp.companyPhone, '02-555-1234')
  assert.equal(corp.businessRegNo, '123-45-67890')
})

test('toWarpCreateData — 비정형 reg_no 는 버린다 (모판 오염 방지)', () => {
  const d = toWarpCreateData(bc({ reg_no: '90-01-02' }))
  assert.equal(d.birthInfo, null)
  assert.equal(d.soleBusinessNo, null)
})
