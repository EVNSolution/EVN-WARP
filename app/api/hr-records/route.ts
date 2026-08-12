import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canManageUsers } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json([], { status: 401 })

  const url    = new URL(req.url)
  const userId = url.searchParams.get('userId')
  const isManager = await canManageUsers(me.id)

  // 본인 기록만 볼 수 있는 일반 사용자는 userId를 자기 자신으로 강제
  const targetUserId = isManager ? (userId || me.id) : me.id

  const records = await prisma.hrRecord.findMany({
    where: { userId: targetUserId },
    orderBy: { effectiveDate: 'desc' },
  })
  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  const [body, session] = await Promise.all([req.json(), auth()])
  const me = session?.user as any
  if (!(await canManageUsers(me?.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, userName, type, title, detail, effectiveDate } = body
  if (!userId || !userName || !type || !title?.trim() || !effectiveDate) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })
  }

  const record = await prisma.hrRecord.create({
    data: {
      userId, userName, type,
      title:         title.trim(),
      detail:        detail || null,
      effectiveDate,
      createdByName: me.name ?? '관리자',
    },
  })
  return NextResponse.json(record, { status: 201 })
}
