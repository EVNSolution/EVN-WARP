import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST() {
  const deals = await prisma.salesDeal.findMany({ where: { customerId: null } })
  let created = 0

  for (const d of deals) {
    const a = d as any
    const customer = await prisma.customer.create({
      data: {
        name:             d.name,
        phone:            d.phone            ?? null,
        email:            a.email            ?? null,
        customerSegment:  a.customerSegment  ?? null,
        customerCategory: a.customerCategory ?? null,
        status:           d.salesStatus === '완료' ? '완료'
                        : d.salesStatus === '이탈' ? '이탈'
                        : a.stageCode              ? '활성'
                        : '잠재고객',
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
    await prisma.salesDeal.update({
      where: { id: d.id },
      data:  { customerId: customer.id },
    })
    created++
  }

  return NextResponse.json({ ok: true, created, skipped: 0 })
}
