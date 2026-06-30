import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const url  = new URL(req.url)
  const q    = url.searchParams.get('q')?.trim()
  const mode = url.searchParams.get('mode') // 'name' | 'phone' | null(both)

  // 전화번호 검색 시 숫자만 추출해 비교 (하이픈 무관)
  const digitsOnly = q?.replace(/\D/g, '')

  const customers = await prisma.customer.findMany({
    where: q
      ? mode === 'phone'
        ? { OR: [
            { phone: { contains: q } },                      // 원본 그대로 포함
            ...(digitsOnly ? [{ phone: { contains: digitsOnly } }] : []),
          ] }
        : mode === 'name'
          ? { name: { contains: q } }
          : { OR: [
              { name:  { contains: q } },
              { phone: { contains: q } },
            ] }
      : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      leads: { select: { id: true, stageCode: true, salesStatus: true } },
      activities: { select: { id: true, date: true, type: true }, orderBy: { date: 'desc' }, take: 1 },
    },
  })
  return NextResponse.json(customers)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name?.trim()) return NextResponse.json({ error: '고객명은 필수입니다.' }, { status: 400 })
    const customer = await prisma.customer.create({
      data: {
        name:             body.name.trim(),
        phone:            body.phone            || null,
        email:            body.email            || null,
        customerSegment:  body.customerSegment  || null,
        customerCategory: body.customerCategory || null,
        status:           body.status           || '잠재고객',
        grade:            body.grade            || null,
        source:           body.source           || null,
        collectedAt:      body.collectedAt ? new Date(body.collectedAt) : null,
        assignee:         body.assignee         || null,
        memo:             body.memo             || null,
        regionCity:       body.regionCity       || null,
        regionDist:       body.regionDist       || null,
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
      },
    })
    return NextResponse.json(customer, { status: 201 })
  } catch {
    return NextResponse.json({ error: '생성 실패' }, { status: 500 })
  }
}
