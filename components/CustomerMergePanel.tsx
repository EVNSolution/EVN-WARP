'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GitMerge, Search } from 'lucide-react'

type Customer = { id: string; name: string; phone: string | null; status: string; leadCount: number; createdAt: string }
type Group = { phone: string; name: string; customers: Customer[] }
type DuplicateResult = {
  total: number; dupCount: number; groupCount: number; groups: Group[]
  leadGroups?: { phone: string; associationMismatch?: boolean; crossCustomer?: boolean;
    leads: { id: string; name: string; stageCode: string | null; salesStatus: string | null }[] }[]
}
type Field = {
  key: string; label: string; keepValue: unknown; removeValue: unknown; resultValue: unknown
  mode: 'same' | 'fill' | 'automatic' | 'conflict'; requiresChoice: boolean
}
type Preview = {
  keep: { id: string; name: string }; remove: { id: string; name: string }; previewToken: string
  fields: Field[]; counts: { leads: number; activities: number; agents: number; events: number }; warnings: string[]
}

function display(value: unknown): string {
  if (value == null || value === '') return '미입력'
  if (typeof value === 'boolean') return value ? '예' : '아니오'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

export default function CustomerMergePanel() {
  const router = useRouter()
  const [result, setResult] = useState<DuplicateResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [keepIds, setKeepIds] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<Preview | null>(null)
  const [choices, setChoices] = useState<Record<string, 'keep' | 'remove'>>({})
  const [confirmed, setConfirmed] = useState(false)
  const [showSame, setShowSame] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (preview) {
      previewRef.current?.focus()
      previewRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [preview])

  async function loadDuplicates() {
    const response = await fetch('/api/migrate/find-duplicates', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '중복 목록을 불러오지 못했습니다.')
    setResult(data)
    setKeepIds({})
  }

  async function search() {
    setBusy(true); setError(''); setMessage(''); setPreview(null)
    try { await loadDuplicates() }
    catch (e) { setError(e instanceof Error ? e.message : '연결 상태를 확인해 주세요.') }
    finally { setBusy(false) }
  }

  async function compare(keepId: string, removeId: string) {
    setBusy(true); setError(''); setMessage(''); setPreview(null); setChoices({}); setConfirmed(false)
    setShowSame(false)
    try {
      const query = new URLSearchParams({ keepId, removeId })
      const response = await fetch(`/api/migrate/merge-customers?${query}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '고객 정보를 비교하지 못했습니다.')
      setPreview(data)
    } catch (e) { setError(e instanceof Error ? e.message : '연결 상태를 확인해 주세요.') }
    finally { setBusy(false) }
  }

  async function merge() {
    if (!preview || !confirmed) return
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/migrate/merge-customers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepId: preview.keep.id, removeId: preview.remove.id,
          previewToken: preview.previewToken, choices, confirmed: true }),
      })
      const data = await response.json()
      if (!response.ok) {
        if (response.status === 409) { setPreview(null); setConfirmed(false) }
        throw new Error(data.error || '병합하지 못했습니다. 다시 비교해 주세요.')
      }
      setPreview(null); setConfirmed(false)
      setMessage(data.message || '고객 정보가 병합되었습니다. 리드와 상담 이력은 보존했습니다.')
      router.refresh()
      try { await loadDuplicates() }
      catch { setResult(null); setError('병합은 완료됐지만 목록 갱신에 실패했습니다. 중복 검색으로 다시 확인해 주세요.') }
    } catch (e) { setError(e instanceof Error ? e.message : '응답을 확인하지 못했습니다. 다시 검색해 결과를 확인해 주세요.') }
    finally { setBusy(false) }
  }

  const conflicts = preview?.fields.filter(f => f.requiresChoice) ?? []
  const unresolved = conflicts.filter(f => !choices[f.key]).length
  const actionStyle = 'rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40'

  return <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden" aria-label="중복 고객 통합">
    <header className="flex flex-wrap items-center justify-between gap-3 bg-[#111111] px-5 py-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-white"><GitMerge size={16} /> 중복 고객 통합</h2>
        <p className="mt-1 text-xs text-[#C5D42A]">휴대폰 번호로 비교 · 고객 하나에 리드와 상담 이력 함께 보관</p>
      </div>
      <button onClick={search} disabled={busy} className="flex items-center gap-2 rounded-lg bg-[#C5D42A] px-4 py-2 text-xs font-bold text-slate-900 disabled:opacity-40">
        <Search size={14} />{busy ? '처리 중…' : '중복 검색'}
      </button>
    </header>
    <div className="space-y-5 p-5">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {!result && <p className="text-sm text-slate-500">중복 검색으로 고객과 리드를 확인하세요. 검색만으로 데이터가 변경되지는 않습니다.</p>}
      {result && <>
        <p className="text-sm text-slate-700">전체 고객 <strong>{result.total}</strong>건 · 중복 번호 <strong>{result.groupCount}</strong>개 · 병합 후보 <strong>{result.dupCount}</strong>건</p>
        {result.groups.length === 0 && <p className="text-sm text-emerald-700">같은 휴대폰 번호로 등록된 고객이 없습니다.</p>}
        {result.groups.map(group => {
          const keepId = keepIds[group.phone] ?? group.customers[0].id
          return <div key={group.phone} className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{group.phone} <span className="text-slate-500">· 고객 {group.customers.length}건</span></h3>
              <label className="text-xs text-slate-600">남길 고객
                <select aria-label={`${group.phone} 남길 고객`} value={keepId} disabled={busy}
                  onChange={e => { setKeepIds(prev => ({ ...prev, [group.phone]: e.target.value })); setPreview(null); setConfirmed(false) }}
                  className="ml-2 rounded-md border border-slate-300 bg-white p-2 text-sm">
                  {group.customers.map(c => <option key={c.id} value={c.id}>{c.name || '이름 미입력'} · 리드 {c.leadCount}건 · {c.createdAt.slice(0, 10)}</option>)}
                </select>
              </label>
            </div>
            <ul className="divide-y divide-slate-100">
              {group.customers.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="text-sm"><Link href={`/customers/${c.id}`} className="font-medium text-slate-900 underline underline-offset-4">{c.name || '이름 미입력'}</Link>
                  <p className="mt-1 text-xs text-slate-500">{c.status} · 리드 {c.leadCount}건 · {c.createdAt.slice(0, 10)} 생성</p>
                </div>
                {c.id === keepId ? <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-semibold">남길 고객</span>
                  : <button className={actionStyle} disabled={busy} onClick={() => compare(keepId, c.id)}>비교하고 병합</button>}
              </li>)}
            </ul>
          </div>
        })}
        {!!result.leadGroups?.length && <details className="rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-semibold">동일 번호의 리드 {result.leadGroups.length}그룹 확인</summary>
          <p className="mt-2 text-xs text-slate-500">재구매·다른 차량 상담일 수 있습니다. 고객 병합 시 리드는 삭제하거나 단계를 변경하지 않습니다.</p>
          <ul className="mt-3 space-y-3">{result.leadGroups.map(g => <li key={g.phone} className="text-sm">
            <strong>{g.phone}</strong> · 리드 {g.leads.length}건
            {g.associationMismatch && <p className="mt-1 text-xs text-amber-700">리드와 연결된 고객의 휴대폰 번호가 다릅니다. 고객 연결을 확인해 주세요.</p>}
            {g.crossCustomer && <p className="mt-1 text-xs text-amber-700">같은 번호의 리드가 서로 다른 고객에 연결되어 있습니다.</p>}
            <div className="mt-1 flex flex-wrap gap-2">{g.leads.map(d => <Link key={d.id} href={`/funnel/${d.id}`} className="rounded-md bg-slate-50 px-2 py-1 text-xs underline">
              {d.name || '이름 미입력'} · {d.stageCode ?? '단계 미입력'} · {d.salesStatus ?? '상태 미입력'}
            </Link>)}</div>
          </li>)}</ul>
        </details>}
      </>}
      {preview && <div ref={previewRef} tabIndex={-1} className="space-y-4 rounded-xl border-2 border-[#C5D42A] p-4" aria-label="병합 결과 미리보기">
        <h3 className="text-base font-semibold">병합 결과 미리보기</h3>
        <p className="text-sm text-slate-600"><strong>{preview.keep.name || '이름 미입력'}</strong> 고객을 남기고 <strong>{preview.remove.name || '이름 미입력'}</strong> 고객의 이력을 연결합니다.</p>
        <p className="text-xs text-slate-500">이전할 리드 {preview.counts.leads}건 · 상담 {preview.counts.activities}건 · 소개자 {preview.counts.agents}건 · 연동 이벤트 {preview.counts.events}건</p>
        {preview.warnings.map((w, i) => <p key={i} className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{w}</p>)}
        <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={showSame} onChange={e => setShowSame(e.target.checked)} />같은 값의 항목도 보기</label>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-slate-50"><tr>{['항목', '남길 고객 정보', '합칠 고객 정보', '병합 결과'].map(h => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{preview.fields.filter(f => showSame || f.mode !== 'same').map(f => {
              const value = choices[f.key] === 'remove' ? f.removeValue : choices[f.key] === 'keep' ? f.keepValue : f.resultValue
              return <tr key={f.key} className="border-t border-slate-100 align-top">
                <th scope="row" className="p-3 font-medium">{f.label}{f.requiresChoice && <span className="mt-1 block text-amber-700">선택 필요</span>}</th>
                <td className="max-w-64 whitespace-pre-wrap break-words p-3">{display(f.keepValue)}</td>
                <td className="max-w-64 whitespace-pre-wrap break-words p-3">{display(f.removeValue)}</td>
                <td className="max-w-72 p-3">
                  {f.requiresChoice && <fieldset className="mb-2 flex flex-col gap-2"><legend className="sr-only">{f.label} 병합 값 선택</legend>
                    {(['keep', 'remove'] as const).map(side => <label key={side} className="flex items-center gap-2">
                      <input type="radio" name={`merge-${f.key}`} value={side} checked={choices[f.key] === side} disabled={busy}
                        onChange={() => { setChoices(prev => ({ ...prev, [f.key]: side })); setConfirmed(false) }} />
                      {side === 'keep' ? '남길 고객 값' : '합칠 고객 값'}
                    </label>)}
                  </fieldset>}
                  <p className="whitespace-pre-wrap break-words text-slate-700">{f.requiresChoice && !choices[f.key] ? '값을 선택해 주세요.' : display(value)}</p>
                  {!f.requiresChoice && f.mode !== 'same' && <span className="mt-1 block text-emerald-700">{f.mode === 'fill' ? '빈칸 자동 보완' : '보존 규칙 적용'}</span>}
                </td>
              </tr>
            })}</tbody>
          </table>
        </div>
        {unresolved > 0 && <p className="text-xs text-amber-700">서로 다른 정보 {unresolved}개를 선택하면 병합할 수 있습니다.</p>}
        <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={confirmed} disabled={busy || unresolved > 0}
          onChange={e => setConfirmed(e.target.checked)} />같은 고객임을 확인했고, 위 병합 결과를 확인했습니다. 기존 정보와 병합 선택은 이력으로 보관합니다.</label>
        <div className="flex gap-2">
          <button className={actionStyle} disabled={busy || unresolved > 0 || !confirmed} onClick={merge}>{busy ? '처리 중…' : '확인한 내용으로 병합'}</button>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-xs" disabled={busy} onClick={() => setPreview(null)}>닫기</button>
        </div>
      </div>}
    </div>
  </section>
}
