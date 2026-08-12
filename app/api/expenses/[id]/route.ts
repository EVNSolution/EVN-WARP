import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canManageUsers } from '@/lib/permissions'
import { createNotification } from '@/lib/createNotification'

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

  if (activity.userId) {
    await createNotification({
      userId:  activity.userId,
      type:    status === '승인' ? 'expense_approved' : 'expense_rejected',
      message: status === '승인'
        ? `[${activity.title}] 비용 신청이 승인되었습니다`
        : `[${activity.title}] 비용 신청이 반려되었습니다${approverNote ? ` (사유: ${approverNote})` : ''}`,
      link: `/notes/${activity.id}/edit`,
    })
  }

  return NextResponse.json(activity)
}
