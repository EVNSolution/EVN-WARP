// 주간업무보고 데이터 — /weekly(주간업무)와 /weekly-report(팀별 보고 화면·인쇄)가 공용으로 사용
import { prisma } from '@/lib/db'
import { getWeekId, getWeekStart, adjacentWeek, formatWeekLabel } from '@/lib/week'
import { teamOrderIndex } from '@/lib/teamOrder'

function isDateRangeActive(start: Date | null, end: Date | null, rangeStart: number, rangeEnd: number): boolean {
  if (!start || !end) return false
  const s = start.getTime()
  const e = end.getTime() + 86400000
  return s < rangeEnd && e > rangeStart
}

function weekDates(weekId: string) {
  const start = getWeekStart(weekId)
  const end   = new Date(start); end.setUTCDate(end.getUTCDate() + 6)
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), startMs: start.getTime(), endMs: start.getTime() + 7 * 86400000 }
}

export async function loadWeeklyReport(weekId: string) {
  const prevWeek = adjacentWeek(weekId, -1)
  const nextWeek = adjacentWeek(weekId, 1)
  const thisW = weekDates(weekId)
  const nextW = weekDates(nextWeek)

  const [tasks, weeklyUpdates, prevWeekUpdates, thisWeekActivities, nextWeekActivities] = await Promise.all([
    prisma.strategyTask.findMany({
      where: { parentId: { not: null }, parent: { parentId: null }, suspended: false },
      include: {
        team: true,
        countermeasures: { orderBy: { index: 'asc' } },
        parent: { select: { id: true, title: true, code: true, strategy: true } },
        subTasks: {
          select: {
            id: true, title: true, startDate: true, endDate: true, owner: true,
            countermeasures: { orderBy: { index: 'asc' } },
          },
          orderBy: { subSeq: 'asc' },
        },
      },
      orderBy: [{ teamId: 'asc' }, { teamSeq: 'asc' }],
    }),
    prisma.weeklyUpdate.findMany({ where: { week: weekId } }),
    prisma.weeklyUpdate.findMany({ where: { week: prevWeek }, select: { taskId: true, status: true } }),
    prisma.workActivity.findMany({ where: { date: { gte: thisW.from, lte: thisW.to } }, orderBy: [{ date: 'asc' }] }),
    prisma.workActivity.findMany({ where: { date: { gte: nextW.from, lte: nextW.to } }, orderBy: [{ date: 'asc' }] }),
  ])

  const updateByTaskId = new Map(weeklyUpdates.map(u => [u.taskId, u]))
  const groupByTask = (acts: typeof thisWeekActivities) => {
    const m = new Map<string, typeof thisWeekActivities>()
    for (const a of acts) {
      if (!a.taskId) continue
      if (!m.has(a.taskId)) m.set(a.taskId, [])
      m.get(a.taskId)!.push(a)
    }
    return m
  }

  const teamMap = new Map<string, { teamName: string; tasks: typeof tasks }>()
  for (const task of tasks) {
    if (!teamMap.has(task.teamId)) teamMap.set(task.teamId, { teamName: task.team.name, tasks: [] })
    teamMap.get(task.teamId)!.tasks.push(task)
  }
  const teamEntries = [...teamMap.entries()]
    .sort((a, b) => teamOrderIndex(a[1].teamName) - teamOrderIndex(b[1].teamName))

  const currentWeekId = getWeekId(new Date())
  return {
    weekId, prevWeek, nextWeek, currentWeekId,
    tasks, weeklyUpdates, prevWeekUpdates, thisWeekActivities, nextWeekActivities,
    updateByTaskId, thisActByTask: groupByTask(thisWeekActivities), nextActByTask: groupByTask(nextWeekActivities),
    teamMap, teamEntries,
    thisWeek: thisW, nextWeekRange: nextW,
    weekLabel:         formatWeekLabel(weekId),
    weekDateRange:     formatWeekLabel(weekId).match(/\((.+)\)/)?.[1] ?? '',
    nextWeekDateRange: formatWeekLabel(nextWeek).match(/\((.+)\)/)?.[1] ?? '',
    // 오늘이 포함된 주와 그 이전 주는 "Completed", 이후 주만 "Planned"
    thisIsCompleted: weekId <= currentWeekId,
    nextIsCompleted: nextWeek <= currentWeekId,
  }
}

export type WeeklyReport = Awaited<ReturnType<typeof loadWeeklyReport>>
type Task = WeeklyReport['tasks'][number]
// [teamId, { teamName, tasks }] — 보기 범위로 과제를 걸러낸 항목도 받을 수 있게 readonly로 둔다
export type TeamEntry = readonly [string, { readonly teamName: string; readonly tasks: readonly Task[] }]
type Activity = WeeklyReport['thisWeekActivities'][number]
type Update = WeeklyReport['weeklyUpdates'][number]

export type LeafItem = { id: string; title: string; startDate: Date | null; endDate: Date | null }
export type ReportItem = {
  teamName: string; parentTask: Task; leaf: LeafItem; update: Update | undefined; taskActs: Activity[]; lines: string[]
}

// 실적(this) / 계획(next) 컬럼에 표시할 세부과제를 전략 구분(A/B/…)별로 모은다
export function collectReportItems(report: WeeklyReport, entries: readonly TeamEntry[], kind: 'this' | 'next') {
  const range   = kind === 'this' ? report.thisWeek : report.nextWeekRange
  const actMap  = kind === 'this' ? report.thisActByTask : report.nextActByTask
  const buckets = new Map<string, ReportItem[]>()
  for (const [, { teamName, tasks: tt }] of entries) {
    for (const task of tt) {
      // 세부전략과제가 없는 팀과제는 아직 실행 단위로 쪼개지지 않은 것이므로 주간관리에 표시하지 않는다
      for (const s of task.subTasks) {
        const leaf: LeafItem = { id: s.id, title: s.title, startDate: s.startDate, endDate: s.endDate }
        const update   = report.updateByTaskId.get(leaf.id)
        const taskActs = actMap.get(leaf.id) ?? []
        const text     = kind === 'this' ? update?.completed : update?.planned
        const isActive = isDateRangeActive(leaf.startDate, leaf.endDate, range.startMs, range.endMs)
        if (taskActs.length === 0 && !isActive && !text?.trim()) continue
        const key = ((task.strategy || (task.parent as any)?.strategy || '') as string) || '기타'
        if (!buckets.has(key)) buckets.set(key, [])
        buckets.get(key)!.push({ teamName, parentTask: task, leaf, update, taskActs, lines: text?.split('\n').filter(l => l.trim()) ?? [] })
      }
    }
  }
  return buckets
}

// 전사 요약용 팀별 건수
export function teamSummary(report: WeeklyReport) {
  return report.teamEntries.map(entry => {
    const count = (kind: 'this' | 'next') => {
      const items = [...collectReportItems(report, [entry], kind).values()].flat()
      return { tasks: items.length, activities: items.reduce((s, i) => s + i.taskActs.length, 0) }
    }
    return { teamId: entry[0], teamName: entry[1].teamName, this: count('this'), next: count('next') }
  })
}
