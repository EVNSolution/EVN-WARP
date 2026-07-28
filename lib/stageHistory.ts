import { prisma } from '@/lib/db'

export async function logStageChange({
  dealId, fromStageCode, toStageCode, changedBy,
}: {
  dealId: string
  fromStageCode: string | null
  toStageCode: string
  changedBy?: string | null
}) {
  if (fromStageCode === toStageCode) return
  const id = crypto.randomUUID()
  try {
    await prisma.$executeRaw`
      INSERT INTO "StageHistory" (id, "dealId", "fromStageCode", "toStageCode", "changedBy", "changedAt")
      VALUES (${id}, ${dealId}, ${fromStageCode}, ${toStageCode}, ${changedBy ?? null}, datetime('now'))
    `
  } catch (e) {
    console.error('[StageHistory] log failed:', e)
  }
}
