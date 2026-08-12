import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canManageUsers } from '@/lib/permissions'
import bcrypt from 'bcryptjs'

// GET은 AssigneePicker/UserPicker 등 전 사용자가 담당자 선택용으로 호출 — 민감정보(주민번호 등) 없이
// 사내/사외 구분에 필요한 최소 정보만 노출
const PUBLIC_SELECT_FIELDS = {
  id: true, name: true, role: true, teamId: true,
  team: { select: { name: true } },
  employmentType: true, externalRole: true,
} as const

// POST/PATCH 응답용 — 사용자 관리 권한자에게만 반환됨
const FULL_SELECT_FIELDS = {
  id: true, name: true, email: true, role: true, teamId: true,
  team: { select: { name: true } },
  nickname: true, position: true, ssnFront: true, hireDate: true, phone: true,
  employmentType: true, externalRole: true,
  createdAt: true,
} as const

export async function GET() {
  const users = await prisma.user.findMany({
    select: PUBLIC_SELECT_FIELDS,
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const [body, session] = await Promise.all([req.json(), auth()])
  if (!(await canManageUsers((session?.user as any)?.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { name, email, password, role, teamId, nickname, position, ssnFront, hireDate, phone, employmentType, externalRole } = body

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: '이름, 이메일, 비밀번호는 필수입니다.' }, { status: 400 })
  }

  const exists = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (exists) {
    return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 409 })
  }

  const hash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      name:           name.trim(),
      email:          email.trim().toLowerCase(),
      password:       hash,
      role:           role || 'user',
      teamId:         teamId || null,
      nickname:       nickname || null,
      position:       position || null,
      ssnFront:       ssnFront || null,
      hireDate:       hireDate ? new Date(hireDate) : null,
      phone:          phone || null,
      employmentType: employmentType === '사외' ? '사외' : '사내',
      externalRole:   employmentType === '사외' ? (externalRole || null) : null,
    },
    select: FULL_SELECT_FIELDS,
  })
  return NextResponse.json(user, { status: 201 })
}
