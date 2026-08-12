import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canManageUsers } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!(await canManageUsers((session?.user as any)?.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const from = req.nextUrl.searchParams.get('from') ?? '1970-01-01'
  const to   = req.nextUrl.searchParams.get('to')   ?? '2999-12-31'

  const activities = await prisma.workActivity.findMany({
    where: {
      date: { gte: from, lte: to },
      OR: [
        { expenseTransport: { not: null } },
        { expenseAccomm:    { not: null } },
        { expenseMeal:       { not: null } },
        { expenseOther:      { not: null } },
      ],
    },
    include: { team: { select: { name: true } } },
  })

  const byCategory = { transport: 0, accomm: 0, meal: 0, other: 0 }
  const byTeam    = new Map<string, { total: number; count: number }>()
  const byMethod  = new Map<string, { total: number; count: number }>()
  const byStatus  = new Map<string, number>()
  const byMonth   = new Map<string, number>()
  let linkedTotal = 0, linkedCount = 0, unlinkedTotal = 0, unlinkedCount = 0

  for (const a of activities) {
    const t = (a.expenseTransport ?? 0) + (a.expenseAccomm ?? 0) + (a.expenseMeal ?? 0) + (a.expenseOther ?? 0)
    byCategory.transport += a.expenseTransport ?? 0
    byCategory.accomm    += a.expenseAccomm    ?? 0
    byCategory.meal      += a.expenseMeal      ?? 0
    byCategory.other     += a.expenseOther     ?? 0

    const teamName = a.team?.name ?? '미배정'
    const teamRow = byTeam.get(teamName) ?? { total: 0, count: 0 }
    teamRow.total += t; teamRow.count += 1
    byTeam.set(teamName, teamRow)

    const method = a.expensePaymentMethod ?? '미지정'
    const methodRow = byMethod.get(method) ?? { total: 0, count: 0 }
    methodRow.total += t; methodRow.count += 1
    byMethod.set(method, methodRow)

    const status = a.expenseStatus ?? '미신청'
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1)

    const month = a.date.slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + t)

    if (a.taskId) { linkedTotal += t; linkedCount += 1 } else { unlinkedTotal += t; unlinkedCount += 1 }
  }

  const total = byCategory.transport + byCategory.accomm + byCategory.meal + byCategory.other

  return NextResponse.json({
    total,
    count: activities.length,
    byCategory,
    byTeam:   [...byTeam.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total),
    byMethod: [...byMethod.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total),
    byStatus: [...byStatus.entries()].map(([name, count]) => ({ name, count })),
    byMonth:  [...byMonth.entries()].map(([month, total]) => ({ month, total })).sort((a, b) => a.month.localeCompare(b.month)),
    byTaskLinkage: {
      linked:   { total: linkedTotal,   count: linkedCount },
      unlinked: { total: unlinkedTotal, count: unlinkedCount },
    },
  })
}
