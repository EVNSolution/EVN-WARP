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
  if (!(await canManageUsers((session?.user as any)?.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { name, email, role, teamId, teamId2, teamId3, password, nickname, position, ssnFront, ssnBack, address, hireDate, phone, employmentType, externalRole } = body

  const data: Record<string, unknown> = {}
  if (name)              data.name     = name.trim()
  if (email?.trim())     data.email    = email.trim()
  if (role)              data.role     = role
  // 팀(최대 3) — 하나라도 오면 현재 값과 합쳐 중복 제거·앞당김(팀2 없이 팀3만 있는 상태 방지) 후 저장
  if (teamId !== undefined || teamId2 !== undefined || teamId3 !== undefined) {
    const cur = await prisma.user.findUnique({ where: { id }, select: { teamId: true, teamId2: true, teamId3: true } })
    const pick = (v: unknown, fallback: string | null) => (v !== undefined ? ((v as string) || null) : fallback)
    const trio = [pick(teamId, cur?.teamId ?? null), pick(teamId2, cur?.teamId2 ?? null), pick(teamId3, cur?.teamId3 ?? null)]
    const compact = [...new Set(trio.filter((t): t is string => !!t))]
    data.teamId  = compact[0] ?? null
    data.teamId2 = compact[1] ?? null
    data.teamId3 = compact[2] ?? null
  }
  if (password?.trim())  data.password = await bcrypt.hash(password, 12)
  if (nickname !== undefined) data.nickname = nickname || null
  if (position !== undefined) data.position = position || null
  if (ssnFront !== undefined) data.ssnFront = ssnFront || null
  if (ssnBack  !== undefined) data.ssnBack  = ssnBack || null
  if (address  !== undefined) data.address  = address || null
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
      teamId2: true, team2: { select: { name: true } },
      teamId3: true, team3: { select: { name: true } },
      nickname: true, position: true, ssnFront: true, ssnBack: true, address: true, hireDate: true, phone: true,
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
  if (!(await canManageUsers((session?.user as any)?.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
