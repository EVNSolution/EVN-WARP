'use client'

/**
 * buildup-ev 고객 역방향 수집 팝업 (#7) — 고객관리 「buildup에서 불러오기」.
 *
 * WARP 리스트가 전체 고객의 모판이 되도록, buildup 견적에서 생긴 고객을
 * 「신규 / 중복 의심 / 이미 연결됨」으로 갈라 보여주고 **사람이 승인**해야 등록한다.
 * 중복 의심의 기본값은 「건너뛰기」다 — 확신 없는 병합·등록이 모판을 오염시키는 것보다
 * 이번에 안 가져오는 쪽이 낫다(다음에 다시 뜬다).
 */
import { useEffect, useState } from 'react'
import type { BuildupCustomer, ImportClass } from '@/lib/buildup-import/classify'

interface PreviewItem {
  customer: BuildupCustomer
  classification: ImportClass
}
interface Preview {
  items: PreviewItem[]
  counts: { new: number; suspect: number; linked: number }
}

/** 중복 의심 1건에 대한 사용자의 선택. */
type SuspectChoice = { action: 'skip' } | { action: 'create' } | { action: 'link'; warpCustomerId: string }

export function BuildupImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<{ created: number; linked: number; skipped: number[] } | null>(null)
  /** 신규 항목 체크 여부 (기본 전체 선택) */
  const [newChecked, setNewChecked] = useState<Record<number, boolean>>({})
  /** 중복 의심 항목 선택 (기본 건너뛰기) */
  const [suspectChoice, setSuspectChoice] = useState<Record<number, SuspectChoice>>({})

  useEffect(() => {
    fetch('/api/buildup-import')
      .then(async res => {
        if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `조회 실패 (${res.status})`)
        return res.json() as Promise<Preview>
      })
      .then(p => {
        setPreview(p)
        const checked: Record<number, boolean> = {}
        for (const i of p.items) if (i.classification.kind === 'new') checked[i.customer.id] = true
        setNewChecked(checked)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'buildup 조회에 실패했습니다'))
  }, [])

  const newItems = preview?.items.filter(i => i.classification.kind === 'new') ?? []
  const suspectItems = preview?.items.filter(i => i.classification.kind === 'suspect') ?? []
  const selectedCount = newItems.filter(i => newChecked[i.customer.id]).length
    + suspectItems.filter(i => (suspectChoice[i.customer.id]?.action ?? 'skip') !== 'skip').length

  async function apply() {
    if (!preview || applying) return
    const decisions: { buildupId: number; action: 'create' | 'link'; warpCustomerId?: string }[] = []
    for (const i of newItems) {
      if (newChecked[i.customer.id]) decisions.push({ buildupId: i.customer.id, action: 'create' })
    }
    for (const i of suspectItems) {
      const c = suspectChoice[i.customer.id]
      if (!c || c.action === 'skip') continue
      decisions.push(c.action === 'create'
        ? { buildupId: i.customer.id, action: 'create' }
        : { buildupId: i.customer.id, action: 'link', warpCustomerId: c.warpCustomerId })
    }
    if (decisions.length === 0) return
    setApplying(true)
    setError('')
    try {
      const res = await fetch('/api/buildup-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions }),
      })
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `반영 실패 (${res.status})`)
      const r = await res.json() as { created: number; linked: number; skipped: number[] }
      setResult(r)
      onDone() // 목록 갱신 — 팝업은 결과 확인용으로 남긴다
    } catch (e) {
      setError(e instanceof Error ? e.message : '반영에 실패했습니다')
    } finally {
      setApplying(false)
    }
  }

  const line = (c: BuildupCustomer) =>
    [c.name, c.ceo_name && `(대표 ${c.ceo_name})`, c.phone, c.tel && `유선 ${c.tel}`, c.reg_no]
      .filter(Boolean).join(' · ')

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-[720px] max-w-full max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-bold text-slate-800">buildup에서 불러오기</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">견적 시스템(buildup)에서 생긴 고객을 점검하고 승인하면 CRM에 등록됩니다.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition text-base leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-xs">
          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">{error}</div>}
          {!preview && !error && <div className="text-slate-400 py-8 text-center">buildup에서 고객을 가져오는 중…</div>}

          {result && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2">
              신규 등록 <b>{result.created}</b>건 · 기존 고객 연결 <b>{result.linked}</b>건
              {result.skipped.length > 0 && <> · 건너뜀 {result.skipped.length}건(그 사이 변경됨)</>} — 완료되었습니다.
            </div>
          )}

          {preview && !result && (
            <>
              {/* 신규 */}
              <section>
                <h3 className="font-bold text-slate-700 mb-1.5">
                  신규 <span className="text-sky-600">{preview.counts.new}</span>건
                  <span className="font-normal text-slate-400"> — WARP에 없는 고객. 체크된 항목이 등록됩니다.</span>
                </h3>
                {newItems.length === 0
                  ? <div className="text-slate-400">없음</div>
                  : newItems.map(({ customer: c }) => (
                    <label key={c.id} className="flex items-center gap-2 py-1 border-b border-slate-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!newChecked[c.id]}
                        onChange={e => setNewChecked(p => ({ ...p, [c.id]: e.target.checked }))}
                      />
                      <span className="text-slate-700">{line(c)}</span>
                    </label>
                  ))}
              </section>

              {/* 중복 의심 */}
              <section>
                <h3 className="font-bold text-slate-700 mb-1.5">
                  중복 의심 <span className="text-amber-600">{preview.counts.suspect}</span>건
                  <span className="font-normal text-slate-400"> — 기본은 건너뛰기. 같은 고객이면 「연결」을 고르세요.</span>
                </h3>
                {suspectItems.length === 0
                  ? <div className="text-slate-400">없음</div>
                  : suspectItems.map(({ customer: c, classification }) => {
                    if (classification.kind !== 'suspect') return null
                    const choice = suspectChoice[c.id] ?? { action: 'skip' }
                    return (
                      <div key={c.id} className="py-2 border-b border-slate-100">
                        <div className="text-slate-700 font-semibold">{line(c)}</div>
                        <div className="mt-1 space-y-0.5">
                          {classification.matches.map(m => (
                            <label key={m.warpId} className="flex items-center gap-2 text-slate-600 cursor-pointer">
                              <input
                                type="radio"
                                name={`suspect-${c.id}`}
                                checked={choice.action === 'link' && choice.warpCustomerId === m.warpId}
                                onChange={() => setSuspectChoice(p => ({ ...p, [c.id]: { action: 'link', warpCustomerId: m.warpId } }))}
                              />
                              기존 <b>{m.warpName}{m.warpCompanyName ? ` (${m.warpCompanyName})` : ''}</b> 에 연결
                              <span className="text-amber-600">[{m.reasons.join(', ')}]</span>
                            </label>
                          ))}
                          <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                            <input
                              type="radio"
                              name={`suspect-${c.id}`}
                              checked={choice.action === 'create'}
                              onChange={() => setSuspectChoice(p => ({ ...p, [c.id]: { action: 'create' } }))}
                            />
                            동명이인 등 — 별도 신규로 등록
                          </label>
                          <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                            <input
                              type="radio"
                              name={`suspect-${c.id}`}
                              checked={choice.action === 'skip'}
                              onChange={() => setSuspectChoice(p => ({ ...p, [c.id]: { action: 'skip' } }))}
                            />
                            이번엔 건너뛰기
                          </label>
                        </div>
                      </div>
                    )
                  })}
              </section>

              {/* 이미 연결됨 */}
              <p className="text-slate-400">
                이미 연결된 고객 <b>{preview.counts.linked}</b>건은 목록에서 제외했습니다.
              </p>
            </>
          )}
        </div>

        <div className="flex gap-2 px-5 py-3.5 border-t border-slate-200">
          {result ? (
            <button onClick={onClose}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 transition">
              닫기
            </button>
          ) : (
            <>
              <button
                onClick={() => void apply()}
                disabled={!preview || applying || selectedCount === 0}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-40">
                {applying ? '반영 중…' : `승인 — ${selectedCount}건 반영`}
              </button>
              <button onClick={onClose} disabled={applying}
                className="flex-1 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                취소
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
