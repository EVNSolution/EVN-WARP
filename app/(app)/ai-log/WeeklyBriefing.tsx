'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DigestRefresh from './DigestRefresh'

/**
 * 주간회의 브리핑 — 지난 회의(월/목 10시) 이후 WARP에 기록된 모든 업무를 팀 탭으로 넘기며 본다.
 * 팀마다 유형별 집계 한 줄(서버 계산) + AI 종합 서술 불릿 3~5개. 카드 높이는 고정.
 */

export interface BriefingTeam { name: string; stats: string; headline?: string; bullets: string[] }

export default function WeeklyBriefing({ windowLabel, generatedAt, activityCount, peopleCount, source, aiError, teams }: {
  windowLabel: string
  generatedAt: string // HH:MM
  activityCount: number
  peopleCount: number
  source: 'ai' | 'rule'
  aiError?: string
  teams: BriefingTeam[]
}) {
  const [active, setActive] = useState(0)
  const current = teams[Math.min(active, Math.max(teams.length - 1, 0))]
  const router = useRouter()

  // 집계 폴백(AI 생성 중) 상태면 — 완성을 기다렸다가 화면을 자동으로 AI 요약으로 교체한다.
  // refresh API 는 생성이 끝날 때까지 기다렸다 응답하므로, 응답이 오면 바로 다시 그리면 된다.
  useEffect(() => {
    if (source !== 'rule' || aiError || activityCount === 0) return
    let cancelled = false
    const t = setTimeout(async () => {
      try { await fetch('/api/ai-digest/refresh', { method: 'POST' }) } catch { /* 다음 수동 새로고침에 맡긴다 */ }
      if (!cancelled) router.refresh()
    }, 5000)
    return () => { cancelled = true; clearTimeout(t) }
  }, [source, aiError, activityCount, router])

  return (
    <section className="border border-slate-200 rounded-2xl bg-white overflow-hidden lg:col-span-2 h-[26rem] flex flex-col">
      <div className="px-6 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-slate-100 bg-slate-50/60 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-slate-800">
            주간회의 브리핑
            {source === 'ai' && (
              <span className="ml-2 align-middle text-[10px] px-1.5 py-0.5 rounded-md bg-[#C5D42A]/20 text-[#7a9200] font-semibold">AI 요약</span>
            )}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {windowLabel} · 기록 {activityCount}건 · {peopleCount}명 — 무슨 일이 진행되고 있는지 요약
          </p>
          {source === 'rule' && aiError && (
            <p className="text-[10px] text-amber-600 mt-0.5">AI 요약 실패: {aiError}</p>
          )}
          {source === 'rule' && !aiError && activityCount > 0 && (
            <p className="text-[10px] text-slate-400 mt-0.5">AI 요약 생성 중 — 잠시 후 새로고침하면 종합 서술로 바뀝니다</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-slate-400">{generatedAt} 생성</span>
          <DigestRefresh />
        </div>
      </div>

      <div className="px-6 py-4 flex-1 min-h-0 overflow-y-auto">
        {teams.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">지난 회의 이후 기록된 활동이 아직 없습니다.</p>
        ) : (
          <>
            {/* 팀 탭 — 넘기면서 본다 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {teams.map((t, i) => (
                <button key={t.name} onClick={() => setActive(i)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    i === active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}>
                  {t.name}
                </button>
              ))}
            </div>

            {current && (
              <>
                {/* 팀 한 줄 요약 — 그 팀의 기간 전체를 관통하는 헤드라인 */}
                {current.headline && (
                  <p className="text-sm font-semibold text-slate-700 mb-2.5 pb-2.5 border-b border-dashed border-slate-100">
                    {current.headline}
                  </p>
                )}
                {/* 유형별 집계 — 무엇을 몇 건 했는지 */}
                <p className="text-[11px] font-semibold text-[#7a9200] bg-[#C5D42A]/10 border border-[#C5D42A]/30 rounded-lg px-3 py-1.5 mb-3 inline-block">
                  {current.stats}
                </p>
                <div className="space-y-1.5">
                  {current.bullets.map((l, i) => (
                    <p key={i} className="text-sm text-slate-700 leading-relaxed pl-4 relative">
                      <span className="absolute left-0 text-[#7a9200]">▸</span>
                      {l}
                    </p>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}
