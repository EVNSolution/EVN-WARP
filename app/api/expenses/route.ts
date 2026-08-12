import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canManageUsers } from '@/lib/permissions'

const HAS_EXPENSE = {
  OR: [
    { expenseTransport: { not: null } },
    { expenseAccomm:    { not: null } },
    { expenseMeal:       { not: null } },
    { expenseOther:      { not: null } },
  ],
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json([], { status: 401 })

  const isManager = await canManageUsers(me.id)
  const status = req.nextUrl.searchParams.get('status')

  const activities = await prisma.workActivity.findMany({
    where: {
      ...HAS_EXPENSE,
      ...(status ? { expenseStatus: status } : {}),
      ...(isManager ? {} : { userId: me.id }),
    },
    include: {
      team: { select: { name: true } },
      task: { select: { code: true, title: true } },
    },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(activities)
}
