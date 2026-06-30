import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import fs from 'fs'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

function parseDate(s: string | null): Date | null {
  if (!s) return null
  // formats: yyyy-mm-dd  or  yyyy.mm.dd
  const clean = s.replace(/\./g, '-').trim()
  const d = new Date(clean)
  return isNaN(d.getTime()) ? null : d
}

async function main() {
  const jsonPath = path.join(__dirname, 'deals-seed.json')
  const raw = fs.readFileSync(jsonPath, 'utf-8').replace(/^﻿/, '')
  const deals = JSON.parse(raw) as Record<string, unknown>[]

  // 기존 데이터 삭제 후 재임포트
  await prisma.salesDeal.deleteMany()
  console.log('기존 데이터 초기화 완료')

  let ok = 0
  for (const d of deals) {
    try {
      await prisma.salesDeal.create({
        data: {
          stage:           (d.stage           as string) || '리드',
          name:            (d.name            as string),
          phone:           (d.phone           as string | null) ?? null,
          leadType:        (d.leadType        as string | null) ?? null,
          source:          (d.source          as string | null) ?? null,
          collectedAt:     parseDate(d.collectedAt      as string | null),
          referrer:        (d.referrer        as string | null) ?? null,
          phoneConsultedAt:parseDate(d.phoneConsultedAt as string | null),
          currentVehicle:  (d.currentVehicle  as string | null) ?? null,
          tradeIn:         (d.tradeIn         as string | null) ?? null,
          switchReason:    (d.switchReason    as string | null) ?? null,
          purchaseTiming:  (d.purchaseTiming  as string | null) ?? null,
          faceConsultedAt: parseDate(d.faceConsultedAt  as string | null),
          customerType:    (d.customerType    as string | null) ?? null,
          purchaseMethod:  (d.purchaseMethod  as string | null) ?? null,
          capitalResult:   (d.capitalResult   as string | null) ?? null,
          contractedAt:    parseDate(d.contractedAt     as string | null),
          deliveredAt:     parseDate(d.deliveredAt      as string | null),
          vehicleModel:    (d.vehicleModel    as string | null) ?? null,
          vehicleCount:    (d.vehicleCount    as number | null) ?? null,
          bodyType:        (d.bodyType        as string | null) ?? null,
          tempType:        (d.tempType        as string | null) ?? null,
          bodyOptions:     (d.bodyOptions     as string | null) ?? null,
          vehiclePrice:    (d.vehiclePrice    as number | null) ?? null,
          totalPrice:      (d.totalPrice      as number | null) ?? null,
          downPayment:     (d.downPayment     as number | null) ?? null,
          monthlyPayment:  (d.monthlyPayment  as number | null) ?? null,
          loanMonths:      (d.loanMonths      as number | null) ?? null,
          birthYear:       (d.birthYear       as number | null) ?? null,
          regionCity:      (d.regionCity      as string | null) ?? null,
          regionDist:      (d.regionDist      as string | null) ?? null,
          memo:            (d.memo            as string | null) ?? null,
        },
      })
      ok++
    } catch (e) {
      console.error(`오류: ${d.name}`, e)
    }
  }

  console.log(`임포트 완료: ${ok}/${deals.length} 건`)
  const counts = await prisma.salesDeal.groupBy({ by: ['stage'], _count: { stage: true } })
  counts.sort((a, b) => b._count.stage - a._count.stage)
  for (const c of counts) console.log(`  ${c.stage}: ${c._count.stage}건`)
}

main().finally(() => prisma.$disconnect())
