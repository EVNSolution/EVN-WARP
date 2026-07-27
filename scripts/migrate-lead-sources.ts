/**
 * 리드 유입경로(SalesDeal.source) 값 통일 마이그레이션
 * 실행: npx tsx scripts/migrate-lead-sources.ts
 *
 * 신규 옵션: 자체발굴 / 온라인 / 오프라인 / 소개인 / 기타
 * - SNS         → 온라인
 * - 전시회, 로드쇼 → 오프라인
 * - Agent       → 소개인 (레거시 값 정규화)
 * - 소개, 인바운드 → 삭제(null)
 */
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const r1 = await prisma.$executeRaw`UPDATE "SalesDeal" SET "source" = '온라인' WHERE "source" = 'SNS'`
  const r2 = await prisma.$executeRaw`UPDATE "SalesDeal" SET "source" = '오프라인' WHERE "source" IN ('전시회', '로드쇼')`
  const r3 = await prisma.$executeRaw`UPDATE "SalesDeal" SET "source" = '소개인' WHERE "source" = 'Agent'`
  const r4 = await prisma.$executeRaw`UPDATE "SalesDeal" SET "source" = NULL WHERE "source" IN ('소개', '인바운드')`

  console.log(`SNS → 온라인: ${r1}건`)
  console.log(`전시회/로드쇼 → 오프라인: ${r2}건`)
  console.log(`Agent → 소개인: ${r3}건`)
  console.log(`소개/인바운드 → 삭제: ${r4}건`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
