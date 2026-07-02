import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const deals = await prisma.salesDeal.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(deals)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name?.trim()) return NextResponse.json({ error: '고객명은 필수입니다.' }, { status: 400 })

    // Customer CRM 레코드: 전화번호가 같은 기존 고객이 있으면 연결, 없으면 신규 생성
    const customerData = {
      name:             body.name.trim(),
      phone:            body.phone            || null,
      customerSegment:  body.customerSegment  || 'B2C',
      customerCategory: body.customerCategory || null,
      source:           body.source           || null,
      assignee:         body.assignee         || null,
      memo:             body.memo             || null,
      regionCity:       body.regionCity       || null,
      regionDist:       body.regionDist       || null,
      collectedAt:      body.collectedAt ? new Date(body.collectedAt) : null,
      email:            body.email            || null,
      gender:           body.gender           || null,
      birthInfo:        body.birthInfo        || null,
      maritalStatus:    body.maritalStatus    || null,
      childrenCount:    body.childrenCount    ?? null,
      addressDetail:    body.addressDetail    || null,
      isSoleProprietor: body.isSoleProprietor ?? null,
      soleBusinessName: body.soleBusinessName || null,
      soleBusinessNo:   body.soleBusinessNo   || null,
      soleBusinessType: body.soleBusinessType || null,
      b2bCategory:      body.b2bCategory      || null,
      companyName:      body.companyName      || null,
      businessRegNo:    body.businessRegNo    || null,
      contactTitle:     body.contactTitle     || null,
      industry:         body.industry         || null,
      companyAddress:   body.companyAddress   || null,
      companyPhone:     body.companyPhone     || null,
      vehicleMaker:     body.vehicleMaker     || null,
      vehicleName:      body.vehicleName      || null,
      vehicleYear:      body.vehicleYear      || null,
      totalMileage:     body.totalMileage     ?? null,
      truckType1:       body.truckType1       || null,
      truckType2:       body.truckType2       || null,
      truckType3:       body.truckType3       || null,
      truckType4:       body.truckType4       || null,
      shipperName:      body.shipperName      || null,
      cargoType:        body.cargoType        || null,
      deliveryCity:     body.deliveryCity     || null,
      deliveryDist:     body.deliveryDist     || null,
      deliveryFreq:     body.deliveryFreq     || null,
      workShift:        body.workShift        || null,
      monthlyIncome:    body.monthlyIncome    || null,
      cargoNote:        body.cargoNote        || null,
    }

    const phone = body.phone?.trim() || null
    let customer
    if (phone) {
      const existing = await prisma.customer.findFirst({ where: { phone } })
      if (existing) {
        // 기존 고객에 새 정보 병합 (기존값 우선, 새 값으로 덮어쓰지 않음)
        customer = await prisma.customer.update({
          where: { id: existing.id },
          data: {
            customerSegment:  existing.customerSegment  ?? customerData.customerSegment,
            customerCategory: existing.customerCategory ?? customerData.customerCategory,
            assignee:         existing.assignee         ?? customerData.assignee,
            companyName:      existing.companyName      ?? customerData.companyName,
          },
        })
      } else {
        customer = await prisma.customer.create({ data: customerData })
      }
    } else {
      customer = await prisma.customer.create({ data: customerData })
    }

    const deal = await prisma.salesDeal.create({
      data: {
        stage:            body.stage            || '리드',
        stageCode:        body.stageCode        || '1-1',
        salesStatus:      body.salesStatus      || '진행중',
        customerId:       customer.id,
        customerSegment:  body.customerSegment  || null,
        customerCategory: body.customerCategory || null,
        name:             (body.customerSegment === 'B2B' && body.companyName?.trim())
                            ? body.companyName.trim()
                            : body.name.trim(),
        phone:            body.phone            || null,
        birthYear:       body.birthYear       ?? null,
        regionCity:      body.regionCity      || null,
        regionDist:      body.regionDist      || null,
        leadType:        body.leadType        || null,
        source:          body.source          || null,
        collectedAt:     body.collectedAt     ? new Date(body.collectedAt) : null,
        referrer:        body.referrer        || null,
        phoneConsultedAt:body.phoneConsultedAt? new Date(body.phoneConsultedAt) : null,
        currentVehicle:  body.currentVehicle  || null,
        tradeIn:         body.tradeIn         || null,
        switchReason:    body.switchReason    || null,
        purchaseTiming:  body.purchaseTiming  || null,
        faceConsultedAt: body.faceConsultedAt ? new Date(body.faceConsultedAt) : null,
        customerType:    body.customerType    || null,
        purchaseMethod:  body.purchaseMethod  || null,
        capitalCheckedAt:body.capitalCheckedAt? new Date(body.capitalCheckedAt) : null,
        capitalResult:   body.capitalResult   || null,
        contractedAt:    body.contractedAt    ? new Date(body.contractedAt) : null,
        vehicleModel:    body.vehicleModel    || null,
        vehicleCount:    body.vehicleCount    ?? null,
        bodyType:        body.bodyType        || null,
        tempType:        body.tempType        || null,
        bodyOptions:     body.bodyOptions     || null,
        vehiclePrice:    body.vehiclePrice    ?? null,
        subsidyAmount:   body.subsidyAmount   ?? null,
        totalPrice:      body.totalPrice      ?? null,
        downPayment:     body.downPayment     ?? null,
        monthlyPayment:  body.monthlyPayment  ?? null,
        loanMonths:      body.loanMonths      ?? null,
        deliveredAt:     body.deliveredAt     ? new Date(body.deliveredAt) : null,
        assignee:        body.assignee        || null,
        memo:            body.memo            || null,
        purchaseGoal:    body.purchaseGoal    || null,
        keyFactors:      body.keyFactors      || null,
        lostReason:      body.lostReason      || null,
        // CRM 기본정보
        email:           body.email           || null,
        gender:          body.gender          || null,
        birthInfo:       body.birthInfo       || null,
        maritalStatus:   body.maritalStatus   || null,
        childrenCount:   body.childrenCount   ?? null,
        addressDetail:   body.addressDetail    || null,
        isSoleProprietor:body.isSoleProprietor ?? null,
        soleBusinessName:body.soleBusinessName || null,
        soleBusinessNo:  body.soleBusinessNo   || null,
        soleBusinessType:body.soleBusinessType || null,
        // CRM 법인정보
        b2bCategory:     body.b2bCategory     || null,
        companyName:     body.companyName     || null,
        businessRegNo:   body.businessRegNo   || null,
        contactTitle:    body.contactTitle    || null,
        industry:        body.industry        || null,
        companyAddress:  body.companyAddress  || null,
        companyPhone:    body.companyPhone    || null,
        // CRM 차량정보
        hasVehicle:      body.hasVehicle      ?? null,
        vehicleMaker:    body.vehicleMaker    || null,
        vehicleName:     body.vehicleName     || null,
        vehicleYear:     body.vehicleYear     || null,
        totalMileage:    body.totalMileage    ?? null,
        truckType1:      body.truckType1      || null,
        truckType2:      body.truckType2      || null,
        truckType3:      body.truckType3      || null,
        // CRM 화주정보
        shipperName:     body.shipperName     || null,
        cargoType:     body.cargoType     || null,
        deliveryCity:  body.deliveryCity  || null,
        deliveryDist:  body.deliveryDist  || null,
        deliveryFreq:  body.deliveryFreq  || null,
        workShift:     body.workShift     || null,
        monthlyIncome: body.monthlyIncome || null,
        cargoNote:     body.cargoNote     || null,
      },
    })
    return NextResponse.json(deal, { status: 201 })
  } catch {
    return NextResponse.json({ error: '생성 실패' }, { status: 500 })
  }
}
