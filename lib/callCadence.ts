/**
 * 미성숙/잠재 리드 통화주기 계산
 * - 1-1 (미성숙 리드): 마지막 완료 통화(또는 생성일) 기준 14일(격주)마다 1회
 * - 1-2 (잠재 리드): 마지막 완료 통화(또는 생성일) 기준 7일(매주)마다 1회
 * 완료 통화가 새로 기록되면 기준일이 갱신되어 자동으로 대상에서 빠진다.
 */

const CALL_INTERVAL_DAYS: Record<string, number> = {
  '1-1': 14,
  '1-2': 7,
}

const DAY_MS = 24 * 60 * 60 * 1000

export type CallCadenceDeal = {
  id: string
  name: string
  assignee: string | null
  stageCode: string | null
  createdAt: Date | string
}

export type CallDueLead = {
  id: string
  name: string
  assignee: string | null
  stageCode: string
  lastCallAt: string | null
  dueAt: string
  overdueDays: number
}

/**
 * @param deals stageCode가 '1-1' 또는 '1-2'인 진행중 리드 목록
 * @param lastCallByDealId 딜별 마지막 완료 통화일(LeadMeeting type='통화' AND isPlan=false 중 최신)
 * @param today 기준 날짜 (기본값: 현재 시각)
 */
export function computeCallDue(
  deals: CallCadenceDeal[],
  lastCallByDealId: Map<string, Date>,
  today: Date = new Date(),
): CallDueLead[] {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const result: CallDueLead[] = []
  for (const d of deals) {
    const interval = d.stageCode ? CALL_INTERVAL_DAYS[d.stageCode] : undefined
    if (!interval) continue

    const lastCall = lastCallByDealId.get(d.id) ?? null
    const baseline = lastCall ?? new Date(d.createdAt)
    const dueAt = new Date(baseline.getTime() + interval * DAY_MS)

    if (dueAt.getTime() <= todayStart.getTime() + DAY_MS - 1) {
      const overdueDays = Math.max(0, Math.floor((todayStart.getTime() - dueAt.getTime()) / DAY_MS))
      result.push({
        id: d.id,
        name: d.name,
        assignee: d.assignee,
        stageCode: d.stageCode!,
        lastCallAt: lastCall ? lastCall.toISOString() : null,
        dueAt: dueAt.toISOString(),
        overdueDays,
      })
    }
  }

  return result.sort((a, b) => b.overdueDays - a.overdueDays)
}
