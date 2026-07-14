import { prisma } from '@/lib/db'
import { Suspense } from 'react'
import Link from 'next/link'
import PeriodSelector from './PeriodSelector'

type SearchParams = { period?: string; from?: string; to?: string; view?: string }

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

const STAGE_LABEL: Record<string, string> = {
  '1-1': '리드',   '1-2': '관심',
  '2-1': '전화상담', '2-2': '대면상담', '2-3': '심사',
  '3-1': '계약', '3-2': '출고준비', '4-1': '출고완료',
}

function fmt(d: string | Date | null | undefined) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}
function fmtFull(d: string) {
  const [y, m, mo] = d.split('-')
  return `${y}.${m}.${mo}`
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
  const range  = calcRange(period, sp.from, sp.to)
  const from   = new Date(range.from)
  const to     = new Date(range.to); to.setHours(23, 59, 59, 999)

  const [meetings, newDeals, wonDeals, lostDeals, stageChanged, allActive] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT lm.id, lm.type, lm."meetingAt", lm.content, lm.result, lm.assignee,
             sd.name AS "dealName", sd.id AS "dealId"
      FROM "LeadMeeting" lm
      JOIN "SalesDeal" sd ON lm."dealId" = sd.id
      WHERE lm."meetingAt" >= ${from} AND lm."meetingAt" <= ${to}
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
  ])

  const meetByType: Record<string, number> = {}
  for (const m of meetings) meetByType[m.type] = (meetByType[m.type] ?? 0) + 1
  const wonRevenue = wonDeals.reduce((s: number, d: any) => s + (Number(d.totalPrice) || 0), 0)
  const winRate = wonDeals.length + lostDeals.length > 0
    ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100)
    : null

  const periodLabel = { today: '오늘', week: '이번 주', month: '이번 달', year: '올해', custom: '기간 지정' }[period] ?? '이번 달'

  /* ── 담당자별 집계 ── */
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

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 min-h-screen">
      {/* 헤더 */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="mr-6">
            <h1 className="text-xl font-bold text-slate-800">영업 리포트</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {fmtFull(range.from)} ~ {fmtFull(range.to)}
            </p>
          </div>
          <Suspense>
            <PeriodSelector from={range.from} to={range.to} period={period} view={view} />
          </Suspense>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* ══════════════════════════════════════════
            담당자별 뷰
        ══════════════════════════════════════════ */}
        {view === 'assignee' && (
          <div className="space-y-4">
            {/* 담당자 요약 테이블 */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-700">담당자별 영업 활동 요약</h2>
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
                  <h2 className="text-sm font-bold text-slate-700">{name} — 미팅 기록</h2>
                  <span className="text-xs font-bold text-indigo-600">{s.meetings.length}건</span>
                </div>
                <div className="overflow-x-auto px-5 py-3">
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
                  <h2 className="text-sm font-bold text-slate-700">{name} — 신규 리드</h2>
                  <span className="text-xs font-bold text-blue-600">{s.newDeals.length}건</span>
                </div>
                <div className="overflow-x-auto px-5 py-3">
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
            전체 뷰 (기존)
        ══════════════════════════════════════════ */}
        {view !== 'assignee' && <>

        {/* ── 요약 카드 3개 ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* 고객 방문/미팅 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">고객 방문/미팅</p>
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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">리드 현황</p>
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">현재 파이프라인</p>
              <div className="space-y-1">
                {allActive.map((r: any) => (
                  <div key={r.stageCode} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-20">{STAGE_LABEL[r.stageCode] ?? r.stageCode}</span>
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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">수주 / 실주</p>
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
            <div className="space-y-1.5">
              {winRate !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">수주율</span>
                  <span className="text-sm font-bold text-slate-700">{winRate}%</span>
                </div>
              )}
              {wonRevenue > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">수주 매출</span>
                  <span className="text-sm font-bold text-slate-700">{wonRevenue.toLocaleString()}만원</span>
                </div>
              )}
              {winRate === null && wonRevenue === 0 && (
                <p className="text-xs text-slate-400 text-center py-1">기간 내 수주/실주 없음</p>
              )}
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

          {/* 수주 목록 */}
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

          {/* 실주 목록 */}
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
                        <Td><Link href={`/funnel/${d.id}`} className="font-medium text-red-600 hover:underline">{d.name}</Link></Td>
                        <Td className="max-w-[150px] truncate">{d.lostReason ?? '-'}</Td>
                        <Td>{d.assignee ?? '-'}</Td>
                      </ClickRow>
                    ))}
                  </tbody>
                </table>
            }
          </Section>
        </div>

        {/* 단계 진전 리드 */}
        {stageChanged.length > 0 && (
          <Section title="단계 진전 리드" count={stageChanged.length}>
            <table className="w-full text-xs">
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
          </Section>
        )}

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
  title: string; count: number; accent?: 'green' | 'red'; children: React.ReactNode
}) {
  const color = accent === 'green' ? 'text-green-600' : accent === 'red' ? 'text-red-500' : 'text-indigo-600'
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-700">{title}</h2>
        <span className={`text-xs font-bold ${color}`}>{count}건</span>
      </div>
      <div className="overflow-x-auto px-5 py-3">{children}</div>
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
