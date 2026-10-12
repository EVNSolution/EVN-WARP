import { prisma } from '@/lib/db'

/**
 * AI 업무 기록 대시보드.
 * 팀원들이 개인 Claude(warp-mcp)를 통해 올린 활동(source='mcp')을 한눈에 본다 —
 * 누가 얼마나 AI로 업무를 기록하고 있는지 추적하는 단순 현황판.
 * 활동 자체의 수정·완료 처리는 업무공간에서 한다.
 */
export const dynamic = 'force-dynamic'

function daysAgoKst(days: number): string {
  const d = new Date(Date.now() + 9 * 3600_000)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export default async function AiLogPage() {
  const from = daysAgoKst(30)
  const rows = await prisma.workActivity.findMany({
    where: { source: 'mcp', date: { gte: from } },
    orderBy: [{ createdAt: 'desc' }],
    take: 300,
    select: {
      id: true, title: true, content: true, date: true, type: true,
      planStatus: true, userName: true, createdAt: true,
      team: { select: { name: true } },
    },
  })

  // 사람별 집계 — 등록 수·완료 수·마지막 기록일
  const byUser = new Map<string, { count: number; done: number; last: string; team: string }>()
  for (const r of rows) {
    const name = r.userName ?? '이름 없음'
    const entry = byUser.get(name) ?? { count: 0, done: 0, last: r.date, team: r.team?.name ?? '' }
    entry.count += 1
    if (r.planStatus === '완료') entry.done += 1
    if (r.date > entry.last) entry.last = r.date
    byUser.set(name, entry)
  }
  const users = [...byUser.entries()].sort((a, b) => b[1].count - a[1].count)

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-lg font-bold text-slate-800">AI 업무 기록</h1>
      <p className="text-xs text-slate-400 mt-1 mb-5">
        개인 Claude(업무 기록 도우미)를 통해 올라온 최근 30일 활동입니다.
        내용 수정·완료 처리는 <b>업무공간</b>에서 하세요.
      </p>

      {rows.length === 0 ? (
        <div className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg p-8 text-center">
          아직 AI로 기록된 활동이 없습니다.<br />
          Claude Desktop에 warp-mcp를 연결하고 &ldquo;오늘 한 일 WARP에 정리해줘&rdquo;라고 해보세요.
        </div>
      ) : (
        <>
          {/* 사람별 요약 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {users.map(([name, s]) => (
              <div key={name} className="border border-slate-200 rounded-lg p-3 bg-white">
                <div className="text-sm font-semibold text-slate-700">{name}</div>
                <div className="text-[11px] text-slate-400">{s.team}</div>
                <div className="mt-2 text-xl font-bold text-slate-800">
                  {s.count}<span className="text-xs font-normal text-slate-400"> 건</span>
                </div>
                <div className="text-[11px] text-slate-500">완료 {s.done} · 최근 {s.last.slice(5)}</div>
              </div>
            ))}
          </div>

          {/* 최근 기록 목록 */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[11px] text-slate-400 border-b border-slate-200">
                <th className="py-2 pr-3 font-medium w-20">날짜</th>
                <th className="py-2 pr-3 font-medium w-20">담당</th>
                <th className="py-2 pr-3 font-medium">활동</th>
                <th className="py-2 pr-3 font-medium w-24">유형</th>
                <th className="py-2 font-medium w-14">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map(r => (
                <tr key={r.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{r.date.slice(5)}</td>
                  <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{r.userName ?? '-'}</td>
                  <td className="py-2 pr-3">
                    <div className="text-slate-800">{r.title}</div>
                    {r.content && <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{r.content}</div>}
                  </td>
                  <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{r.type}</td>
                  <td className="py-2">
                    <span className={r.planStatus === '완료'
                      ? 'text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600'
                      : 'text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600'}>
                      {r.planStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
