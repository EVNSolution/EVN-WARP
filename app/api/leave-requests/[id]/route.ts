import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canManageUsers } from '@/lib/permissions'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [body, session] = await Promise.all([req.json(), auth()])
  const me = session?.user as any
  if (!(await canManageUsers(me?.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { status, rejectReason } = body
  if (!['승인', '반려'].includes(status)) {
    return NextResponse.json({ error: 'status는 승인 또는 반려여야 합니다.' }, { status: 400 })
  }

  const request = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status,
      approverName: me.name ?? '관리자',
      approvedAt:   new Date(),
      rejectReason: status === '반려' ? (rejectReason || null) : null,
    },
  })
  return NextResponse.json(request)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const target = await prisma.leaveRequest.findUnique({ where: { id }, select: { userId: true, status: true } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isManager = await canManageUsers(me.id)
  if (target.userId !== me.id && !isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (target.status !== '대기' && !isManager) {
    return NextResponse.json({ error: '대기중인 신청만 취소할 수 있습니다.' }, { status: 400 })
  }

  await prisma.leaveRequest.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
