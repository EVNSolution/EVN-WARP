import { prisma } from '@/lib/db'
import { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const update = await prisma.weeklyUpdate.findUnique({
    where: { id },
    include: {
      task: { include: { team: true } },
      team: true,
    },
  })
  if (!update) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(update)
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const body = await req.json()

  const data: Record<string, unknown> = {}
  if ('status' in body)    data.status    = body.status
  if ('completed' in body) data.completed = body.completed || null
  if ('planned'   in body) data.planned   = body.planned   || null
  if ('mentions'  in body) data.mentions  = body.mentions  || null

  const update = await prisma.weeklyUpdate.update({
    where: { id },
    data,
    include: { task: true, team: true },
  })
  return Response.json(update)
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  await prisma.weeklyUpdate.delete({ where: { id } })
  return Response.json({ ok: true })
}
