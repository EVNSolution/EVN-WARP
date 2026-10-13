import { auth } from '@/auth'
import { prisma } from '@/lib/db'

/**
 * AI 업무 기록 대시보드 — 전사 공용 화면. 4개 뷰로 구성:
 *  ① AI 활동 집계 — 어떤 활동(업무기록·회의실·스킬·피드백)으로 AI 를 쓰는지 (사람별 집계는 하지 않는다)
 *  ② 피드백 로그 — send_feedback 으로 들어온 의견 테이블
 *  ③ 업무 온톨로지 — WARP 에 쌓인 활동 유형 지도 (전체 활동 기준)
 *  ④ 사용 추이 — 최근 4주 일별 도구 호출 (유형별 색)
 * + 최근 AI 업무 기록 목록 (공개여부는 업무공간과 동일하게 존중)
 */
export const dynamic = 'force-dynamic'

const CATS = ['업무기록', '회의실', '스킬', '피드백', '기타'] as const
const CAT_COLOR: Record<string, string> = {
  '업무기록': '#C5D42A', '회의실': '#38BDF8', '스킬': '#A78BFA', '피드백': '#FBBF24', '기타': '#64748B',
}

function daysAgoKst(days: number): string {
  const d = new Date(Date.now() + 9 * 3600_000)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function kstDay(d: Date): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10)
}

/** 카테고리 비중 도넛 (순수 SVG) */
function Donut({ counts, total }: { counts: Map<string, number>; total: number }) {
  const R = 44
  const C = 2 * Math.PI * R
  let acc = 0
  const segs = CATS.filter(c => (counts.get(c) ?? 0) > 0).map(c => {
    const v = counts.get(c)!
    const seg = { cat: c, frac: v / total, offset: acc / total }
    acc += v
    return seg
  })
  return (
    <svg viewBox="0 0 120 120" className="w-36 h-36">
      <circle cx="60" cy="60" r={R} fill="none" stroke="#1f2937" strokeWidth="14" />
      {segs.map(s => (
        <circle key={s.cat} cx="60" cy="60" r={R} fill="none"
          stroke={CAT_COLOR[s.cat]} strokeWidth="14"
          strokeDasharray={`${Math.max(s.frac * C - 1.5, 0.5)} ${C}`}
          strokeDashoffset={-s.offset * C}
          transform="rotate(-90 60 60)" strokeLinecap="butt" />
      ))}
      <text x="60" y="56" textAnchor="middle" fill="white" fontSize="20" fontWeight="700">{total.toLocaleString()}</text>
      <text x="60" y="72" textAnchor="middle" fill="#94a3b8" fontSize="9">도구 호출</text>
    </svg>
  )
}

