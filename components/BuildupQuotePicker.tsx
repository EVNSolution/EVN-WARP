'use client'

import { useRef, useState } from 'react'
import type { BuildupQuoteSnapshot, BuildupQuoteSummary } from '@/lib/buildup-import/quotes'
import type { SalesProcessData } from '@/lib/sales-process'

type Preview = Omit<BuildupQuoteSnapshot,'pdfBase64'>
export interface QuoteImportResult {
  document: {id:string;docKey:string;docLabel:string;fileName:string;filePath:string;fileSize:number;uploadedAt:string}
  salesProcess:SalesProcessData; revision:number; checks:Record<string,boolean|string>
}
export default function BuildupQuotePicker({dealId, revision, saved, hasQuote, onImported}: {
  dealId:string;revision:number;saved:boolean;hasQuote:boolean;onImported:(value:QuoteImportResult)=>void
}) {
  const [quotes,setQuotes] = useState<BuildupQuoteSummary[]|null>(null)
  const [hasMore,setHasMore] = useState(false)
  const [preview,setPreview] = useState<Preview|null>(null)
  const [selected,setSelected] = useState('')
  const [reason,setReason] = useState('')
  const [busy,setBusy] = useState(false)
  const [applying,setApplying] = useState(false)
  const [message,setMessage] = useState('')
  const request = useRef(0)
  const url = `/api/deals/${dealId}/buildup-quotes`
  async function read(target:string) {
    const response = await fetch(target, {cache:'no-store'})
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || '견적서를 조회하지 못했습니다.')
    return body
  }
  async function load() {
    setBusy(true);setMessage('');setPreview(null);setSelected('')
    try { const data=await read(url);setQuotes(data.quotes);setHasMore(data.hasMore) }
    catch(e) {setMessage(e instanceof Error?e.message:'조회 실패')}
    finally {setBusy(false)}
  }
  async function choose(value:string) {
    const sequence=++request.current
    setSelected(value);setPreview(null);setMessage('')
    if (!value) return
    setBusy(true)
    try { const data=await read(`${url}?quoteId=${value}`);if(sequence===request.current)setPreview(data) }
    catch(e) {if(sequence===request.current)setMessage(e instanceof Error?e.message:'견적 조회 실패')}
    finally {if(sequence===request.current)setBusy(false)}
  }
  async function apply() {
    if (!preview || !saved) return
    setApplying(true);setMessage('')
    try {
      const response = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        quoteId:preview.quoteId,version:preview.version,revision,reason:reason.trim() || 'BuildUP EV 견적서 선택',
      })})
      const data=await response.json()
      if (!response.ok) throw new Error(data.error || '견적서를 적용하지 못했습니다.')
      onImported(data);setPreview(null);setSelected('');setReason('')
      setMessage('견적서와 수치를 저장했습니다. 고객과 합의한 확정일을 입력하고 최종 확정을 확인해 주세요.')
    } catch(e) {setMessage(e instanceof Error?e.message:'견적서 적용 실패')}
    finally {setApplying(false)}
  }
  return <section aria-label="BuildUP EV 견적서 선택" className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
    {applying && <div role="status" aria-live="polite" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/20"><div className="rounded-xl bg-white p-5 shadow-lg">견적서와 수치를 저장하고 있습니다…</div></div>}
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold text-blue-900">BuildUP EV 견적서에서 가져오기</h3>
      <button type="button" onClick={load} disabled={busy||applying} className="min-h-11 rounded-lg border border-blue-300 bg-white px-3 text-sm font-semibold text-blue-800 disabled:opacity-50">{busy?'조회 중…':'연결된 고객 견적 조회'}</button></div>
    <p className="text-xs text-slate-600">BuildUP EV에서 이 WARP 고객과 연결된 견적서를 선택하세요. 고객 연결이 없으면 BuildUP EV에서 먼저 연결해 주세요.</p>
    {quotes && <><label className="block text-sm font-medium text-slate-700">최종으로 사용할 견적서
      <select value={selected} onChange={e=>choose(e.target.value)} disabled={busy||applying} className="mt-1 w-full min-h-11 rounded-lg border border-slate-300 bg-white p-2 text-base sm:text-sm">
        <option value="">견적서를 선택하세요</option>
        {quotes.map(q=><option key={q.id} value={q.id}>{q.quoteNo||`견적 #${q.id}`} · {q.model} · {q.updatedAt.slice(0,10)} · {q.frozenAt?'서류 고정':q.sentAt?'이메일 발송 이력 있음':q.status==='draft'?'임시저장 · 발송 미확인':'발송 미확인'}</option>)}
      </select></label>
      {quotes.length===0 && <p className="text-sm text-slate-600">연결된 견적서가 없습니다. BuildUP EV의 고객 연결과 견적 저장 여부를 확인해 주세요.</p>}
      {hasMore && <p className="text-xs text-amber-800">최근 견적서 100건을 표시합니다. 이전 견적서는 BuildUP EV에서 확인해 주세요.</p>}</>}
    {preview && <div className="rounded-lg border border-blue-200 bg-white p-3 space-y-3">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
        <div><dt className="text-slate-500">차량 모델</dt><dd className="font-semibold break-words">{preview.model}</dd></div>
        <div><dt className="text-slate-500">견적 원본</dt><dd>{preview.quoteNo||`#${preview.quoteId}`} · {preview.frozen?'발송 고정본':'현재 저장 내용으로 생성'}</dd></div>
        <div><dt className="text-slate-500">차량·특장 총액</dt><dd className="font-bold">{preview.grossAmountWon.toLocaleString('ko-KR')}원</dd></div>
        <div><dt className="text-slate-500">실구매가(기타 포함)</dt><dd className="font-bold">{preview.amountWon.toLocaleString('ko-KR')}원</dd></div>
        <div className="sm:col-span-2"><dt className="text-slate-500">확정 사양</dt><dd className="break-words whitespace-pre-wrap">{preview.spec}</dd></div>
      </dl>
      <p className="text-xs text-slate-500">총액: BuildUP EV의 차량·특장 가격 합계(VAT 포함, 탁송료 제외). 실구매가(기타 포함): 할인·보조금·세금·등록비 등 부대비용을 반영한 최종 합계입니다. 현재 생성본은 과거 발송본과 다를 수 있습니다.</p>
      {hasQuote && <label className="block text-sm text-slate-700">기존 견적 교체 사유<input value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000} className="mt-1 w-full min-h-11 rounded-lg border border-slate-300 p-2" /></label>}
      <p className="text-xs text-slate-600">적용하면 견적서와 수치를 저장하고 기존 최종 확정 체크·확정일을 비웁니다. 고객과 합의한 날짜를 다시 입력해 주세요.</p>
      {!saved && <p role="alert" className="text-sm text-amber-800">화면에서 수정 중인 내용을 먼저 저장한 뒤 적용해 주세요.</p>}
      <button type="button" disabled={busy||applying||!saved||(hasQuote&&!reason.trim())} onClick={apply} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40">이 견적서로 적용·저장</button>
    </div>}
    {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
  </section>
}
