import { prisma } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const team = await prisma.team.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
    },
  })
  return Response.json(team)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.team.delete({ where: { id } })
  return Response.json({ ok: true })
}
