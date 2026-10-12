import { auth } from '@/auth'
import { prisma } from '@/lib/db'

/**
 * AI 업무 기록 대시보드 — 전사 공용 화면.
 * 팀원들이 개인 AI(원격 MCP)로 등록·수정한 활동(source='mcp')을 사람별 사용량과 함께 보여주고,
 * AI 연결 피드백(제안함의 [AI 피드백])을 게시판으로 모아 보여준다.
 * 활동 공개여부(비공개/제목만 공개)는 업무공간과 동일하게 존중한다.
 */
export const dynamic = 'force-dynamic'

function daysAgoKst(days: number): string {
  const d = new Date(Date.now() + 9 * 3600_000)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export default async function AiLogPage() {
  const session = await auth()
  const me = session?.user as any
  const myUserId: string | null = me?.id ?? null
  const isPrivileged = me?.role === 'admin' || me?.role === 'ceo'

  const from = daysAgoKst(30)
  const [rawRows, feedbacks] = await Promise.all([
    prisma.workActivity.findMany({
      where: { source: 'mcp', date: { gte: from } },
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
      select: {
        id: true, title: true, content: true, date: true, type: true,
        planStatus: true, userId: true, userName: true, createdAt: true, visibility: true,
        team: { select: { name: true } },
      },
    }),
    prisma.suggestion.findMany({
      where: { title: { startsWith: '[AI 피드백]' } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, userName: true, content: true, status: true, replyContent: true, repliedByName: true, createdAt: true },
    }),
  ])

  // 공개여부 반영 — 업무공간(GET /api/activities)과 같은 규칙
  const rows = rawRows
    .filter(r => isPrivileged || (r.visibility ?? '공개') !== '전체 비공개' || r.userId === myUserId)
    .map(r => (!isPrivileged && (r.visibility ?? '공개') === '제목만 공개' && r.userId !== myUserId)
      ? { ...r, content: null }
      : r)

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
    <div className="p-6">
      {/* 헤더 (공통 스타일: 검은 배경 + 둥근 모서리) */}
      <div className="px-6 py-4 mb-5 rounded-xl" style={{ backgroundColor: '#111111' }}>
        <h1 className="text-xl font-bold text-white">AI 업무 기록</h1>
        <p className="text-[11px] mt-0.5" style={{ color: '#C5D42A' }}>
          개인 AI(Claude·ChatGPT 등)로 등록·수정한 최근 30일 전사 기록 — 연결은 내 계정 → AI 연결에서
        </p>
      </div>

      <div className="max-w-4xl">
      {rows.length === 0 ? (
        <div className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg p-8 text-center">
          아직 AI로 기록된 활동이 없습니다.<br />
          <b>내 계정 → AI 연결</b>에서 토큰을 발급해 Claude나 ChatGPT에 등록한 뒤,
          &ldquo;오늘 한 일 WARP에 정리해줘&rdquo;라고 해보세요.
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

      {/* AI 연결 피드백 게시판 — 대화 중 send_feedback 으로 남긴 개선 의견 */}
      <div className="mt-8">
        <h2 className="text-sm font-bold text-slate-800 mb-1">AI 연결 피드백</h2>
        <p className="text-[11px] text-slate-400 mb-3">
          AI와 대화하다 &ldquo;이 의견 피드백으로 남겨줘&rdquo;라고 하면 여기에 쌓입니다. 답변은 제안함에서 관리자가 답니다.
        </p>
        {feedbacks.length === 0 ? (
          <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg p-5 text-center">
            아직 피드백이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {feedbacks.map(f => (
              <div key={f.id} className="bg-white border border-slate-200 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">{f.userName}</span>
                  <span className="text-[11px] text-slate-400">
                    {f.createdAt.toISOString().slice(5, 10).replace('-', '/')}
                    {f.status === '답변완료' && <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">답변완료</span>}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{f.content}</p>
                {f.replyContent && (
                  <div className="mt-2 border-l-2 border-slate-200 pl-3 text-[11px] text-slate-500 whitespace-pre-wrap">
                    <b>{f.repliedByName ?? '관리자'}</b> — {f.replyContent}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
