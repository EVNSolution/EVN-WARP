import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// PUT /api/agents/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { name, phone, email, company, type, memo } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: '이름은 필수입니다.' }, { status: 400 })
  }

  const agent = await prisma.agent.update({
    where: { id },
    data: {
      name:    name.trim(),
      phone:   phone   || null,
      email:   email   || null,
      company: company || null,
      type:    type    || '외부',
      memo:    memo    || null,
    },
    include: {
      user:     { select: { id: true, name: true, team: { select: { name: true } } } },
      customer: { select: { id: true, name: true } },
      _count:   { select: { deals: true } },
    },
  })

  return NextResponse.json(agent)
}

// DELETE /api/agents/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const agent = await prisma.agent.findUnique({ where: { id }, select: { customerId: true } })

  await prisma.agent.delete({ where: { id } })

  // 연결된 Customer가 있었다면 isAgent 해제
  if (agent?.customerId) {
    await prisma.$executeRaw`UPDATE "Customer" SET "isAgent" = 0 WHERE id = ${agent.customerId}`
  }

  return NextResponse.json({ ok: true })
}
