import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const toDate = (v: unknown) => (v ? new Date(v as string) : null)

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await req.json()
    const deal = await prisma.salesDeal.update({
      where: { id },
      data: {
        // agentId는 FK 필드 — libSQL 어댑터 호환을 위해 ORM update에서 제외, 아래 $executeRaw로 처리
        ...(b.stage            !== undefined && { stage: b.stage }),
        ...(b.name             !== undefined && { name: b.name.trim() }),
        ...(b.phone            !== undefined && { phone: b.phone || null }),
        ...(b.birthYear        !== undefined && { birthYear: b.birthYear ?? null }),
        ...(b.regionCity       !== undefined && { regionCity: b.regionCity || null }),
        ...(b.regionDist       !== undefined && { regionDist: b.regionDist || null }),
        ...(b.leadType         !== undefined && { leadType: b.leadType || null }),
        ...(b.source           !== undefined && { source: b.source || null }),
        ...(b.collectedAt      !== undefined && { collectedAt: toDate(b.collectedAt) }),
        ...(b.referrer         !== undefined && { referrer: b.referrer || null }),
        ...(b.phoneConsultedAt !== undefined && { phoneConsultedAt: toDate(b.phoneConsultedAt) }),
        ...(b.currentVehicle   !== undefined && { currentVehicle: b.currentVehicle || null }),
        ...(b.tradeIn          !== undefined && { tradeIn: b.tradeIn || null }),
        ...(b.switchReason     !== undefined && { switchReason: b.switchReason || null }),
        ...(b.purchaseTiming   !== undefined && { purchaseTiming: b.purchaseTiming || null }),
        ...(b.faceConsultedAt  !== undefined && { faceConsultedAt: toDate(b.faceConsultedAt) }),
        ...(b.customerType     !== undefined && { customerType: b.customerType || null }),
        ...(b.purchaseMethod   !== undefined && { purchaseMethod: b.purchaseMethod || null }),
        ...(b.capitalCheckedAt !== undefined && { capitalCheckedAt: toDate(b.capitalCheckedAt) }),
        ...(b.capitalResult    !== undefined && { capitalResult: b.capitalResult || null }),
        ...(b.contractedAt     !== undefined && { contractedAt: toDate(b.contractedAt) }),
        ...(b.vehicleModel     !== undefined && { vehicleModel: b.vehicleModel || null }),
        ...(b.vehicleCount     !== undefined && { vehicleCount: b.vehicleCount ?? null }),
        ...(b.bodyType         !== undefined && { bodyType: b.bodyType || null }),
        ...(b.tempType         !== undefined && { tempType: b.tempType || null }),
        ...(b.bodyOptions      !== undefined && { bodyOptions: b.bodyOptions || null }),
        ...(b.vehiclePrice     !== undefined && { vehiclePrice: b.vehiclePrice ?? null }),
        ...(b.subsidyAmount    !== undefined && { subsidyAmount: b.subsidyAmount ?? null }),
        ...(b.totalPrice       !== undefined && { totalPrice: b.totalPrice ?? null }),
        ...(b.downPayment      !== undefined && { downPayment: b.downPayment ?? null }),
        ...(b.monthlyPayment   !== undefined && { monthlyPayment: b.monthlyPayment ?? null }),
        ...(b.loanMonths       !== undefined && { loanMonths: b.loanMonths ?? null }),
        ...(b.deliveredAt      !== undefined && { deliveredAt: toDate(b.deliveredAt) }),
        ...(b.assignee         !== undefined && { assignee: b.assignee || null }),
        ...(b.memo             !== undefined && { memo: b.memo || null }),
        ...(b.purchaseGoal     !== undefined && { purchaseGoal: b.purchaseGoal || null }),
        ...(b.keyFactors       !== undefined && { keyFactors: b.keyFactors || null }),
        ...(b.lostReason        !== undefined && { lostReason:        b.lostReason        || null }),
        ...(b.stageCode         !== undefined && { stageCode:         b.stageCode         || null }),
        ...(b.checklistJson     !== undefined && { checklistJson:     b.checklistJson     || null }),
        ...(b.salesStatus       !== undefined && { salesStatus:       b.salesStatus       || null }),
        ...(b.customerId        !== undefined && { customerId:        b.customerId        || null }),
        // CRM 고객 세그먼트
        ...(b.customerSegment   !== undefined && { customerSegment:   b.customerSegment   || null }),
        ...(b.customerCategory  !== undefined && { customerCategory:  b.customerCategory  || null }),
        // CRM 기본정보 (B2C)
        ...(b.email             !== undefined && { email:             b.email             || null }),
        ...(b.gender            !== undefined && { gender:            b.gender            || null }),
        ...(b.birthInfo         !== undefined && { birthInfo:         b.birthInfo         || null }),
        ...(b.maritalStatus     !== undefined && { maritalStatus:     b.maritalStatus     || null }),
        ...(b.childrenCount     !== undefined && { childrenCount:     b.childrenCount     ?? null }),
        ...(b.addressDetail      !== undefined && { addressDetail:      b.addressDetail      || null }),
        ...(b.isSoleProprietor   !== undefined && { isSoleProprietor:   b.isSoleProprietor   ?? null }),
        ...(b.soleBusinessName   !== undefined && { soleBusinessName:   b.soleBusinessName   || null }),
        ...(b.soleBusinessNo     !== undefined && { soleBusinessNo:     b.soleBusinessNo     || null }),
        ...(b.soleBusinessType   !== undefined && { soleBusinessType:   b.soleBusinessType   || null }),
        // CRM 법인정보 (B2B)
        ...(b.b2bCategory       !== undefined && { b2bCategory:       b.b2bCategory       || null }),
        ...(b.companyName       !== undefined && { companyName:       b.companyName       || null }),
        ...(b.businessRegNo     !== undefined && { businessRegNo:     b.businessRegNo     || null }),
        ...(b.contactTitle      !== undefined && { contactTitle:      b.contactTitle      || null }),
        ...(b.industry          !== undefined && { industry:          b.industry          || null }),
        ...(b.companyAddress    !== undefined && { companyAddress:    b.companyAddress    || null }),
        ...(b.companyPhone      !== undefined && { companyPhone:      b.companyPhone      || null }),
        // CRM 차량정보
        ...(b.hasVehicle    !== undefined && { hasVehicle:    b.hasVehicle    ?? null }),
        ...(b.vehicleMaker  !== undefined && { vehicleMaker:  b.vehicleMaker  || null }),
        ...(b.vehicleName   !== undefined && { vehicleName:   b.vehicleName   || null }),
        ...(b.vehicleYear   !== undefined && { vehicleYear:   b.vehicleYear   || null }),
        ...(b.totalMileage  !== undefined && { totalMileage:  b.totalMileage  ?? null }),
        ...(b.truckType1    !== undefined && { truckType1:    b.truckType1    || null }),
        ...(b.truckType2    !== undefined && { truckType2:    b.truckType2    || null }),
        ...(b.truckType3    !== undefined && { truckType3:    b.truckType3    || null }),
        // CRM 화주정보
        ...(b.shipperName       !== undefined && { shipperName:       b.shipperName       || null }),
        ...(b.cargoType      !== undefined && { cargoType:      b.cargoType      || null }),
        ...(b.deliveryCity   !== undefined && { deliveryCity:   b.deliveryCity   || null }),
        ...(b.deliveryDist   !== undefined && { deliveryDist:   b.deliveryDist   || null }),
        ...(b.deliveryFreq   !== undefined && { deliveryFreq:   b.deliveryFreq   || null }),
        ...(b.workShift      !== undefined && { workShift:      b.workShift      || null }),
        ...(b.monthlyIncome  !== undefined && { monthlyIncome:  b.monthlyIncome  || null }),
        ...(b.cargoNote      !== undefined && { cargoNote:      b.cargoNote      || null }),
      },
    })

    // agentId FK 필드: libSQL 어댑터 호환 — $executeRaw로 별도 처리
    if (b.agentId !== undefined) {
      const agentId = b.agentId || null
      if (agentId) {
        await prisma.$executeRaw`UPDATE "SalesDeal" SET "agentId" = ${agentId} WHERE id = ${id}`
      } else {
        await prisma.$executeRaw`UPDATE "SalesDeal" SET "agentId" = NULL WHERE id = ${id}`
      }
    }

    return NextResponse.json({ ...deal, agentId: b.agentId !== undefined ? (b.agentId || null) : undefined })
  } catch {
    return NextResponse.json({ error: '수정 실패' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.salesDeal.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
  }
}
