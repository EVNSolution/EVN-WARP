import { prisma } from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET() {
  const tasks = await prisma.strategyTask.findMany({
    where: { parentId: null },
    include: {
      team: true,
      subTasks: {
        include: { team: true },
        orderBy: { subSeq: 'asc' },
      },
      kpiItems: { orderBy: { index: 'asc' } },
    },
    orderBy: [{ teamId: 'asc' }, { teamSeq: 'asc' }],
  })
  return Response.json(tasks)
}

export async function POST(req: NextRequest) {
  try {
  const body = await req.json()
  console.log('[POST /api/a3] received:', JSON.stringify({ ...body, monthlyTargets: `${body.monthlyTargets?.length} items`, countermeasures: `${body.countermeasures?.length} items` }))
  const {
    strategy, title, teamId, owner,
    startDate, endDate, status, confirmed,
    problemStatement, goalStatement,
    kpiItems = [],
    parentId,
    monthlyTargets = [], countermeasures = [],
  } = body

  const team = await prisma.team.findUnique({ where: { id: teamId } })
  if (!team) return Response.json({ error: '팀을 찾을 수 없습니다' }, { status: 400 })

  let code: string
  let teamSeq: number
  let subSeq: number | null = null

  if (parentId) {
    const [parent, lastByParent, lastByTeam] = await Promise.all([
      prisma.strategyTask.findUnique({ where: { id: parentId } }),
      // subSeq: 이 부모 아래 전체 순번 (등록 순)
      prisma.strategyTask.findFirst({
        where: { parentId },
        orderBy: { subSeq: 'desc' },
      }),
      // teamSeq: 이 팀의 하부과제 독립 채번 (코드용)
      prisma.strategyTask.findFirst({
        where: { teamId, parentId: { not: null } },
        orderBy: { teamSeq: 'desc' },
      }),
    ])
    if (!parent) return Response.json({ error: '상위 과제를 찾을 수 없습니다' }, { status: 400 })
    subSeq = (lastByParent?.subSeq ?? 0) + 1
    teamSeq = (lastByTeam?.teamSeq ?? 0) + 1
    code = `${team.name}-${String(teamSeq).padStart(2, '0')}`
  } else {
    const last = await prisma.strategyTask.findFirst({
      where: { teamId, parentId: null },
      orderBy: { teamSeq: 'desc' },
    })
    teamSeq = (last?.teamSeq ?? 0) + 1
    code = `${team.name}-${String(teamSeq).padStart(2, '0')}`
  }

  const task = await prisma.strategyTask.create({
    data: {
      code, teamSeq, subSeq,
      strategy, title, teamId, owner,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: status ?? '진행중',
      confirmed: confirmed ?? false,
      problemStatement, goalStatement,
      parentId: parentId ?? null,
      kpiItems: {
        create: kpiItems.map((k: any, i: number) => ({
          index: i + 1,
          type: k.type,
          subType: k.subType || null,
          label: k.label,
          target: k.target,
          targetNum: k.targetNum ?? null,
          unit: k.unit || null,
        })),
      },
      monthlyTargets: {
        create: monthlyTargets.map((m: any) => ({
          month: m.month, year: m.year,
          revenueTarget: m.revenueTarget ?? null,
          budget:        m.budget        ?? null,
          personnel:     m.personnel     ?? null,
        })),
      },
      countermeasures: {
        create: countermeasures.map((c: any) => ({
          index: c.index, description: c.description,
          startDate: c.startDate ?? null,
          endDate:   c.endDate   ?? null,
        })),
      },
    },
    include: { team: true, kpiItems: true, monthlyTargets: true, countermeasures: true },
  })
  return Response.json(task, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/a3]', e)
    return Response.json({ error: e?.message ?? '서버 오류' }, { status: 500 })
  }
}
