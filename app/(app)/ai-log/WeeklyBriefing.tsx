'use client'

import { useMemo, useState } from 'react'
import DigestRefresh from './DigestRefresh'

/**
 * 주간회의 브리핑 — 지난 회의(월/목 10시) 이후 WARP에 기록된 모든 업무를 AI가 팀별로 요약.
 * 팀이 많아도 복잡하지 않게 팀 탭을 넘기며 본다. 회의 중 「새로고침」으로 방금 기록까지 반영.
 */

export default function WeeklyBriefing({ windowLabel, generatedAt, activityCount, peopleCount, source, text }: {
  windowLabel: string
  generatedAt: string // HH:MM
  activityCount: number
  peopleCount: number
  source: 'ai' | 'rule'
  text: string
}) {
  const sections = useMemo(() => {
    const out: { team: string; lines: string[] }[] = []
    let cur: { team: string; lines: string[] } | null = null
    for (const raw of text.split('\n')) {
      const line = raw.trim()
      if (line.startsWith('## ')) {
        cur = { team: line.slice(3).trim(), lines: [] }
        out.push(cur)
      } else if (line && cur) {
        cur.lines.push(line)
      } else if (line && !cur) {
        cur = { team: '전체', lines: [line] }
        out.push(cur)
      }
    }
    return out
  }, [text])

  const headline = sections.find(s => s.team === '전체')
  const teams = sections.filter(s => s.team !== '전체')
  const [active, setActive] = useState(0)
  const current = teams[Math.min(active, Math.max(teams.length - 1, 0))]

  return (
    <section className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
      <div className="px-6 py-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-slate-50/60">
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
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-slate-400">{generatedAt} 생성</span>
          <DigestRefresh />
        </div>
      </div>

      <div className="px-6 py-4">
        {headline && headline.lines.length > 0 && (
          <p className="text-sm font-semibold text-slate-700 mb-3 pb-3 border-b border-dashed border-slate-100">
            {headline.lines.map(l => l.replace(/^-\s*/, '')).join(' ')}
          </p>
        )}

        {teams.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">{text}</p>
        ) : (
          <>
            {/* 팀 탭 — 넘기면서 본다 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {teams.map((s, i) => (
                <button key={s.team} onClick={() => setActive(i)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    i === active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}>
                  {s.team}
                </button>
              ))}
            </div>
            <div className="space-y-1.5 min-h-[88px]">
              {current?.lines.map((l, i) => (
                <p key={i} className="text-sm text-slate-700 leading-relaxed pl-4 relative">
                  <span className="absolute left-0 text-[#7a9200]">▸</span>
                  {l.replace(/^-\s*/, '')}
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
