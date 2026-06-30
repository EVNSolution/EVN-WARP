import { prisma } from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const week = searchParams.get('week')
  const teamId = searchParams.get('teamId')

  const where: Record<string, unknown> = {}
  if (week) where.week = week
  if (teamId && teamId !== 'all') where.teamId = teamId

  const updates = await prisma.weeklyUpdate.findMany({
    where,
    include: {
      task: { include: { team: true } },
      team: true,
    },
    orderBy: [{ teamId: 'asc' }, { createdAt: 'asc' }],
  })
  return Response.json(updates)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { taskId, teamId, week, weekStart, status, completed, planned, mentions } = body

  const existing = await prisma.weeklyUpdate.findFirst({ where: { taskId, week } })
  if (existing) {
    return Response.json({ error: '이미 이 과제의 주간보고가 등록되어 있습니다.' }, { status: 409 })
  }

  const update = await prisma.weeklyUpdate.create({
    data: {
      taskId,
      teamId,
      week,
      weekStart: new Date(weekStart),
      status: status ?? '정상',
      completed: completed || null,
      planned: planned || null,
      mentions: mentions || null,
    },
    include: { task: true, team: true },
  })
  return Response.json(update, { status: 201 })
}
