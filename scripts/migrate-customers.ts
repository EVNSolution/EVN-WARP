/**
 * 고객 CRM 데이터 단일소스 마이그레이션
 * 실행: npx tsx scripts/migrate-customers.ts
 *
 * - customerId 없는 딜: Customer 신규 생성 후 연결
 * - customerId 있는 딜: Customer의 빈 필드를 SalesDeal 값으로 채움 (합집합)
 */
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const deals = await prisma.salesDeal.findMany()
  console.log(`총 딜 수: ${deals.length}`)

  let created = 0
  let merged  = 0
  let skipped = 0

  for (const d of deals) {
    const a = d as any

    if (!d.customerId) {
      // ── Customer 없는 딜: 신규 생성 후 연결 ──
      const customer = await prisma.customer.create({
        data: {
          name:             d.name,
          phone:            d.phone             ?? null,
          email:            a.email             ?? null,
          customerSegment:  a.customerSegment   ?? null,
          customerCategory: a.customerCategory  ?? null,
          status:           d.salesStatus === '완료' ? '완료'
                          : d.salesStatus === '이탈' ? '이탈'
                          : '잠재고객',
          source:           d.source            ?? null,
          collectedAt:      d.collectedAt       ?? null,
          referrer:         d.referrer          ?? null,
          leadType:         d.leadType          ?? null,
          assignee:         d.assignee          ?? null,
          memo:             d.memo              ?? null,
          regionCity:       d.regionCity        ?? null,
          regionDist:       d.regionDist        ?? null,
          gender:           a.gender            ?? null,
          birthInfo:        a.birthInfo         ?? null,
          maritalStatus:    a.maritalStatus     ?? null,
          childrenCount:    a.childrenCount     ?? null,
          addressDetail:    a.addressDetail     ?? null,
          isSoleProprietor: a.isSoleProprietor  ?? null,
          soleBusinessName: a.soleBusinessName  ?? null,
          soleBusinessNo:   a.soleBusinessNo    ?? null,
          soleBusinessType: a.soleBusinessType  ?? null,
          b2bCategory:      a.b2bCategory       ?? null,
          companyName:      a.companyName       ?? null,
          businessRegNo:    a.businessRegNo     ?? null,
          contactTitle:     a.contactTitle      ?? null,
          industry:         a.industry          ?? null,
          companyAddress:   a.companyAddress    ?? null,
          companyPhone:     a.companyPhone      ?? null,
          vehicleMaker:     a.vehicleMaker      ?? null,
          vehicleName:      a.vehicleName       ?? null,
          vehicleYear:      a.vehicleYear       ?? null,
          totalMileage:     a.totalMileage      ?? null,
          truckType1:       a.truckType1        ?? null,
          truckType2:       a.truckType2        ?? null,
          truckType3:       a.truckType3        ?? null,
          truckType4:       a.truckType4        ?? null,
          shipperName:      a.shipperName       ?? null,
          cargoType:        a.cargoType         ?? null,
          deliveryCity:     a.deliveryCity      ?? null,
          deliveryDist:     a.deliveryDist      ?? null,
          deliveryFreq:     a.deliveryFreq      ?? null,
          workShift:        a.workShift         ?? null,
          monthlyIncome:    a.monthlyIncome     ?? null,
          cargoNote:        a.cargoNote         ?? null,
        },
      })
      await prisma.salesDeal.update({
        where: { id: d.id },
        data:  { customerId: customer.id },
      })
      console.log(`  [생성] ${d.name}`)
      created++

    } else {
      // ── Customer 있는 딜: 빈 필드를 SalesDeal 값으로 채움 (합집합) ──
      const c = await prisma.customer.findUnique({ where: { id: d.customerId } })
      if (!c) { skipped++; continue }

      const ca = c as any
      const patch: Record<string, unknown> = {}

      // Customer에 없고 SalesDeal에 있는 값만 채움
      const s = (key: string) => { if (!ca[key] && a[key]) patch[key] = a[key] }
      const n = (key: string) => { if (ca[key] == null && a[key] != null) patch[key] = a[key] }

      s('phone'); s('email'); s('customerSegment'); s('customerCategory')
      s('source'); s('referrer'); s('leadType'); s('assignee'); s('memo')
      s('regionCity'); s('regionDist')
      s('gender'); s('birthInfo'); s('maritalStatus'); s('addressDetail')
      s('soleBusinessName'); s('soleBusinessNo'); s('soleBusinessType')
      s('b2bCategory'); s('companyName'); s('businessRegNo')
      s('contactTitle'); s('industry'); s('companyAddress'); s('companyPhone')
      s('vehicleMaker'); s('vehicleName'); s('vehicleYear')
      s('truckType1'); s('truckType2'); s('truckType3'); s('truckType4')
      s('shipperName'); s('cargoType')
      s('deliveryCity'); s('deliveryDist'); s('deliveryFreq')
      s('workShift'); s('monthlyIncome'); s('cargoNote')
      n('childrenCount'); n('totalMileage'); n('isSoleProprietor')
      if (!ca.collectedAt && d.collectedAt) patch['collectedAt'] = d.collectedAt

      if (Object.keys(patch).length > 0) {
        await prisma.customer.update({ where: { id: c.id }, data: patch })
        console.log(`  [병합] ${d.name} — ${Object.keys(patch).join(', ')}`)
        merged++
      } else {
        skipped++
      }
    }
  }

  console.log('\n===========================')
  console.log(`완료: 신규 생성 ${created}건 / 필드 병합 ${merged}건 / 변경 없음 ${skipped}건`)
  console.log('===========================')
}

main()
  .catch(e => { console.error('오류:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
