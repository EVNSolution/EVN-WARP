import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/* 고객 상세 필드 목록 — 이름/전화번호/세그먼트/상태를 제외한 모든 CRM 상세 */
const CLEAR_FIELDS = {
  email:            null,
  gender:           null,
  birthInfo:        null,
  birthYear:        null,
  maritalStatus:    null,
  childrenCount:    null,
  addressDetail:    null,
  regionCity:       null,
  regionDist:       null,
  isSoleProprietor: null,
  soleBusinessName: null,
  soleBusinessNo:   null,
  soleBusinessType: null,
  b2bCategory:      null,
  companyName:      null,
  businessRegNo:    null,
  contactTitle:     null,
  industry:         null,
  companyAddress:   null,
  companyPhone:     null,
  // 차량 정보
  hasVehicle:   null,
  vehicleMaker: null,
  vehicleName:  null,
  vehicleYear:  null,
  totalMileage: null,
  truckType1:   null,
  truckType2:   null,
  truckType3:   null,
  // 화주 정보
  shipperName:  null,
  cargoType:    null,
  deliveryCity: null,
  deliveryDist: null,
  deliveryFreq: null,
  workShift:    null,
  monthlyIncome:null,
  cargoNote:    null,
  // 리드에서 복사된 메타
  source:      null,
  collectedAt: null,
  referrer:    null,
  leadType:    null,
  assignee:    null,
  memo:        null,
}

/* ── GET: 현황 미리보기 ── */
export async function GET() {
  const [totalCustomers, linkedDeals, unlinkedDeals] = await Promise.all([
    prisma.customer.count(),
    prisma.salesDeal.count({ where: { customerId: { not: null } } }),
    prisma.salesDeal.count({ where: { customerId: null } }),
  ])

  // 현재 상세 정보가 있는 고객 수
  const customersWithDetail = await prisma.customer.count({
    where: {
      OR: [
        { vehicleMaker: { not: null } },
        { shipperName:  { not: null } },
        { companyName:  { not: null } },
        { email:        { not: null } },
        { gender:       { not: null } },
      ],
    },
  })

  return NextResponse.json({
    totalCustomers,
    customersWithDetail,
    linkedDeals,
    unlinkedDeals,
    willReset:  totalCustomers,
    willCreate: unlinkedDeals,
  })
}

/* ── POST: 마이그레이션 실행 ── */
export async function POST() {
  let resetCount  = 0
  let createCount = 0

  /* 1. 기존 모든 고객 — 이름·전화·세그먼트·상태만 유지, 상세 초기화 */
  const resetResult = await prisma.customer.updateMany({ data: CLEAR_FIELDS })
  resetCount = resetResult.count

  /* 2. 연결되지 않은 리드 → Customer 생성 + 연결 */
  const unlinked = await prisma.salesDeal.findMany({ where: { customerId: null } })

  for (const d of unlinked) {
    const a = d as any
    const salesStatus = a.salesStatus ?? (d.stage === '이탈' ? '이탈' : d.stage === '출고 완료' ? '완료' : null)

    const customer = await prisma.customer.create({
      data: {
        name:            d.name,
        phone:           d.phone            ?? null,
        customerSegment: a.customerSegment  ?? null,
        status: salesStatus === '완료' ? '완료'
              : salesStatus === '이탈' ? '이탈'
              : a.stageCode            ? '활성'
              : '잠재고객',
      },
    })
    await prisma.salesDeal.update({
      where: { id: d.id },
      data:  { customerId: customer.id },
    })
    createCount++
  }

  return NextResponse.json({
    ok: true,
    resetCount,
    createCount,
    message: `고객 ${resetCount}개 초기화, 신규 고객 ${createCount}개 생성 완료`,
  })
}
