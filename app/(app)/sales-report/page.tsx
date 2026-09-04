import { prisma } from '@/lib/db'
import { Suspense } from 'react'
import Link from 'next/link'
import PeriodSelector from './PeriodSelector'
import TodayTodoButton from './TodayTodoButton'
import { computeCallDue, type CallCadenceDeal, type CallDueLead } from '@/lib/callCadence'
import { PIPELINE } from '@/lib/pipeline'

type SearchParams = { period?: string; from?: string; to?: string; view?: string; mode?: string }

/* ── 기간 계산 ── */
function calcRange(period: string, fromParam?: string, toParam?: string) {
  const now   = new Date()
  const today = now.toISOString().slice(0, 10)

  if (period === 'today') {
    return { from: today, to: today }
  }
  if (period === 'week') {
    const day = now.getDay() // 0=일
    const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) }
  }
  if (period === 'year') {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
  }
  if (period === 'custom' && fromParam && toParam) {
    return { from: fromParam, to: toParam }
  }
  // month (default)
  const y = now.getFullYear(), m = now.getMonth()
  const last = new Date(y, m + 1, 0).getDate()
  const mm = String(m + 1).padStart(2, '0')
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${last}` }
}

// lib/pipeline.ts의 실제 단계명을 그대로 사용 (하드코딩된 별도 매핑은 구조 개편 시 어긋날 수 있음)
const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  PIPELINE.flatMap(ph => ph.processes.map(p => [p.code, p.name]))
)

function fmt(d: string | Date | null | undefined) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}
function fmtFull(d: string) {
  const [y, m, mo] = d.split('-')
  return `${y}.${m}.${mo}`
}
function groupByAssignee<T extends { assignee: string | null }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const it of items) {
    const key = it.assignee ?? '미배정'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(it)
  }
  return map
}

/* ── 메인 페이지 ── */
export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp     = await searchParams
  const period = sp.period ?? 'month'
  const view   = sp.view   ?? 'summary'
  const mode   = sp.mode   ?? 'actual'
  const range  = calcRange(period, sp.from, sp.to)
  const from   = new Date(range.from)
  const to     = new Date(range.to); to.setHours(23, 59, 59, 999)

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd   = new Date(todayStart); todayEnd.setHours(23, 59, 59, 999)

  // 신규고객입력 집계용 일/주/월/연 경계 (페이지 상단의 기간 선택기와 무관하게 항상 "지금" 기준)
  const dow        = now.getDay()
  const weekStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dow === 0 ? 6 : dow - 1))
  const weekEnd    = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23, 59, 59, 999)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0); monthEnd.setHours(23, 59, 59, 999)
  const yearStart  = new Date(now.getFullYear(), 0, 1)
  const yearEnd    = new Date(now.getFullYear(), 11, 31); yearEnd.setHours(23, 59, 59, 999)

  const [
    meetings, newDeals, wonDeals, lostDeals, stageChanged, allActive,
    todayPlanned, plannedInRange, activeCadenceLeads, lastCallRows,
    newCustomerCountsRaw, newCustomersList,
  ] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT lm.id, lm.type, lm."meetingAt", lm.content, lm.result, lm.assignee,
             sd.name AS "dealName", sd.id AS "dealId"
      FROM "LeadMeeting" lm
      JOIN "SalesDeal" sd ON lm."dealId" = sd.id
      WHERE lm."isPlan" = 0 AND lm."meetingAt" >= ${from} AND lm."meetingAt" <= ${to}
      ORDER BY lm."meetingAt" DESC
    `,
    prisma.$queryRaw<any[]>`
      SELECT id, name, assignee, "stageCode", "createdAt", "salesStatus"
      FROM "SalesDeal"
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      ORDER BY "createdAt" DESC
    `,
    prisma.$queryRaw<any[]>`
      SELECT id, name, assignee, "vehicleModel", "vehicleCount", "totalPrice", "closedAt"
      FROM "SalesDeal"
      WHERE "salesStatus" = '완료' AND "closedAt" >= ${from} AND "closedAt" <= ${to}
      ORDER BY "closedAt" DESC
    `,
    prisma.$queryRaw<any[]>`
      SELECT id, name, assignee, "lostReason", "closedAt"
      FROM "SalesDeal"
      WHERE "salesStatus" = '이탈' AND "closedAt" >= ${from} AND "closedAt" <= ${to}
      ORDER BY "closedAt" DESC
    `,
    prisma.$queryRaw<any[]>`
      SELECT id, name, assignee, "stageCode", "stageChangedAt"
      FROM "SalesDeal"
      WHERE "stageChangedAt" >= ${from} AND "stageChangedAt" <= ${to}
        AND ("salesStatus" = '진행중' OR "salesStatus" IS NULL)
      ORDER BY "stageChangedAt" DESC
    `,
    prisma.$queryRaw<any[]>`
      SELECT "stageCode", COUNT(*) AS cnt
      FROM "SalesDeal"
      WHERE ("salesStatus" = '진행중' OR "salesStatus" IS NULL) AND "stageCode" IS NOT NULL
      GROUP BY "stageCode" ORDER BY "stageCode"
    `,
    /* ── 오늘의 영업회의: 오늘 계획된 미팅 ── */
    prisma.$queryRaw<any[]>`
      SELECT lm.id, lm.type, lm."meetingAt", lm.assignee, sd.name AS "dealName", sd.id AS "dealId"
      FROM "LeadMeeting" lm
      JOIN "SalesDeal" sd ON lm."dealId" = sd.id
      WHERE lm."isPlan" = 1 AND lm."meetingAt" >= ${todayStart} AND lm."meetingAt" <= ${todayEnd}
      ORDER BY lm."meetingAt" ASC
    `,
    /* ── 계획 탭: 선택 기간 내 예정된 미팅 ── */
    prisma.$queryRaw<any[]>`
      SELECT lm.id, lm.type, lm."meetingAt", lm.assignee, sd.name AS "dealName", sd.id AS "dealId"
      FROM "LeadMeeting" lm
      JOIN "SalesDeal" sd ON lm."dealId" = sd.id
      WHERE lm."isPlan" = 1 AND lm."meetingAt" >= ${from} AND lm."meetingAt" <= ${to}
      ORDER BY lm."meetingAt" ASC
    `,
    /* ── 통화주기 계산 대상: 진행중인 미성숙(1-1)/잠재(1-2) 리드 ── */
    prisma.$queryRaw<CallCadenceDeal[]>`
      SELECT id, name, assignee, "stageCode", "createdAt"
      FROM "SalesDeal"
      WHERE "stageCode" IN ('1-1', '1-2') AND ("salesStatus" = '진행중' OR "salesStatus" IS NULL)
    `,
    /* ── 딜별 마지막 완료 통화일 ── */
    prisma.$queryRaw<{ dealId: string; lastCallAt: string | Date }[]>`
      SELECT "dealId", MAX("meetingAt") AS "lastCallAt"
      FROM "LeadMeeting"
      WHERE type = '통화' AND "isPlan" = 0
      GROUP BY "dealId"
    `,
    /* ── 신규고객입력: 일/주/월/연 단위 신규 고객 등록 수 (입력일자 우선, 없으면 등록일시) ── */
    prisma.$queryRaw<{ today: number | bigint; week: number | bigint; month: number | bigint; year: number | bigint }[]>`
      SELECT
        SUM(CASE WHEN COALESCE("collectedAt","createdAt") >= ${todayStart} AND COALESCE("collectedAt","createdAt") <= ${todayEnd} THEN 1 ELSE 0 END) AS today,
        SUM(CASE WHEN COALESCE("collectedAt","createdAt") >= ${weekStart}  AND COALESCE("collectedAt","createdAt") <= ${weekEnd}  THEN 1 ELSE 0 END) AS week,
        SUM(CASE WHEN COALESCE("collectedAt","createdAt") >= ${monthStart} AND COALESCE("collectedAt","createdAt") <= ${monthEnd} THEN 1 ELSE 0 END) AS month,
        SUM(CASE WHEN COALESCE("collectedAt","createdAt") >= ${yearStart}  AND COALESCE("collectedAt","createdAt") <= ${yearEnd}  THEN 1 ELSE 0 END) AS year
      FROM "Customer"
    `,
    /* ── 신규고객입력 목록: 선택 기간(from~to) 내 등록된 고객 ── */
    prisma.$queryRaw<any[]>`
      SELECT id, name, phone, assignee, "customerSegment" AS segment,
             COALESCE("collectedAt","createdAt") AS "enteredAt"
      FROM "Customer"
      WHERE COALESCE("collectedAt","createdAt") >= ${from} AND COALESCE("collectedAt","createdAt") <= ${to}
      ORDER BY "enteredAt" DESC
    `,
  ])

  const newCustomerCounts = {
    today: Number(newCustomerCountsRaw[0]?.today ?? 0),
    week:  Number(newCustomerCountsRaw[0]?.week ?? 0),
    month: Number(newCustomerCountsRaw[0]?.month ?? 0),
    year:  Number(newCustomerCountsRaw[0]?.year ?? 0),
  }

  const meetByType: Record<string, number> = {}
  for (const m of meetings) meetByType[m.type] = (meetByType[m.type] ?? 0) + 1
  const wonRevenue = wonDeals.reduce((s: number, d: any) => s + (Number(d.totalPrice) || 0), 0)

  const periodLabel = { today: '오늘', week: '이번 주', month: '이번 달', year: '올해', custom: '기간 지정' }[period] ?? '이번 달'

  /* ── 담당자별 집계 (실적) ── */
  type AssigneeStats = {
    meetings: any[]; newDeals: any[]; stageChanged: any[]; wonDeals: any[]; lostDeals: any[]
  }
  const assigneeMap = new Map<string, AssigneeStats>()
  const ensureKey = (key: string) => {
    if (!assigneeMap.has(key)) assigneeMap.set(key, { meetings: [], newDeals: [], stageChanged: [], wonDeals: [], lostDeals: [] })
    return assigneeMap.get(key)!
  }
  for (const m of meetings)      ensureKey(m.assignee ?? '미배정').meetings.push(m)
  for (const d of newDeals)      ensureKey(d.assignee ?? '미배정').newDeals.push(d)
  for (const d of stageChanged)  ensureKey(d.assignee ?? '미배정').stageChanged.push(d)
  for (const d of wonDeals)      ensureKey(d.assignee ?? '미배정').wonDeals.push(d)
  for (const d of lostDeals)     ensureKey(d.assignee ?? '미배정').lostDeals.push(d)
  const assigneeRows = [...assigneeMap.entries()].sort((a, b) =>
    (b[1].meetings.length + b[1].newDeals.length + b[1].wonDeals.length) -
    (a[1].meetings.length + a[1].newDeals.length + a[1].wonDeals.length)
  )

  /* ── 통화주기 To-do 계산 ── */
  const lastCallByDealId = new Map<string, Date>()
  for (const r of lastCallRows) {
    if (r.lastCallAt) lastCallByDealId.set(r.dealId, new Date(r.lastCallAt))
  }
  const callDueToday = computeCallDue(activeCadenceLeads, lastCallByDealId, now)
  const callDueInRange = computeCallDue(activeCadenceLeads, lastCallByDealId, to)

  /* ── 오늘의 영업회의: 오늘 할 일 (통화 필요 + 오늘 예정 미팅, dealId 중복 제거) ── */
  type TodoItem = { dealId: string; dealName: string; assignee: string | null; label: string; detail: string }
  const todayPlannedIds = new Set(todayPlanned.map((m: any) => m.dealId))
  const todoToday: TodoItem[] = [
    ...todayPlanned.map((m: any) => ({
      dealId: m.dealId, dealName: m.dealName, assignee: m.assignee,
      label: '예정된 미팅', detail: m.type,
    })),
    ...callDueToday
      .filter(c => !todayPlannedIds.has(c.id))
      .map(c => ({
        dealId: c.id, dealName: c.name, assignee: c.assignee,
        label: c.overdueDays > 0 ? `통화 필요 (${c.overdueDays}일 지남)` : '통화 필요',
        detail: c.stageCode === '1-1' ? '미성숙리드 · 격주' : '잠재리드 · 매주',
      })),
  ]

  const standupAssignees = new Set<string>()
  for (const d of activeCadenceLeads) standupAssignees.add(d.assignee ?? '미배정')
  for (const t of todoToday)          standupAssignees.add(t.assignee ?? '미배정')
  const allAssignees = [...standupAssignees].sort((a, b) => a.localeCompare(b))
  const todoByAssignee = groupByAssignee(todoToday)

  /* ── 계획 탭 담당자별 집계 ── */
  type PlanAssigneeStats = { callDue: CallDueLead[]; planned: any[] }
  const planAssigneeMap = new Map<string, PlanAssigneeStats>()
  const ensurePlanKey = (key: string) => {
    if (!planAssigneeMap.has(key)) planAssigneeMap.set(key, { callDue: [], planned: [] })
    return planAssigneeMap.get(key)!
  }
  for (const c of callDueInRange) ensurePlanKey(c.assignee ?? '미배정').callDue.push(c)
  for (const p of plannedInRange) ensurePlanKey(p.assignee ?? '미배정').planned.push(p)
  const planAssigneeRows = [...planAssigneeMap.entries()].sort((a, b) =>
    (b[1].callDue.length + b[1].planned.length) - (a[1].callDue.length + a[1].planned.length)
  )

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 min-h-screen">
      {/* 헤더 */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800">영업 리포트</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {fmtFull(range.from)} ~ {fmtFull(range.to)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a href="/sales-report/kia-letter" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
                📄 공문발송 (기아 대장동)
              </a>
              <TodayTodoButton
                dateLabel={fmtFull(todayStart.toISOString().slice(0, 10))}
                assignees={allAssignees}
                todoByAssignee={Object.fromEntries(todoByAssignee)}
              />
            </div>
          </div>
          <Suspense>
            <PeriodSelector from={range.from} to={range.to} period={period} view={view} mode={mode} />
          </Suspense>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* ══════════════════════════════════════════
            계획 탭
        ══════════════════════════════════════════ */}
        {mode === 'plan' && <>
          {view === 'assignee' ? (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="text-[13px] font-bold text-slate-700">영업담당자별 계획 요약</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">{periodLabel} · {fmtFull(range.from)}{range.from !== range.to ? ` ~ ${fmtFull(range.to)}` : ''} 까지</p>
                </div>
                {planAssigneeRows.length === 0 ? (
                  <div className="px-5 py-10 text-center text-xs text-slate-400">기간 내 계획된 활동이 없습니다</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="text-left py-3 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">영업담당</th>
                          <th className="text-center py-3 px-4 text-[10px] font-bold text-amber-600 uppercase tracking-wider">통화 필요</th>
                          <th className="text-center py-3 px-4 text-[10px] font-bold text-indigo-600 uppercase tracking-wider">예정된 미팅</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planAssigneeRows.map(([name, s]) => (
                          <tr key={name} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-3 px-5 font-semibold text-slate-800">{name}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`font-bold ${s.callDue.length > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{s.callDue.length}</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`font-bold ${s.planned.length > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{s.planned.length}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {planAssigneeRows.filter(([, s]) => s.callDue.length > 0).map(([name, s]) => (
                <div key={name} className="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-amber-400 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                    <h2 className="text-[13px] font-bold text-slate-700">{name} — 통화 필요 리드</h2>
                    <span className="text-xs font-bold text-amber-600">{s.callDue.length}건</span>
                  </div>
                  <div className="overflow-auto px-5 py-3 max-h-[420px]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100"><Th>고객명</Th><Th>단계</Th><Th>통화예정일</Th><Th>연체</Th></tr>
                      </thead>
                      <tbody>
                        {s.callDue.map(c => (
                          <ClickRow key={c.id} href={`/funnel/${c.id}`}>
                            <Td><Link href={`/funnel/${c.id}`} className="font-medium text-indigo-600 hover:underline">{c.name}</Link></Td>
                            <Td><Badge text={STAGE_LABEL[c.stageCode] ?? c.stageCode} /></Td>
                            <Td>{fmt(c.dueAt)}</Td>
                            <Td>{c.overdueDays > 0 ? <span className="text-red-500 font-semibold">{c.overdueDays}일</span> : '-'}</Td>
                          </ClickRow>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest mb-3">통화 필요 리드</p>
                  <p className="text-3xl font-black text-slate-800">{callDueInRange.length}<span className="text-base font-semibold text-slate-400 ml-1">건</span></p>
                  <p className="text-[11px] text-slate-400 mt-1">미성숙(격주) · 잠재(매주) 통화주기 기준, {fmtFull(range.to)}까지 (연체 포함)</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest mb-3">예정된 미팅</p>
                  <p className="text-3xl font-black text-slate-800">{plannedInRange.length}<span className="text-base font-semibold text-slate-400 ml-1">건</span></p>
                  <p className="text-[11px] text-slate-400 mt-1">{periodLabel} 내 계획 등록된 미팅/통화</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section title="통화예정 리드 목록" count={callDueInRange.length} accent="amber">
                  {callDueInRange.length === 0
                    ? <Empty text="기간 내 통화 예정 리드가 없습니다" />
                    : <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <Th>고객명</Th><Th>단계</Th><Th>담당</Th><Th>통화예정일</Th><Th>연체</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {callDueInRange.map(c => (
                            <ClickRow key={c.id} href={`/funnel/${c.id}`}>
                              <Td><Link href={`/funnel/${c.id}`} className="font-medium text-indigo-600 hover:underline">{c.name}</Link></Td>
                              <Td><Badge text={STAGE_LABEL[c.stageCode] ?? c.stageCode} /></Td>
                              <Td>{c.assignee ?? '-'}</Td>
                              <Td>{fmt(c.dueAt)}</Td>
                              <Td>{c.overdueDays > 0 ? <span className="text-red-500 font-semibold">{c.overdueDays}일</span> : '-'}</Td>
                            </ClickRow>
                          ))}
                        </tbody>
                      </table>
                  }
                </Section>

                <Section title="예정된 미팅 목록" count={plannedInRange.length} accent="indigo">
                  {plannedInRange.length === 0
                    ? <Empty text="기간 내 예정된 미팅이 없습니다" />
                    : <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <Th>일정</Th><Th>고객</Th><Th>유형</Th><Th>담당</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {plannedInRange.map((m: any) => (
                            <ClickRow key={m.id} href={`/funnel/${m.dealId}#meetings`}>
                              <Td>{fmt(m.meetingAt)}</Td>
                              <Td><Link href={`/funnel/${m.dealId}#meetings`} className="font-medium text-indigo-600 hover:underline">{m.dealName}</Link></Td>
                              <Td><Badge text={m.type} /></Td>
                              <Td>{m.assignee ?? '-'}</Td>
                            </ClickRow>
                          ))}
                        </tbody>
                      </table>
                  }
                </Section>
              </div>
            </>
          )}
        </>}

        {/* ══════════════════════════════════════════
            실적 탭 · 담당자별 뷰
        ══════════════════════════════════════════ */}
        {mode === 'actual' && view === 'assignee' && (
          <div className="space-y-4">
            {/* 담당자 요약 테이블 */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-[13px] font-bold text-slate-700">영업담당자별 영업 활동 요약</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">{periodLabel} · {fmtFull(range.from)}{range.from !== range.to ? ` ~ ${fmtFull(range.to)}` : ''}</p>
              </div>
              {assigneeRows.length === 0 ? (
                <div className="px-5 py-10 text-center text-xs text-slate-400">기간 내 활동이 없습니다</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left py-3 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">담당자</th>
                        <th className="text-center py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">미팅</th>
                        <th className="text-center py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">신규리드</th>
                        <th className="text-center py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">단계진전</th>
                        <th className="text-center py-3 px-4 text-[10px] font-bold text-green-500 uppercase tracking-wider">수주</th>
                        <th className="text-center py-3 px-4 text-[10px] font-bold text-red-400 uppercase tracking-wider">실주</th>
                        <th className="text-center py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">수주율</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assigneeRows.map(([name, s]) => {
                        const total = s.wonDeals.length + s.lostDeals.length
                        const wr = total > 0 ? Math.round((s.wonDeals.length / total) * 100) : null
                        const actTotal = s.meetings.length + s.newDeals.length + s.stageChanged.length + s.wonDeals.length + s.lostDeals.length
                        return (
                          <tr key={name} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-3 px-5 font-semibold text-slate-800">
                              {name}
                              {actTotal === 0 && <span className="ml-2 text-[10px] text-slate-300">활동 없음</span>}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`font-bold ${s.meetings.length > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{s.meetings.length}</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`font-bold ${s.newDeals.length > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{s.newDeals.length}</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`font-bold ${s.stageChanged.length > 0 ? 'text-violet-600' : 'text-slate-300'}`}>{s.stageChanged.length}</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`font-bold ${s.wonDeals.length > 0 ? 'text-green-600' : 'text-slate-300'}`}>{s.wonDeals.length}</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`font-bold ${s.lostDeals.length > 0 ? 'text-red-500' : 'text-slate-300'}`}>{s.lostDeals.length}</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {wr !== null
                                ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700">{wr}%</span>
                                : <span className="text-slate-300">-</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 담당자별 미팅 상세 */}
            {assigneeRows.filter(([, s]) => s.meetings.length > 0).map(([name, s]) => (
              <div key={name} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                  <h2 className="text-[13px] font-bold text-slate-700">{name} — 미팅 기록</h2>
                  <span className="text-xs font-bold text-indigo-600">{s.meetings.length}건</span>
                </div>
                <div className="overflow-auto px-5 py-3 max-h-[420px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <Th>날짜</Th><Th>고객</Th><Th>유형</Th><Th>결과</Th><Th>다음 액션</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.meetings.map((m: any) => (
                        <ClickRow key={m.id} href={`/funnel/${m.dealId}#meetings`}>
                          <Td>{fmt(m.meetingAt)}</Td>
                          <Td><Link href={`/funnel/${m.dealId}#meetings`} className="font-medium text-indigo-600 hover:underline">{m.dealName}</Link></Td>
                          <Td><Badge text={m.type} /></Td>
                          <Td className="max-w-[160px] truncate">{m.result ?? '-'}</Td>
                          <Td className="max-w-[160px] truncate">{m.nextAction ?? '-'}</Td>
                        </ClickRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* 담당자별 신규 리드 */}
            {assigneeRows.filter(([, s]) => s.newDeals.length > 0).map(([name, s]) => (
              <div key={name} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                  <h2 className="text-[13px] font-bold text-slate-700">{name} — 신규 리드</h2>
                  <span className="text-xs font-bold text-blue-600">{s.newDeals.length}건</span>
                </div>
                <div className="overflow-auto px-5 py-3 max-h-[420px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100"><Th>유입일</Th><Th>고객명</Th><Th>단계</Th></tr>
                    </thead>
                    <tbody>
                      {s.newDeals.map((d: any) => (
                        <ClickRow key={d.id} href={`/funnel/${d.id}`}>
                          <Td>{fmt(d.createdAt)}</Td>
                          <Td><Link href={`/funnel/${d.id}`} className="font-medium text-indigo-600 hover:underline">{d.name}</Link></Td>
                          <Td><Badge text={STAGE_LABEL[d.stageCode] ?? d.stageCode ?? '-'} /></Td>
                        </ClickRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <p className="text-[10px] text-slate-300 text-center pb-4">
              * 수주/실주 날짜는 상태를 변경한 시점부터 집계됩니다.
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════
            실적 탭 · 전체 뷰
        ══════════════════════════════════════════ */}
        {mode === 'actual' && view !== 'assignee' && <>

        {/* ── 요약 카드 3개 ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* 고객 방문/미팅 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">고객 방문/미팅</p>
            <p className="text-3xl font-black text-slate-800">{meetings.length}<span className="text-base font-semibold text-slate-400 ml-1">건</span></p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(['방문','통화','화상','기타'] as const).map(t => (
                <div key={t} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl">
                  <span className="text-xs text-slate-500">{t}</span>
                  <span className="text-sm font-bold text-slate-700">{meetByType[t] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 리드 현황 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">리드 현황</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">신규 유입</span>
                <span className="text-xl font-black text-blue-600">{newDeals.length}<span className="text-xs font-semibold text-slate-400 ml-0.5">건</span></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">단계 진전</span>
                <span className="text-xl font-black text-indigo-600">{stageChanged.length}<span className="text-xs font-semibold text-slate-400 ml-0.5">건</span></span>
              </div>
              <div className="h-px bg-slate-100 my-2" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">현재 파이프라인</p>
              <div className="space-y-1">
                {allActive.map((r: any) => (
                  <div key={r.stageCode} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-20 shrink-0 truncate" title={STAGE_LABEL[r.stageCode] ?? r.stageCode}>{STAGE_LABEL[r.stageCode] ?? r.stageCode}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                      <div
                        className="bg-indigo-400 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, (Number(r.cnt) / Math.max(...allActive.map((x: any) => Number(x.cnt)))) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-600 w-5 text-right">{Number(r.cnt)}</span>
                  </div>
                ))}
                {allActive.length === 0 && <p className="text-xs text-slate-400">진행 중인 리드 없음</p>}
              </div>
            </div>
          </div>

          {/* 수주/실주 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">수주 / 실주</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="text-center p-3 bg-green-50 rounded-xl">
                <p className="text-xs text-green-600 font-semibold mb-0.5">수주</p>
                <p className="text-2xl font-black text-green-700">{wonDeals.length}</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-xl">
                <p className="text-xs text-red-500 font-semibold mb-0.5">실주</p>
                <p className="text-2xl font-black text-red-600">{lostDeals.length}</p>
              </div>
            </div>
            <div className="space-y-1.5 mb-3">
              {wonRevenue > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">수주 매출</span>
                  <span className="text-sm font-bold text-slate-700">{wonRevenue.toLocaleString()}만원</span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-1">기간 내 수주/실주 없음</p>
              )}
            </div>

            <div className="h-px bg-slate-100 mb-3" />
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">신규고객입력</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '오늘', value: newCustomerCounts.today },
                { label: '이번 주', value: newCustomerCounts.week },
                { label: '이번 달', value: newCustomerCounts.month },
                { label: '올해', value: newCustomerCounts.year },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-slate-50 px-1 py-2 text-center">
                  <div className="text-[10px] font-semibold text-slate-400 mb-0.5">{label}</div>
                  <div className="text-base font-bold text-slate-700">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 상세 섹션 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* 방문/미팅 목록 */}
          <Section title="방문 · 미팅 목록" count={meetings.length}>
            {meetings.length === 0
              ? <Empty text="기간 내 미팅 기록이 없습니다" />
              : <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <Th>날짜</Th><Th>고객</Th><Th>유형</Th><Th>담당</Th><Th>결과</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.map((m: any) => (
                      <ClickRow key={m.id} href={`/funnel/${m.dealId}#meetings`}>
                        <Td>{fmt(m.meetingAt)}</Td>
                        <Td><Link href={`/funnel/${m.dealId}#meetings`} className="font-medium text-indigo-600 hover:underline">{m.dealName}</Link></Td>
                        <Td><Badge text={m.type} /></Td>
                        <Td>{m.assignee ?? '-'}</Td>
                        <Td className="max-w-[120px] truncate">{m.result ?? '-'}</Td>
                      </ClickRow>
                    ))}
                  </tbody>
                </table>
            }
          </Section>

          {/* 신규 리드 */}
          <Section title="신규 유입 리드" count={newDeals.length}>
            {newDeals.length === 0
              ? <Empty text="기간 내 신규 리드가 없습니다" />
              : <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <Th>유입일</Th><Th>고객명</Th><Th>단계</Th><Th>담당</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {newDeals.map((d: any) => (
                      <ClickRow key={d.id} href={`/funnel/${d.id}`}>
                        <Td>{fmt(d.createdAt)}</Td>
                        <Td><Link href={`/funnel/${d.id}`} className="font-medium text-indigo-600 hover:underline">{d.name}</Link></Td>
                        <Td><Badge text={STAGE_LABEL[d.stageCode] ?? d.stageCode ?? '-'} /></Td>
                        <Td>{d.assignee ?? '-'}</Td>
                      </ClickRow>
                    ))}
                  </tbody>
                </table>
            }
          </Section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 단계 진전 리드 */}
          <Section title="단계 진전 리드" count={stageChanged.length}>
            {stageChanged.length === 0
              ? <Empty text="기간 내 단계 진전 리드가 없습니다" />
              : <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <Th>변경일</Th><Th>고객명</Th><Th>현재 단계</Th><Th>담당</Th>
                  </tr>
                </thead>
                <tbody>
                  {stageChanged.map((d: any) => (
                    <ClickRow key={d.id} href={`/funnel/${d.id}`}>
                      <Td>{fmt(d.stageChangedAt)}</Td>
                      <Td><Link href={`/funnel/${d.id}`} className="font-medium text-indigo-600 hover:underline">{d.name}</Link></Td>
                      <Td><Badge text={STAGE_LABEL[d.stageCode] ?? d.stageCode} /></Td>
                      <Td>{d.assignee ?? '-'}</Td>
                    </ClickRow>
                  ))}
                </tbody>
              </table>
            }
          </Section>

          {/* 신규고객입력 목록 */}
          <Section title="신규고객입력" count={newCustomersList.length}>
            {newCustomersList.length === 0
              ? <Empty text="기간 내 신규 등록된 고객이 없습니다" />
              : <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <Th>입력일</Th><Th>고객명</Th><Th>구분</Th><Th>담당</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {newCustomersList.map((c: any) => (
                      <ClickRow key={c.id} href={`/customers/${c.id}`}>
                        <Td>{fmt(c.enteredAt)}</Td>
                        <Td><Link href={`/customers/${c.id}`} className="font-medium text-indigo-600 hover:underline">{c.name}</Link></Td>
                        <Td>{c.segment ?? '-'}</Td>
                        <Td>{c.assignee ?? '-'}</Td>
                      </ClickRow>
                    ))}
                  </tbody>
                </table>
            }
          </Section>
        </div>

        {/* 수주 / 실주 목록 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="수주 목록" count={wonDeals.length} accent="green">
            {wonDeals.length === 0
              ? <Empty text="기간 내 수주 건이 없습니다" />
              : <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <Th>완료일</Th><Th>고객명</Th><Th>차종</Th><Th>대수</Th><Th>금액</Th><Th>담당</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {wonDeals.map((d: any) => (
                      <ClickRow key={d.id} href={`/funnel/${d.id}`}>
                        <Td>{fmt(d.closedAt)}</Td>
                        <Td><Link href={`/funnel/${d.id}`} className="font-medium text-green-700 hover:underline">{d.name}</Link></Td>
                        <Td>{d.vehicleModel ?? '-'}</Td>
                        <Td>{d.vehicleCount ?? '-'}</Td>
                        <Td>{d.totalPrice ? `${Number(d.totalPrice).toLocaleString()}만` : '-'}</Td>
                        <Td>{d.assignee ?? '-'}</Td>
                      </ClickRow>
                    ))}
                  </tbody>
                </table>
            }
          </Section>

          <Section title="실주 목록" count={lostDeals.length} accent="red">
            {lostDeals.length === 0
              ? <Empty text="기간 내 실주 건이 없습니다" />
              : <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <Th>이탈일</Th><Th>고객명</Th><Th>실주 사유</Th><Th>담당</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {lostDeals.map((d: any) => (
                      <ClickRow key={d.id} href={`/funnel/${d.id}`}>
                        <Td>{fmt(d.closedAt)}</Td>
                        <Td><Link href={`/funnel/${d.id}`} className="font-medium text-slate-700 hover:underline">{d.name}</Link></Td>
                        <Td className="max-w-[150px] truncate">{d.lostReason ?? '-'}</Td>
                        <Td>{d.assignee ?? '-'}</Td>
                      </ClickRow>
                    ))}
                  </tbody>
                </table>
            }
          </Section>
        </div>

        <p className="text-[10px] text-slate-300 text-center pb-4">
          * 수주/실주 날짜는 영업 파이프라인에서 상태를 변경한 시점부터 집계됩니다.
        </p>
        </>}
      </div>
    </div>
  )
}

/* ── 헬퍼 컴포넌트 ── */
function Section({ title, count, accent, children }: {
  title: string; count: number; accent?: 'green' | 'red' | 'indigo' | 'amber'; children: React.ReactNode
}) {
  const palette: Record<string, { text: string; border: string }> = {
    green:  { text: 'text-green-600',  border: 'border-l-green-400' },
    red:    { text: 'text-red-500',    border: 'border-l-red-400' },
    indigo: { text: 'text-indigo-600', border: 'border-l-indigo-400' },
    amber:  { text: 'text-amber-600',  border: 'border-l-amber-400' },
  }
  const p = palette[accent ?? 'indigo']
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${p.border} overflow-hidden`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <h2 className="text-[13px] font-bold text-slate-700">{title}</h2>
        <span className={`text-xs font-bold ${p.text}`}>{count}건</span>
      </div>
      <div className="overflow-auto px-5 py-3 max-h-[420px]">{children}</div>
    </div>
  )
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left py-1.5 pr-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{children}</th>
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2 pr-3 text-slate-600 whitespace-nowrap ${className ?? ''}`}>{children}</td>
}
function ClickRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-slate-50 hover:bg-indigo-50 cursor-pointer group">
      {children}
      <td className="py-2 pl-1 pr-2 w-6">
        <Link href={href} className="block text-slate-300 group-hover:text-indigo-400 text-xs" tabIndex={-1}>→</Link>
      </td>
    </tr>
  )
}
function Badge({ text }: { text: string }) {
  return <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-semibold">{text}</span>
}
function Empty({ text }: { text: string }) {
  return <p className="text-xs text-slate-400 text-center py-4">{text}</p>
}
