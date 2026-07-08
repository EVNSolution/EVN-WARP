import { prisma } from '@/lib/db'

export async function GET() {
  const teams = await prisma.team.findMany({ orderBy: { name: 'asc' } })
  return Response.json(teams)
}

export async function POST(req: Request) {
  const { name } = await req.json()
  if (!name?.trim()) return Response.json({ error: '팀 이름을 입력하세요.' }, { status: 400 })
  const trimmed = name.trim()
  const existing = await prisma.team.findFirst({ where: { name: trimmed } })
  if (existing) return Response.json({ error: `"${trimmed}" 팀이 이미 존재합니다.` }, { status: 409 })
  const team = await prisma.team.create({ data: { name: trimmed } })
  return Response.json(team, { status: 201 })
}
