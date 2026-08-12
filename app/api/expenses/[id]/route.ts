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

  const { status, approverNote } = body
  if (!['승인', '반려'].includes(status)) {
    return NextResponse.json({ error: 'status는 승인 또는 반려여야 합니다.' }, { status: 400 })
  }

  const activity = await prisma.workActivity.update({
    where: { id },
    data: {
      expenseStatus:       status,
      expenseApproverId:   me.id,
      expenseApproverName: me.name ?? '관리자',
      expenseApprovedAt:   new Date(),
      expenseApproverNote: approverNote || null,
    },
  })
  return NextResponse.json(activity)
}
