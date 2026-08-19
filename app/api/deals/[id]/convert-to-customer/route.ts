import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 판매보류/이탈 리드를 파이프라인에서 내리고 고객정보(CRM)로 정리한다.
// 이미 연결된 Customer가 있으면 재사용하고, 없으면 리드 정보로 새로 생성한다.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const d = await prisma.salesDeal.findUnique({ where: { id } })
  if (!d) return NextResponse.json({ error: '리드를 찾을 수 없습니다' }, { status: 404 })

  const a = d as any
  let customerId = a.customerId as string | null
  let created = false

  if (!customerId) {
    // 전화번호+이름이 모두 같은 기존 고객이 있으면 재사용 (중복 생성 방지)
    const dupPhone = d.phone?.trim() || null
    const existing = dupPhone
      ? await prisma.customer.findFirst({ where: { phone: dupPhone, name: d.name } })
      : null

    const customer = existing ?? await prisma.customer.create({
      data: {
        name:             d.name,
        phone:            d.phone            ?? null,
        email:            a.email            ?? null,
        customerSegment:  a.customerSegment  ?? null,
        customerCategory: a.customerCategory ?? null,
        status:           d.salesStatus === '이탈' ? '이탈' : '잠재고객',
        source:           d.source           ?? null,
        collectedAt:      d.collectedAt      ?? null,
        referrer:         a.referrer         ?? null,
        leadType:         a.leadType         ?? null,
        assignee:         d.assignee         ?? null,
        memo:             d.memo             ?? null,
        birthYear:        a.birthYear        ?? null,
        regionCity:       a.regionCity       ?? null,
        regionDist:       a.regionDist       ?? null,
        gender:           a.gender           ?? null,
        birthInfo:        a.birthInfo        ?? null,
        maritalStatus:    a.maritalStatus    ?? null,
        childrenCount:    a.childrenCount    ?? null,
        addressDetail:    a.addressDetail    ?? null,
        isSoleProprietor: a.isSoleProprietor ?? null,
        soleBusinessName: a.soleBusinessName ?? null,
        soleBusinessNo:   a.soleBusinessNo   ?? null,
        soleBusinessType: a.soleBusinessType ?? null,
        b2bCategory:      a.b2bCategory      ?? null,
        companyName:      a.companyName      ?? null,
        businessRegNo:    a.businessRegNo    ?? null,
        contactTitle:     a.contactTitle     ?? null,
        industry:         a.industry         ?? null,
        companyAddress:   a.companyAddress   ?? null,
        companyPhone:     a.companyPhone     ?? null,
        hasVehicle:       a.hasVehicle       ?? null,
        vehicleMaker:     a.vehicleMaker     ?? null,
        vehicleName:      a.vehicleName      ?? null,
        vehicleYear:      a.vehicleYear      ?? null,
        totalMileage:     a.totalMileage     ?? null,
        truckType1:       a.truckType1       ?? null,
        truckType2:       a.truckType2       ?? null,
        truckType3:       a.truckType3       ?? null,
        shipperName:      a.shipperName      ?? null,
        cargoType:        a.cargoType        ?? null,
        deliveryCity:     a.deliveryCity     ?? null,
        deliveryDist:     a.deliveryDist     ?? null,
        deliveryFreq:     a.deliveryFreq     ?? null,
        workShift:        a.workShift        ?? null,
        monthlyIncome:    a.monthlyIncome    ?? null,
        cargoNote:        a.cargoNote        ?? null,
      },
    })
    customerId = customer.id
    created = !existing
  }

  await prisma.salesDeal.update({
    where: { id },
    data: { customerId, salesStatus: '고객전환' } as any,
  })

  return NextResponse.json({ ok: true, customerId, created })
}
