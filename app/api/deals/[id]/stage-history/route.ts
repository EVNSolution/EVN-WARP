import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rows = await prisma.$queryRaw<
    { id: string; fromStageCode: string | null; toStageCode: string; changedBy: string | null; changedAt: Date }[]
  >`
    SELECT id, "fromStageCode", "toStageCode", "changedBy", "changedAt"
    FROM "StageHistory"
    WHERE "dealId" = ${id}
    ORDER BY "changedAt" DESC
  `
  return NextResponse.json(rows)
}
