import assert from 'node:assert/strict'
import test from 'node:test'

import { digitsOnly, filterByPhone, toExternalDto, type ExternalCustomerDto } from './match'

test('digitsOnly strips every non-digit character', () => {
  assert.equal(digitsOnly('010-1234-5678'), '01012345678')
  assert.equal(digitsOnly('(02) 555 1234'), '025551234')
  assert.equal(digitsOnly(null), '')
  assert.equal(digitsOnly(undefined), '')
})

test('filterByPhone matches normalized phone numbers exactly', () => {
  const customers = [
    { id: 'a', phone: '010-1234-5678' },
    { id: 'b', phone: '01012345678' },
    { id: 'c', phone: '010-1234-9999' },
    { id: 'd', phone: null },
  ]
  const hits = filterByPhone(customers, '01012345678')
  assert.deepEqual(hits.map(c => c.id), ['a', 'b'])
  // 빈 키로는 아무것도 매칭되지 않는다 — phone 이 null 인 행이 전부 걸리면 안 된다
  assert.deepEqual(filterByPhone(customers, ''), [])
})

test('filterByPhone matches company phone too (B2B)', () => {
  const customers = [
    // B2B — 담당자 휴대폰 없이 회사 대표번호만 등록된 고객
    { id: 'corp', phone: null, companyPhone: '02-555-1234' },
    // 휴대폰과 회사번호가 모두 있는 고객 — 어느 쪽으로도 찾아진다
    { id: 'both', phone: '010-1234-5678', companyPhone: '02-555-1234' },
    { id: 'other', phone: '010-9999-0000', companyPhone: '02-777-8888' },
  ]
  assert.deepEqual(filterByPhone(customers, '025551234').map(c => c.id), ['corp', 'both'])
  assert.deepEqual(filterByPhone(customers, '01012345678').map(c => c.id), ['both'])
  // 회사번호가 null 이어도 안전하다
  assert.deepEqual(filterByPhone([{ id: 'x', phone: null, companyPhone: null }], '025551234'), [])
})

test('toExternalDto keeps only whitelisted fields', () => {
  const row: ExternalCustomerDto & Record<string, unknown> = {
    name: '홍길동',
    phone: '010-1234-5678',
    email: 'hong@example.com',
    customerSegment: 'B2C',
    birthInfo: '1990-01-02',
    birthYear: 1990,
    regionCity: '서울',
    regionDist: '강남구',
    addressDetail: '테헤란로 1',
    isSoleProprietor: true,
    soleBusinessName: '길동상사',
    soleBusinessNo: '123-45-67890',
    soleBusinessType: '운수업',
    companyName: null,
    businessRegNo: null,
    companyAddress: null,
    companyPhone: null,
    hasVehicle: true,
    vehicleMaker: '현대',
    vehicleName: '포터EV',
    vehiclePlateNo: '12가3456',
    vehicleYear: '2023',
    truckType1: '카고',
    truckType2: null,
    truckType3: null,
    truckType4: null,
    // 내부 전용 — 절대 밖으로 나가면 안 되는 값들
    memo: '내부 메모',
    grade: '골드',
    tags: '["VIP"]',
    assignee: '담당자',
    b2bRevenue1: '10억',
    contactsJson: '[{"name":"관계자"}]',
    shipperName: '화주',
  }

  const dto = toExternalDto(row)
  assert.equal(dto.name, '홍길동')
  assert.equal(dto.soleBusinessNo, '123-45-67890')
  assert.equal(dto.vehicleName, '포터EV')
  for (const forbidden of ['memo', 'grade', 'tags', 'assignee', 'b2bRevenue1', 'contactsJson', 'shipperName']) {
    assert.equal(forbidden in dto, false, `${forbidden} must not leak`)
  }
})
