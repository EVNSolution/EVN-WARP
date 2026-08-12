import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { canManageUsers } from '@/lib/permissions'
import FinanceClient from './FinanceClient'

const HAS_EXPENSE = {
  OR: [
    { expenseTransport: { not: null } },
    { expenseAccomm:    { not: null } },
    { expenseMeal:       { not: null } },
    { expenseOther:      { not: null } },
  ],
}

export default async function FinancePage() {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) redirect('/login')

  const isManager = await canManageUsers(me.id)
  if (!isManager) redirect('/dashboard')

  const now = new Date()
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [pendingActivities, statsActivities] = await Promise.all([
    prisma.workActivity.findMany({
      where: { ...HAS_EXPENSE, expenseStatus: '신청' },
      include: { team: { select: { name: true } }, task: { select: { code: true, title: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.workActivity.findMany({
      where: { ...HAS_EXPENSE, date: { gte: from, lte: to } },
      include: { team: { select: { name: true } } },
    }),
  ])

  const byCategory = { transport: 0, accomm: 0, meal: 0, other: 0 }
  const byTeam   = new Map<string, { total: number; count: number }>()
  const byMethod = new Map<string, { total: number; count: number }>()
  const byStatus = new Map<string, number>()
  let linkedTotal = 0, linkedCount = 0, unlinkedTotal = 0, unlinkedCount = 0

  for (const a of statsActivities) {
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

    if (a.taskId) { linkedTotal += t; linkedCount += 1 } else { unlinkedTotal += t; unlinkedCount += 1 }
  }

  const initialStats = {
    total: byCategory.transport + byCategory.accomm + byCategory.meal + byCategory.other,
    count: statsActivities.length,
    byCategory,
    byTeam:   [...byTeam.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total),
    byMethod: [...byMethod.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total),
    byStatus: [...byStatus.entries()].map(([name, count]) => ({ name, count })),
    byTaskLinkage: {
      linked:   { total: linkedTotal,   count: linkedCount },
      unlinked: { total: unlinkedTotal, count: unlinkedCount },
    },
  }

  return (
    <FinanceClient
      initialPending={JSON.parse(JSON.stringify(pendingActivities))}
      initialStats={initialStats}
      initialFrom={from}
      initialTo={to}
    />
  )
}
