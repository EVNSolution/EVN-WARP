import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import ActivityForm from '@/components/ActivityForm'

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [activity, teams, tasks, users] = await Promise.all([
    prisma.workActivity.findUnique({ where: { id } }),
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.strategyTask.findMany({
      where:   { suspended: false },
      select:  { id: true, code: true, title: true, teamId: true, strategy: true, parentId: true,
        kpiItems:        { where: { type: '정량' }, select: { id: true, label: true, unit: true, taskId: true }, orderBy: { index: 'asc' } },
        countermeasures: { select: { id: true, index: true, description: true }, orderBy: { index: 'asc' } } },
      orderBy: [{ teamId: 'asc' }, { teamSeq: 'asc' }],
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } }),
  ])

  if (!activity) notFound()

  const isOverseas = activity.type === '해외출장'

  return (
    <ActivityForm
      teams={teams}
      tasks={tasks}
      users={users}
      mode="edit"
      expensePrintUrl={!isOverseas ? `/notes/${id}/expense-print` : undefined}
      initial={{
        id:        activity.id,
        userId:    activity.userId    ?? '',
        userName:  activity.userName  ?? '',
        taskId:    activity.taskId ?? null,
        teamId:    activity.teamId,
        date:      activity.date,
        endDate:   activity.endDate ?? '',
        type:      activity.type,
        title:     activity.title,
        content:   activity.content  ?? '',
        mentions:  activity.mentions ?? '',
        kpiItemId:        activity.kpiItemId        ?? '',
        kpiWeek:          activity.kpiWeek           ?? '',
        countermeasureId: activity.countermeasureId  ?? '',
        planStatus:       activity.planStatus        ?? '계획',
        referenceUrl:     activity.referenceUrl      ?? '',
        expenseTransport:        (activity as any).expenseTransport        ?? null,
        expenseAccomm:           (activity as any).expenseAccomm           ?? null,
        expenseMeal:             (activity as any).expenseMeal             ?? null,
        expenseOther:            (activity as any).expenseOther            ?? null,
        expenseNote:             (activity as any).expenseNote             ?? '',
        expenseTransportReceipt: (activity as any).expenseTransportReceipt ?? '',
        expenseAccommReceipt:    (activity as any).expenseAccommReceipt    ?? '',
        expenseMealReceipt:      (activity as any).expenseMealReceipt      ?? '',
        expenseOtherReceipt:     (activity as any).expenseOtherReceipt     ?? '',
      }}
      returnUrl="/notes"
    />
  )
}