export default async function AiLogPage() {
  const session = await auth()
  const me = session?.user as any
  const myUserId: string | null = me?.id ?? null
  const isPrivileged = me?.role === 'admin' || me?.role === 'ceo'

  const from30 = daysAgoKst(30)
  const since28 = new Date(Date.now() - 28 * 86400_000)
  const since7 = new Date(Date.now() - 7 * 86400_000)

  const [rawRows, feedbacks, logByCat, log28, logUsers, aiActivityCount, typeCounts] = await Promise.all([
    prisma.workActivity.findMany({
      where: { source: 'mcp', date: { gte: from30 } },
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
      take: 50,
      select: { id: true, userName: true, content: true, status: true, replyContent: true, repliedByName: true, createdAt: true },
    }),
    prisma.mcpLog.groupBy({ by: ['category'], _count: { _all: true } }),
    prisma.mcpLog.findMany({
      where: { createdAt: { gte: since28 } },
      select: { category: true, createdAt: true },
    }),
    prisma.mcpLog.groupBy({ by: ['userId'] }),
    prisma.workActivity.count({ where: { source: 'mcp' } }),
    prisma.workActivity.groupBy({ by: ['type'], _count: { _all: true } }),
  ])

  // ── ① 집계 ──
  const catCounts = new Map<string, number>()
  for (const g of logByCat) catCounts.set(CATS.includes(g.category as any) ? g.category : '기타',
    (catCounts.get(CATS.includes(g.category as any) ? g.category : '기타') ?? 0) + g._count._all)
  const totalCalls = [...catCounts.values()].reduce((a, b) => a + b, 0)
  const weekCalls = log28.filter(l => l.createdAt >= since7).length
  const aiUserIds = new Set<string>(logUsers.map(u => u.userId))
  for (const r of rawRows) if (r.userId) aiUserIds.add(r.userId)

  // ── ④ 추이 (최근 28일, KST 일별 × 카테고리) ──
  const dayKeys = Array.from({ length: 28 }, (_, i) => daysAgoKst(27 - i))
  const byDay = new Map<string, Map<string, number>>(dayKeys.map(k => [k, new Map()]))
  for (const l of log28) {
    const k = kstDay(l.createdAt)
    const m = byDay.get(k)
    if (!m) continue
    const c = CATS.includes(l.category as any) ? l.category : '기타'
    m.set(c, (m.get(c) ?? 0) + 1)
  }
  const maxDay = Math.max(1, ...dayKeys.map(k => [...byDay.get(k)!.values()].reduce((a, b) => a + b, 0)))

  // ── ③ 온톨로지 ──
  const ontology = typeCounts
    .map(t => ({ type: t.type, count: t._count._all }))
    .sort((a, b) => b.count - a.count)
  const ontologyTotal = ontology.reduce((a, b) => a + b.count, 0)

  // ── 최근 AI 기록 (공개여부 반영 — 업무공간과 같은 규칙) ──
  const rows = rawRows
    .filter(r => isPrivileged || (r.visibility ?? '공개') !== '전체 비공개' || r.userId === myUserId)
    .map(r => (!isPrivileged && (r.visibility ?? '공개') === '제목만 공개' && r.userId !== myUserId)
      ? { ...r, content: null }
      : r)

  return (
    <div className="p-6">
      {/* 헤더 (공통 스타일: 검은 배경 + 둥근 모서리) */}
      <div className="px-6 py-4 mb-5 rounded-xl" style={{ backgroundColor: '#111111' }}>
        <h1 className="text-xl font-bold text-white">AI 업무 기록</h1>
        <p className="text-[11px] mt-0.5" style={{ color: '#C5D42A' }}>
          개인 AI(Claude·ChatGPT 등)와 WARP 가 함께 일한 기록 — 연결은 내 계정 → AI 연결에서
        </p>
      </div>

      <div className="max-w-5xl space-y-6">

        {/* ① AI 활동 집계 — 어떤 일에 AI 를 쓰는가 */}
        <section className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #0b0f14 0%, #141b24 100%)' }}>
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <div className="text-3xl font-extrabold" style={{ color: '#C5D42A' }}>{totalCalls.toLocaleString()}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">누적 AI 도구 호출</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-white">{weekCalls.toLocaleString()}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">최근 7일 호출</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-white">{aiActivityCount.toLocaleString()}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">AI 로 등록·수정한 활동</div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-white">{aiUserIds.size}<span className="text-base font-semibold text-slate-400"> 명</span></div>
                <div className="text-[11px] text-slate-400 mt-0.5">AI 와 함께 일하는 사람</div>
              </div>
            </div>
            <div className="flex items-center gap-5">
              {totalCalls > 0 ? (
                <Donut counts={catCounts} total={totalCalls} />
              ) : (
                <div className="w-36 h-36 rounded-full border-[14px] border-slate-800 flex items-center justify-center text-[10px] text-slate-500 text-center">
                  오늘부터<br />집계 시작
                </div>
              )}
              <div className="space-y-1.5">
                {CATS.map(c => (
                  <div key={c} className="flex items-center gap-2 text-xs">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CAT_COLOR[c] }} />
                    <span className="text-slate-300 w-14">{c}</span>
                    <span className="text-slate-500">{(catCounts.get(c) ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-4">
            업무 기록·회의실 예약·사내 스킬·피드백 — AI 도구 호출 전체 집계입니다 (2026-10-13부터, 호출 내용은 저장하지 않음).
          </p>
        </section>

        {/* ② 피드백 로그 */}
        <section>
          <h2 className="text-sm font-bold text-slate-800 mb-1">AI 연결 피드백</h2>
          <p className="text-[11px] text-slate-400 mb-3">
            AI 와 대화하다 &ldquo;이 의견 피드백으로 남겨줘&rdquo;라고 하면 여기에 쌓입니다. 답변은 제안함에서 관리자가 답니다.
          </p>
          {feedbacks.length === 0 ? (
            <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg p-5 text-center">
              아직 피드백이 없습니다.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[11px] text-slate-400 border-b border-slate-200 bg-slate-50">
                    <th className="py-2 px-3 font-medium w-20">날짜</th>
                    <th className="py-2 px-3 font-medium w-20">작성자</th>
                    <th className="py-2 px-3 font-medium">피드백</th>
                    <th className="py-2 px-3 font-medium w-56">답변</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.map(f => (
                    <tr key={f.id} className="border-b border-slate-100 align-top last:border-b-0">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-xs">
                        {f.createdAt.toISOString().slice(5, 10).replace('-', '/')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-xs font-semibold">{f.userName}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-700 whitespace-pre-wrap">{f.content}</td>
                      <td className="py-2.5 px-3 text-[11px]">
                        {f.replyContent ? (
                          <span className="text-slate-500 whitespace-pre-wrap">
                            <b className="text-slate-600">{f.repliedByName ?? '관리자'}</b> — {f.replyContent}
                          </span>
                        ) : (
                          <span className="text-slate-300">대기 중</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ③·④ 온톨로지 + 사용 추이 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="border border-slate-200 rounded-2xl bg-white p-5">
            <h2 className="text-sm font-bold text-slate-800">업무 온톨로지</h2>
            <p className="text-[11px] text-slate-400 mb-4">
              WARP 에 쌓인 전체 활동 {ontologyTotal.toLocaleString()}건의 유형 지도 — 글자가 클수록 많이 쌓인 일입니다.
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              {ontology.map((t, i) => {
                const size = 11 + Math.min(11, Math.round(Math.sqrt(t.count) * 1.6))
                const top = i < 3
                return (
                  <span key={t.type} title={`${t.type} ${t.count}건`}
                    className={`px-2 py-0.5 rounded-lg border ${top
                      ? 'border-[#C5D42A] bg-[#C5D42A]/15 text-[#5c6e00] font-bold'
                      : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                    style={{ fontSize: `${size}px` }}>
                    {t.type}<span className="ml-1 opacity-50 text-[0.7em]">{t.count}</span>
                  </span>
                )
              })}
            </div>
          </section>

          <section className="border border-slate-200 rounded-2xl bg-white p-5">
            <h2 className="text-sm font-bold text-slate-800">AI 사용 추이</h2>
            <p className="text-[11px] text-slate-400 mb-4">최근 4주 · 일별 도구 호출 (유형별 색)</p>
            <div className="flex items-end gap-[3px] h-28">
              {dayKeys.map(k => {
                const m = byDay.get(k)!
                const dayTotal = [...m.values()].reduce((a, b) => a + b, 0)
                return (
                  <div key={k} className="flex-1 flex flex-col-reverse rounded-sm overflow-hidden"
                    title={`${k} · ${dayTotal}건`}>
                    {dayTotal === 0 ? (
                      <div className="h-[2px] bg-slate-100" />
                    ) : CATS.map(c => {
                      const v = m.get(c) ?? 0
                      if (!v) return null
                      return <div key={c} style={{ height: `${Math.max((v / maxDay) * 104, 3)}px`, backgroundColor: CAT_COLOR[c] }} />
                    })}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
              <span>{dayKeys[0].slice(5).replace('-', '/')}</span>
              <span>{dayKeys[13].slice(5).replace('-', '/')}</span>
              <span>{dayKeys[27].slice(5).replace('-', '/')}</span>
            </div>
          </section>
        </div>

        {/* 최근 AI 업무 기록 */}
        <section>
          <h2 className="text-sm font-bold text-slate-800 mb-3">최근 AI 업무 기록 <span className="text-[11px] font-normal text-slate-400">(30일)</span></h2>
          {rows.length === 0 ? (
            <div className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg p-8 text-center">
              아직 AI로 기록된 활동이 없습니다.<br />
              <b>내 계정 → AI 연결</b>에서 토큰을 발급해 Claude나 ChatGPT에 등록한 뒤,
              &ldquo;오늘 한 일 WARP에 정리해줘&rdquo;라고 해보세요.
            </div>
          ) : (
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
          )}
        </section>
      </div>
    </div>
  )
}
