import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canViewAllCardUsage } from '@/lib/permissions'
import { createNotification } from '@/lib/createNotification'
import { parseCardUsageInput } from '@/lib/cardUsageServer'

async function loadWithAccess(id: string) {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) }
  const row = await prisma.cardUsage.findUnique({ where: { id } })
  if (!row) return { error: NextResponse.json({ error: '내역을 찾을 수 없습니다.' }, { status: 404 }) }
  const isManager = await canViewAllCardUsage(me.id)
  if (row.userId !== me.id && !isManager) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { me, row, isManager }
}

// 내역 수정 — 승인된 건은 관리 권한자만 수정, 반려 건은 수정 시 재신청
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadWithAccess(id)
  if ('error' in ctx) return ctx.error
  const { row, isManager } = ctx
  if (row.status === '승인' && !isManager) {
    return NextResponse.json({ error: '승인된 내역은 수정할 수 없습니다.' }, { status: 400 })
  }

  const body = await req.json()
  const input = await parseCardUsageInput({ ...body, activityId: body.activityId ?? row.activityId }, row.userId)
  if (typeof input === 'string') return NextResponse.json({ error: input }, { status: 400 })

  const nextStatus = row.status === '반려' ? '신청' : row.status
  await prisma.$executeRaw`
    UPDATE "CardUsage" SET
      "date" = ${input.date}, "payMethod" = ${input.payMethod},
      "corporateCardId" = ${input.corporateCardId}, "personalCardId" = ${input.personalCardId}, "cardLabel" = ${input.cardLabel},
      "merchant" = ${input.merchant}, "attendees" = ${input.attendees}, "category" = ${input.category},
      "description" = ${input.description}, "amount" = ${input.amount}, "receiptUrl" = ${input.receiptUrl}, "activityId" = ${input.activityId},
      "status" = ${nextStatus}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}`

  return NextResponse.json(await prisma.cardUsage.findUnique({ where: { id } }))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadWithAccess(id)
  if ('error' in ctx) return ctx.error
  if (ctx.row.status === '승인' && !ctx.isManager) {
    return NextResponse.json({ error: '승인된 내역은 삭제할 수 없습니다.' }, { status: 400 })
  }
  await prisma.$executeRaw`DELETE FROM "CardUsage" WHERE "id" = ${id}`
  return NextResponse.json({ ok: true })
}

// 결재 (관리 권한자)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadWithAccess(id)
  if ('error' in ctx) return ctx.error
  if (!ctx.isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { status, approverNote } = await req.json()
  if (!['승인', '반려'].includes(status)) {
    return NextResponse.json({ error: 'status는 승인 또는 반려여야 합니다.' }, { status: 400 })
  }
  const approverName = ctx.me.name ?? '관리자'
  const note = approverNote ? String(approverNote) : null
  await prisma.$executeRaw`
    UPDATE "CardUsage" SET "status" = ${status}, "approverName" = ${approverName}, "approverNote" = ${note},
      "approvedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}`

  const row = ctx.row
  if (row.userId) {
    const what = `${row.date} ${row.merchant} ${row.amount.toLocaleString('ko-KR')}원`
    await createNotification({
      userId:  row.userId,
      type:    status === '승인' ? 'expense_approved' : 'expense_rejected',
      message: status === '승인'
        ? `[카드사용] ${what} 승인되었습니다`
        : `[카드사용] ${what} 반려되었습니다${note ? ` (사유: ${note})` : ''}`,
      link: '/notes',
    })
  }
  return NextResponse.json(await prisma.cardUsage.findUnique({ where: { id } }))
}
