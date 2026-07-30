import { prisma } from '@/lib/db'

// PATCH /api/a3/[id]/team-summary — 최상위 전략과제 하위, 팀별 전략 요약 저장
// teamSummaries는 최상위 과제(parentId: null)에만 JSON({ [teamId]: summary })으로 저장된다.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { teamId, summary } = await req.json()
  if (!teamId) return Response.json({ error: 'teamId is required' }, { status: 400 })

  const task = await prisma.strategyTask.findUnique({ where: { id }, select: { teamSummaries: true } })
  if (!task) return Response.json({ error: 'Not found' }, { status: 404 })

  const map: Record<string, string> = task.teamSummaries ? JSON.parse(task.teamSummaries) : {}
  const trimmed = (summary ?? '').trim()
  if (trimmed) map[teamId] = trimmed
  else delete map[teamId]

  const updated = await prisma.strategyTask.update({
    where: { id },
    data: { teamSummaries: Object.keys(map).length > 0 ? JSON.stringify(map) : null },
  })
  return Response.json({ teamSummaries: updated.teamSummaries })
}
