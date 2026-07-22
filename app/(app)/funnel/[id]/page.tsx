import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { PIPELINE, getStageCode } from '@/lib/pipeline'
import LeadDetailClient, { type CustomerSnap } from './LeadDetailClient'

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; seg?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const fromStage = sp.from || null
  const fromSeg   = sp.seg  || null
  const [d, products] = await Promise.all([
    prisma.salesDeal.findUnique({ where: { id }, include: { customer: true } }),
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, code: true, category: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
  ])
  if (!d) notFound()
  const customer = d.customer ?? null

  // agentId FK 관계: include 대신 $queryRaw (libSQL 어댑터 호환)
  type AgentRow = { id: string; name: string; type: string; company: string | null }
  const a = d as any
  const agentId = a.agentId as string | null
  let agentRow: AgentRow | null = null
  if (agentId) {
    const rows = await prisma.$queryRaw<AgentRow[]>`
      SELECT id, name, type, company FROM "Agent" WHERE id = ${agentId} LIMIT 1
    `
    agentRow = rows[0] ?? null
  }

  const stageCode    = a.stageCode   ?? getStageCode(d.stage)
  const salesStatus  = a.salesStatus ?? (d.stage === '이탈' ? '이탈' : d.stage === '출고 완료' ? '완료' : '진행중')
  const checklistJson = a.checklistJson ?? null

  const customerSnap: CustomerSnap | null = customer ? {
    id:               customer.id,
    // 기본 CRM
    customerSegment:  customer.customerSegment  ?? null,
    customerCategory: customer.customerCategory ?? null,
    source:           customer.source           ?? null,
    regionCity:       customer.regionCity       ?? null,
    regionDist:       customer.regionDist       ?? null,
    // B2C
    email:            customer.email            ?? null,
    gender:           customer.gender           ?? null,
    birthInfo:        customer.birthInfo        ?? null,
    maritalStatus:    customer.maritalStatus    ?? null,
    childrenCount:    customer.childrenCount    ?? null,
    addressDetail:    customer.addressDetail    ?? null,
    isSoleProprietor: customer.isSoleProprietor ?? null,
    soleBusinessName: customer.soleBusinessName ?? null,
    soleBusinessNo:   customer.soleBusinessNo   ?? null,
    soleBusinessType: customer.soleBusinessType ?? null,
    // B2B
    b2bCategory:      customer.b2bCategory      ?? null,
    companyName:      customer.companyName      ?? null,
    businessRegNo:    customer.businessRegNo    ?? null,
    contactTitle:     customer.contactTitle     ?? null,
    industry:         customer.industry         ?? null,
    companyAddress:   customer.companyAddress   ?? null,
    companyPhone:     customer.companyPhone     ?? null,
    b2bRevenue1:      customer.b2bRevenue1      ?? null,
    b2bRevenue2:      customer.b2bRevenue2      ?? null,
    b2bRevenue3:      customer.b2bRevenue3      ?? null,
    // 차량
    hasVehicle:       customer.hasVehicle       ?? null,
    vehicleMaker:     customer.vehicleMaker     ?? null,
    vehicleName:      customer.vehicleName      ?? null,
    vehicleYear:      customer.vehicleYear      ?? null,
    totalMileage:     customer.totalMileage     ?? null,
    truckType1:       customer.truckType1       ?? null,
    truckType2:       customer.truckType2       ?? null,
    truckType3:       customer.truckType3       ?? null,
    truckType4:       customer.truckType4       ?? null,
    // 화주
    shipperName:      customer.shipperName      ?? null,
    cargoType:        customer.cargoType        ?? null,
    deliveryCity:     customer.deliveryCity     ?? null,
    deliveryDist:     customer.deliveryDist     ?? null,
    deliveryFreq:     customer.deliveryFreq     ?? null,
    workShift:        customer.workShift        ?? null,
    monthlyIncome:    customer.monthlyIncome    ?? null,
    cargoNote:        customer.cargoNote        ?? null,
  } : null

  return (
    <LeadDetailClient
      products={products}
      customer={customerSnap}
      fromStage={fromStage}
      fromSeg={fromSeg}
      deal={{
        id:              d.id,
        name:            d.name,
        phone:           d.phone,
        birthYear:       d.birthYear,
        regionCity:      d.regionCity,
        regionDist:      d.regionDist,
        leadType:        d.leadType,
        source:          d.source,
        referrer:        d.referrer,
        collectedAt:     d.collectedAt?.toISOString() ?? null,
        currentVehicle:   d.currentVehicle,
        tradeIn:          d.tradeIn,
        switchReason:     d.switchReason,
        purchaseTiming:   d.purchaseTiming,
        customerType:     d.customerType,
        purchaseMethod:   d.purchaseMethod,
        capitalResult:    d.capitalResult,
        vehicleModel:     d.vehicleModel,
        bodyType:         d.bodyType,
        tempType:         d.tempType,
        bodyOptions:      a.bodyOptions      ?? null,
        vehicleCount:     a.vehicleCount     ?? null,
        phoneConsultedAt: d.phoneConsultedAt?.toISOString() ?? null,
        faceConsultedAt:  d.faceConsultedAt?.toISOString()  ?? null,
        capitalCheckedAt: d.capitalCheckedAt?.toISOString() ?? null,
        contractedAt:     d.contractedAt?.toISOString()     ?? null,
        deliveredAt:      d.deliveredAt?.toISOString()      ?? null,
        vehiclePrice:     a.vehiclePrice     ?? null,
        subsidyAmount:    a.subsidyAmount    ?? null,
        downPayment:      a.downPayment      ?? null,
        totalPrice:       a.totalPrice       ?? null,
        monthlyPayment:   a.monthlyPayment   ?? null,
        loanMonths:       a.loanMonths       ?? null,
        agentId:         agentId,
        agent:           agentRow,
        assignee:         d.assignee,
        memo:            d.memo,
        lostReason:      d.lostReason,
        stageCode,
        salesStatus,
        checklistJson,
        // CRM
        customerSegment:  a.customerSegment  ?? null,
        customerCategory: a.customerCategory ?? null,
        email:            a.email            ?? null,
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
        truckType4:       a.truckType4       ?? null,
        shipperName:      a.shipperName      ?? null,
        cargoType:     a.cargoType     ?? null,
        deliveryCity:  a.deliveryCity  ?? null,
        deliveryDist:  a.deliveryDist  ?? null,
        deliveryFreq:  a.deliveryFreq  ?? null,
        workShift:     a.workShift     ?? null,
        monthlyIncome: a.monthlyIncome ?? null,
        cargoNote:     a.cargoNote     ?? null,
        productId:     a.productId     ?? null,
      }}
    />
  )
}
