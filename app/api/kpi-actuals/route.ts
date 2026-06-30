import { prisma } from '@/lib/db'
import { NextRequest } from 'next/server'

// GET /api/kpi-actuals?taskId=xxx&week=2026-W24
// Returns { items: KpiItem[], actuals: KpiActual[] }
export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId')
  const week = req.nextUrl.searchParams.get('week')

  if (!taskId || !week) {
    return Response.json({ error: 'taskId and week are required' }, { status: 400 })
  }

  const [items, actuals] = await Promise.all([
    prisma.kpiItem.findMany({
      where: { taskId },
      orderBy: { index: 'asc' },
    }),
    prisma.kpiActual.findMany({
      where: { taskId, week },
    }),
  ])

  return Response.json({ items, actuals })
}

// POST /api/kpi-actuals
// Body: { items: Array<{ kpiItemId, taskId, week, actual, actualNum? }> }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { items } = body as {
    items: Array<{ kpiItemId: string; taskId: string; week: string; actual: string; actualNum?: number | null }>
  }

  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'items array required' }, { status: 400 })
  }

  const results = await Promise.all(
    items.map(item =>
      prisma.kpiActual.upsert({
        where: { kpiItemId_week: { kpiItemId: item.kpiItemId, week: item.week } },
        create: {
          kpiItemId: item.kpiItemId,
          taskId: item.taskId,
          week: item.week,
          actual: item.actual,
          actualNum: item.actualNum ?? null,
        },
        update: {
          actual: item.actual,
          actualNum: item.actualNum ?? null,
        },
      })
    )
  )

  return Response.json(results)
}
