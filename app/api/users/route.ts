import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true, teamId: true,
      team: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, password, role, teamId } = body

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
      name:     name.trim(),
      email:    email.trim().toLowerCase(),
      password: hash,
      role:     role || 'user',
      teamId:   teamId || null,
    },
    select: {
      id: true, name: true, email: true, role: true, teamId: true,
      team: { select: { name: true } },
      createdAt: true,
    },
  })
  return NextResponse.json(user, { status: 201 })
}
