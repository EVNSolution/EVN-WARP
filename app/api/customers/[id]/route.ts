import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      leads: { orderBy: { createdAt: 'desc' } },
      activities: { orderBy: { date: 'desc' } },
    },
  })
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(customer)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const b = await req.json()
    const n = (v: unknown) => (v === undefined ? undefined : v ?? null)
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        /* ── 기본 정보 ── */
        ...(b.name             !== undefined && { name:             b.name }),
        ...(b.phone            !== undefined && { phone:            n(b.phone) }),
        ...(b.email            !== undefined && { email:            n(b.email) }),
        ...(b.customerSegment  !== undefined && { customerSegment:  n(b.customerSegment) }),
        ...(b.customerCategory !== undefined && { customerCategory: n(b.customerCategory) }),
        ...(b.status           !== undefined && { status:           b.status }),
        ...(b.grade            !== undefined && { grade:            n(b.grade) }),
        ...(b.tags             !== undefined && { tags:             n(b.tags) }),
        ...(b.source           !== undefined && { source:           n(b.source) }),
        ...(b.assignee         !== undefined && { assignee:         n(b.assignee) }),
        ...(b.memo             !== undefined && { memo:             n(b.memo) }),
        ...(b.regionCity       !== undefined && { regionCity:       n(b.regionCity) }),
        ...(b.regionDist       !== undefined && { regionDist:       n(b.regionDist) }),

        /* ── B2C 개인 정보 ── */
        ...(b.gender           !== undefined && { gender:           n(b.gender) }),
        ...(b.birthYear        !== undefined && { birthYear:        n(b.birthYear) }),
        ...(b.birthInfo        !== undefined && { birthInfo:        n(b.birthInfo) }),
        ...(b.maritalStatus    !== undefined && { maritalStatus:    n(b.maritalStatus) }),
        ...(b.childrenCount    !== undefined && { childrenCount:    b.childrenCount ?? null }),
        ...(b.addressDetail    !== undefined && { addressDetail:    n(b.addressDetail) }),
        ...(b.isSoleProprietor !== undefined && { isSoleProprietor: b.isSoleProprietor ?? null }),
        ...(b.soleBusinessName !== undefined && { soleBusinessName: n(b.soleBusinessName) }),
        ...(b.soleBusinessNo   !== undefined && { soleBusinessNo:   n(b.soleBusinessNo) }),
        ...(b.soleBusinessType !== undefined && { soleBusinessType: n(b.soleBusinessType) }),

        /* ── B2B 법인 정보 ── */
        ...(b.b2bCategory      !== undefined && { b2bCategory:      n(b.b2bCategory) }),
        ...(b.companyName      !== undefined && { companyName:      n(b.companyName) }),
        ...(b.businessRegNo    !== undefined && { businessRegNo:    n(b.businessRegNo) }),
        ...(b.contactTitle     !== undefined && { contactTitle:     n(b.contactTitle) }),
        ...(b.industry         !== undefined && { industry:         n(b.industry) }),
        ...(b.companyAddress   !== undefined && { companyAddress:   n(b.companyAddress) }),
        ...(b.companyPhone     !== undefined && { companyPhone:     n(b.companyPhone) }),
        ...(b.employeeCount    !== undefined && { employeeCount:    b.employeeCount ?? null }),

        /* ── B2B 법인 매출 ── */
        ...(b.b2bRevenue1      !== undefined && { b2bRevenue1:      n(b.b2bRevenue1) }),
        ...(b.b2bRevenue2      !== undefined && { b2bRevenue2:      n(b.b2bRevenue2) }),
        ...(b.b2bRevenue3      !== undefined && { b2bRevenue3:      n(b.b2bRevenue3) }),

        /* ── 차량 정보 ── */
        ...(b.hasVehicle       !== undefined && { hasVehicle:       b.hasVehicle ?? null }),
        ...(b.vehicleMaker     !== undefined && { vehicleMaker:     n(b.vehicleMaker) }),
        ...(b.vehicleName      !== undefined && { vehicleName:      n(b.vehicleName) }),
        ...(b.vehicleYear      !== undefined && { vehicleYear:      n(b.vehicleYear) }),
        ...(b.totalMileage     !== undefined && { totalMileage:     b.totalMileage ?? null }),
        ...(b.vehicleListJson  !== undefined && { vehicleListJson:  n(b.vehicleListJson) }),
        ...(b.truckType1       !== undefined && { truckType1:       n(b.truckType1) }),
        ...(b.truckType2       !== undefined && { truckType2:       n(b.truckType2) }),
        ...(b.truckType3       !== undefined && { truckType3:       n(b.truckType3) }),
        ...(b.truckType4       !== undefined && { truckType4:       n(b.truckType4) }),

        /* ── 화주 정보 ── */
        ...(b.shipperName      !== undefined && { shipperName:      n(b.shipperName) }),
        ...(b.cargoType        !== undefined && { cargoType:        n(b.cargoType) }),
        ...(b.deliveryCity     !== undefined && { deliveryCity:     n(b.deliveryCity) }),
        ...(b.deliveryDist     !== undefined && { deliveryDist:     n(b.deliveryDist) }),
        ...(b.deliveryFreq     !== undefined && { deliveryFreq:     n(b.deliveryFreq) }),
        ...(b.workShift        !== undefined && { workShift:        n(b.workShift) }),
        ...(b.monthlyIncome    !== undefined && { monthlyIncome:    n(b.monthlyIncome) }),
        ...(b.cargoNote        !== undefined && { cargoNote:        n(b.cargoNote) }),
      },
    })
    return NextResponse.json(customer)
  } catch {
    return NextResponse.json({ error: '수정 실패' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.customer.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
