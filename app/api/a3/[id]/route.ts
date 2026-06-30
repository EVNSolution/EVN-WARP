import { prisma } from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/a3/[id]'>) {
  const { id } = await ctx.params
  const task = await prisma.strategyTask.findUnique({
    where: { id },
    include: {
      team: true,
      parent: { include: { team: true } },
      subTasks: {
        include: { team: true },
        orderBy: { subSeq: 'asc' },
      },
      kpiItems: { orderBy: { index: 'asc' } },
      monthlyTargets: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
      countermeasures: { orderBy: { index: 'asc' } },
      weeklyUpdates: { orderBy: { weekStart: 'desc' } },
    },
  })
  if (!task) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(task)
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/a3/[id]'>) {
  const { id } = await ctx.params
  const body = await req.json()
  const {
    strategy, title, teamId, owner,
    startDate, endDate, status, confirmed,
    problemStatement, goalStatement,
    kpiItems, monthlyTargets, countermeasures,
    suspended, suspendedAt, suspendReason,
  } = body

  await prisma.strategyTask.update({
    where: { id },
    data: {
      ...(strategy     !== undefined && { strategy }),
      ...(title        !== undefined && { title }),
      ...(teamId       !== undefined && { teamId }),
      ...(owner        !== undefined && { owner }),
      ...(startDate    !== undefined && { startDate: new Date(startDate) }),
      ...(endDate      !== undefined && { endDate: new Date(endDate) }),
      ...(status       !== undefined && { status }),
      ...(confirmed    !== undefined && { confirmed }),
      ...(problemStatement  !== undefined && { problemStatement }),
      ...(goalStatement     !== undefined && { goalStatement }),
      ...(suspended    !== undefined && { suspended }),
      ...(suspendedAt  !== undefined && { suspendedAt: suspendedAt ? new Date(suspendedAt) : null }),
      ...(suspendReason !== undefined && { suspendReason: suspendReason || null }),
    },
  })

  if (kpiItems !== undefined) {
    await prisma.kpiItem.deleteMany({ where: { taskId: id } })
    if (kpiItems.length > 0) {
      await prisma.kpiItem.createMany({
        data: kpiItems.map((k: any, i: number) => ({
          taskId: id,
          index: i + 1,
          type: k.type,
          subType: k.subType || null,
          label: k.label,
          target: k.target,
          targetNum: k.targetNum ?? null,
          unit: k.unit || null,
        })),
      })
    }
  }

  if (monthlyTargets) {
    await prisma.monthlyTarget.deleteMany({ where: { taskId: id } })
    await prisma.monthlyTarget.createMany({
      data: monthlyTargets.map((m: any) => ({
        taskId: id, month: m.month, year: m.year,
        revenueTarget: m.revenueTarget ?? null,
        budget:        m.budget        ?? null,
        personnel:     m.personnel     ?? null,
      })),
    })
  }

  if (countermeasures) {
    await prisma.countermeasure.deleteMany({ where: { taskId: id } })
    await prisma.countermeasure.createMany({
      data: countermeasures.map((c: any) => ({
        taskId: id, index: c.index, description: c.description,
        startDate: c.startDate ?? null,
        endDate:   c.endDate   ?? null,
      })),
    })
  }

  const updated = await prisma.strategyTask.findUnique({
    where: { id },
    include: { team: true, kpiItems: true, monthlyTargets: true, countermeasures: true, subTasks: true },
  })
  return Response.json(updated)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/a3/[id]'>) {
  const { id } = await ctx.params
  const subCount = await prisma.strategyTask.count({ where: { parentId: id } })
  if (subCount > 0) {
    return Response.json({ error: '하부 과제가 있는 과제는 삭제할 수 없습니다. 먼저 하부 과제를 삭제해주세요.' }, { status: 400 })
  }
  await prisma.strategyTask.delete({ where: { id } })
  return Response.json({ ok: true })
}
