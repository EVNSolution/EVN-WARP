import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canManageUsers } from '@/lib/permissions'
import bcrypt from 'bcryptjs'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const [body, session] = await Promise.all([req.json(), auth()])
  if (!canManageUsers(session?.user as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { name, email, role, teamId, password, nickname, position, ssnFront, hireDate, phone, employmentType, externalRole } = body

  const data: Record<string, unknown> = {}
  if (name)              data.name     = name.trim()
  if (email?.trim())     data.email    = email.trim()
  if (role)              data.role     = role
  if (teamId !== undefined) data.teamId = teamId || null
  if (password?.trim())  data.password = await bcrypt.hash(password, 12)
  if (nickname !== undefined) data.nickname = nickname || null
  if (position !== undefined) data.position = position || null
  if (ssnFront !== undefined) data.ssnFront = ssnFront || null
  if (hireDate !== undefined) data.hireDate = hireDate ? new Date(hireDate) : null
  if (phone    !== undefined) data.phone    = phone || null
  if (employmentType !== undefined) {
    data.employmentType = employmentType === '사외' ? '사외' : '사내'
    data.externalRole   = employmentType === '사외' ? (externalRole || null) : null
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true, name: true, email: true, role: true, teamId: true,
      team: { select: { name: true } },
      nickname: true, position: true, ssnFront: true, hireDate: true, phone: true,
      employmentType: true, externalRole: true,
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
  const session = await auth()
  if (!canManageUsers(session?.user as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
