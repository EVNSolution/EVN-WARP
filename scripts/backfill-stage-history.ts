/**
 * StageHistory 소급 백필 (1회성이지만 idempotent — 여러 번 실행해도 안전)
 * 실행: npx tsx scripts/backfill-stage-history.ts
 *
 * 이미 StageHistory 로그 기능 도입 이전부터 존재하던 SalesDeal에는
 * 과거 단계 이동 경로가 없다. 소급 복원이 불가능하므로, 아직 이력이
 * 하나도 없는 딜에 한해 "현재 단계"를 baseline 1건으로 남겨
 * 이후부터의 변경은 정상 추적되도록 한다.
 */
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const deals = await prisma.salesDeal.findMany({
    where: { stageCode: { not: null } },
    select: { id: true, stageCode: true, stageChangedAt: true, createdAt: true },
  })

  let created = 0
  let skipped = 0

  for (const d of deals) {
    const existing = await prisma.$queryRaw<{ cnt: number }[]>`
      SELECT COUNT(*) as cnt FROM "StageHistory" WHERE "dealId" = ${d.id}
    `
    if (Number(existing[0]?.cnt ?? 0) > 0) { skipped++; continue }

    const id = crypto.randomUUID()
    const changedAt = (d.stageChangedAt ?? d.createdAt).toISOString()
    await prisma.$executeRaw`
      INSERT INTO "StageHistory" (id, "dealId", "fromStageCode", "toStageCode", "changedBy", "changedAt")
      VALUES (${id}, ${d.id}, NULL, ${d.stageCode}, '백필', ${changedAt})
    `
    created++
  }

  console.log(`백필 완료: 신규 ${created}건, 이미 이력 있어 건너뜀 ${skipped}건`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
