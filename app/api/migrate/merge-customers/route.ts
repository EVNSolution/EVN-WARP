import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/*
  POST body: { keepId: string, removeId: string }
  - keepId  : 남길 고객
  - removeId: 제거할 고객 (리드·활동 모두 keepId로 이전)
*/
export async function POST(req: NextRequest) {
  const { keepId, removeId } = await req.json()
  if (!keepId || !removeId || keepId === removeId)
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 })

  const [keep, remove] = await Promise.all([
    prisma.customer.findUnique({ where: { id: keepId } }),
    prisma.customer.findUnique({ where: { id: removeId }, include: { leads: true, activities: true } }),
  ])
  if (!keep || !remove)
    return NextResponse.json({ error: '고객을 찾을 수 없습니다' }, { status: 404 })

  /* 1. 제거 고객의 리드를 유지 고객으로 이전 */
  const movedLeads = await prisma.salesDeal.updateMany({
    where: { customerId: removeId },
    data:  { customerId: keepId },
  })

  /* 2. 제거 고객의 활동을 유지 고객으로 이전 */
  const movedActivities = await prisma.customerActivity.updateMany({
    where: { customerId: removeId },
    data:  { customerId: keepId },
  })

  /* 3. 유지 고객에 없는 상세 정보를 제거 고객에서 병합 */
  const mergeData: Record<string, unknown> = {}
  const fields = [
    'email','gender','birthInfo','birthYear','maritalStatus','childrenCount',
    'addressDetail','regionCity','regionDist','isSoleProprietor','soleBusinessName',
    'soleBusinessNo','soleBusinessType','b2bCategory','companyName','businessRegNo',
    'contactTitle','industry','companyAddress','companyPhone',
    'hasVehicle','vehicleMaker','vehicleName','vehicleYear','totalMileage',
    'truckType1','truckType2','truckType3',
    'shipperName','cargoType','deliveryCity','deliveryDist','deliveryFreq',
    'workShift','monthlyIncome','cargoNote',
    'customerSegment','customerCategory','source','referrer','leadType','assignee','memo',
  ] as const

  for (const f of fields) {
    const ka = keep  as Record<string, unknown>
    const ra = remove as Record<string, unknown>
    if ((ka[f] === null || ka[f] === undefined) && ra[f] != null) {
      mergeData[f] = ra[f]
    }
  }

  if (Object.keys(mergeData).length > 0) {
    await prisma.customer.update({ where: { id: keepId }, data: mergeData })
  }

  /* 4. 제거 고객 삭제 */
  await prisma.customer.delete({ where: { id: removeId } })

  return NextResponse.json({
    ok:              true,
    movedLeads:      movedLeads.count,
    movedActivities: movedActivities.count,
    mergedFields:    Object.keys(mergeData),
    message:         `'${remove.name}' 고객이 '${keep.name}'으로 통합되었습니다`,
  })
}
