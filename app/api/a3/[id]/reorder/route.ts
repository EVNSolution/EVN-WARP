import { prisma } from '@/lib/db'
import { NextRequest } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { direction } = await req.json()
  if (direction !== 'up' && direction !== 'down') {
    return Response.json({ error: 'direction은 up 또는 down이어야 합니다.' }, { status: 400 })
  }

  const task = await prisma.strategyTask.findUnique({ where: { id }, select: { parentId: true, subSeq: true } })
  if (!task || task.parentId == null || task.subSeq == null) {
    return Response.json({ error: '순서를 변경할 수 없는 과제입니다.' }, { status: 400 })
  }

  const siblings = await prisma.strategyTask.findMany({
    where: { parentId: task.parentId },
    orderBy: { subSeq: 'asc' },
    select: { id: true, subSeq: true },
  })
  const idx = siblings.findIndex(s => s.id === id)
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (idx === -1 || swapIdx < 0 || swapIdx >= siblings.length) {
    return Response.json({ error: '더 이상 이동할 수 없습니다.' }, { status: 400 })
  }

  const target = siblings[idx]
  const swap   = siblings[swapIdx]
  await prisma.$transaction([
    prisma.strategyTask.update({ where: { id: target.id }, data: { subSeq: swap.subSeq } }),
    prisma.strategyTask.update({ where: { id: swap.id },   data: { subSeq: target.subSeq } }),
  ])

  return Response.json({ ok: true })
}
