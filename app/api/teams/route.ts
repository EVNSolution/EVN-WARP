import { prisma } from '@/lib/db'

export async function GET() {
  const teams = await prisma.team.findMany({ orderBy: { name: 'asc' } })
  return Response.json(teams)
}

export async function POST(req: Request) {
  const { name } = await req.json()
  const team = await prisma.team.create({ data: { name } })
  return Response.json(team, { status: 201 })
}
