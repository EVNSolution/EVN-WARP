import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { name, role, teamId, password } = body

  const data: Record<string, unknown> = {}
  if (name)              data.name     = name.trim()
  if (role)              data.role     = role
  if (teamId !== undefined) data.teamId = teamId || null
  if (password?.trim())  data.password = await bcrypt.hash(password, 12)

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true, name: true, email: true, role: true, teamId: true,
      team: { select: { name: true } },
      createdAt: true,
    },
  })
  return NextResponse.json(user)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
