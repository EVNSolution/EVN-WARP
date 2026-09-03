import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canManageUsers } from '@/lib/permissions'

export async function GET() {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json([], { status: 401 })

  const isManager = await canManageUsers(me.id)
  const requests = await prisma.leaveRequest.findMany({
    where: isManager ? undefined : { userId: me.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  const [body, session] = await Promise.all([req.json(), auth()])
  const me = session?.user as any
  if (!me?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, startDate, endDate, days, reason, targetUserId, targetUserName } = body
  if (!type || !startDate || !endDate || !days) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })
  }

  // 경영관리팀/관리자는 타 직원 대신 신청 가능
  let resolvedUserId   = me.id
  let resolvedUserName = me.name ?? '이름 없음'
  if (targetUserId && targetUserId !== me.id) {
    const isManager = await canManageUsers(me.id)
    if (!isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    resolvedUserId   = targetUserId
    resolvedUserName = targetUserName ?? resolvedUserName
  }

  const request = await prisma.leaveRequest.create({
    data: {
      userId:   resolvedUserId,
      userName: resolvedUserName,
      type,
      startDate,
      endDate,
      days:   Number(days),
      reason: reason || null,
    },
  })
  return NextResponse.json(request, { status: 201 })
}
