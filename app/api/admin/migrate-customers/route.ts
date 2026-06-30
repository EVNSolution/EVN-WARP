import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * POST /api/admin/migrate-customers
 * 모든 SalesDeal의 CRM 데이터를 Customer 테이블(단일 소스)로 이전.
 * - customerId 없는 딜: Customer 신규 생성 후 연결
 * - customerId 있는 딜: Customer의 빈 필드를 SalesDeal 값으로 채움 (합집합)
 */
export async function POST() {
  try {
    const deals = await prisma.salesDeal.findMany()

    let created = 0
    let merged = 0

    for (const deal of deals) {
      if (!deal.customerId) {
        // Customer 없는 딜 → 신규 생성 후 연결
        const customer = await prisma.customer.create({
          data: {
            name:             deal.name,
            phone:            deal.phone            || null,
            email:            (deal as never as Record<string, string | null>)['email']            || null,
            customerSegment:  (deal as never as Record<string, string | null>)['customerSegment']  || null,
            customerCategory: (deal as never as Record<string, string | null>)['customerCategory'] || null,
            status:           '잠재고객',
            source:           deal.source           || null,
            collectedAt:      deal.collectedAt      || null,
            referrer:         deal.referrer         || null,
            leadType:         deal.leadType         || null,
            assignee:         deal.assignee         || null,
            memo:             deal.memo             || null,
            regionCity:       deal.regionCity       || null,
            regionDist:       deal.regionDist       || null,
            gender:           (deal as never as Record<string, string | null>)['gender']           || null,
            birthInfo:        (deal as never as Record<string, string | null>)['birthInfo']        || null,
            maritalStatus:    (deal as never as Record<string, string | null>)['maritalStatus']    || null,
            childrenCount:    (deal as never as Record<string, number | null>)['childrenCount']    ?? null,
            addressDetail:    (deal as never as Record<string, string | null>)['addressDetail']    || null,
            isSoleProprietor: (deal as never as Record<string, boolean | null>)['isSoleProprietor'] ?? null,
            soleBusinessName: (deal as never as Record<string, string | null>)['soleBusinessName'] || null,
            soleBusinessNo:   (deal as never as Record<string, string | null>)['soleBusinessNo']   || null,
            soleBusinessType: (deal as never as Record<string, string | null>)['soleBusinessType'] || null,
            b2bCategory:      (deal as never as Record<string, string | null>)['b2bCategory']      || null,
            companyName:      (deal as never as Record<string, string | null>)['companyName']      || null,
            businessRegNo:    (deal as never as Record<string, string | null>)['businessRegNo']    || null,
            contactTitle:     (deal as never as Record<string, string | null>)['contactTitle']     || null,
            industry:         (deal as never as Record<string, string | null>)['industry']         || null,
            companyAddress:   (deal as never as Record<string, string | null>)['companyAddress']   || null,
            companyPhone:     (deal as never as Record<string, string | null>)['companyPhone']     || null,
            vehicleMaker:     (deal as never as Record<string, string | null>)['vehicleMaker']     || null,
            vehicleName:      (deal as never as Record<string, string | null>)['vehicleName']      || null,
            vehicleYear:      (deal as never as Record<string, string | null>)['vehicleYear']      || null,
            totalMileage:     (deal as never as Record<string, number | null>)['totalMileage']     ?? null,
            truckType1:       (deal as never as Record<string, string | null>)['truckType1']       || null,
            truckType2:       (deal as never as Record<string, string | null>)['truckType2']       || null,
            truckType3:       (deal as never as Record<string, string | null>)['truckType3']       || null,
            truckType4:       (deal as never as Record<string, string | null>)['truckType4']       || null,
            shipperName:      (deal as never as Record<string, string | null>)['shipperName']      || null,
            cargoType:        (deal as never as Record<string, string | null>)['cargoType']        || null,
            deliveryCity:     (deal as never as Record<string, string | null>)['deliveryCity']     || null,
            deliveryDist:     (deal as never as Record<string, string | null>)['deliveryDist']     || null,
            deliveryFreq:     (deal as never as Record<string, string | null>)['deliveryFreq']     || null,
            workShift:        (deal as never as Record<string, string | null>)['workShift']        || null,
            monthlyIncome:    (deal as never as Record<string, string | null>)['monthlyIncome']    || null,
            cargoNote:        (deal as never as Record<string, string | null>)['cargoNote']        || null,
          },
        })
        await prisma.salesDeal.update({
          where: { id: deal.id },
          data:  { customerId: customer.id },
        })
        created++
      } else {
        // 기존 Customer 있는 딜 → 빈 필드를 SalesDeal 값으로 채움 (합집합)
        const c = await prisma.customer.findUnique({ where: { id: deal.customerId } })
        if (!c) continue

        const d = deal as never as Record<string, unknown>
        const patch: Record<string, unknown> = {}

        const strField = (key: string) => {
          if (!c[key as keyof typeof c] && d[key]) patch[key] = d[key]
        }
        const numField = (key: string) => {
          if (c[key as keyof typeof c] == null && d[key] != null) patch[key] = d[key]
        }
        const boolField = (key: string) => {
          if (c[key as keyof typeof c] == null && d[key] != null) patch[key] = d[key]
        }

        strField('phone'); strField('email'); strField('customerSegment'); strField('customerCategory')
        strField('source'); strField('referrer'); strField('leadType'); strField('assignee'); strField('memo')
        strField('regionCity'); strField('regionDist')
        strField('gender'); strField('birthInfo'); strField('maritalStatus'); strField('addressDetail')
        strField('soleBusinessName'); strField('soleBusinessNo'); strField('soleBusinessType')
        strField('b2bCategory'); strField('companyName'); strField('businessRegNo')
        strField('contactTitle'); strField('industry'); strField('companyAddress'); strField('companyPhone')
        strField('vehicleMaker'); strField('vehicleName'); strField('vehicleYear')
        strField('truckType1'); strField('truckType2'); strField('truckType3'); strField('truckType4')
        strField('shipperName'); strField('cargoType')
        strField('deliveryCity'); strField('deliveryDist'); strField('deliveryFreq')
        strField('workShift'); strField('monthlyIncome'); strField('cargoNote')
        numField('childrenCount'); numField('totalMileage')
        boolField('isSoleProprietor')
        if (!c.collectedAt && (d['collectedAt'] as Date | null)) patch['collectedAt'] = d['collectedAt']

        if (Object.keys(patch).length > 0) {
          await prisma.customer.update({ where: { id: c.id }, data: patch })
          merged++
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: `마이그레이션 완료: 신규 생성 ${created}건, 필드 병합 ${merged}건`,
      created,
      merged,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '마이그레이션 실패', detail: String(e) }, { status: 500 })
  }
}
