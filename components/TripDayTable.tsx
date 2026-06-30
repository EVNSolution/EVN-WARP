'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// IME(한글/중문) 조합 중 state 업데이트를 막아 글자 끊김을 방지
function TextCell({ value, onCommit, placeholder, className }: {
  value: string; onCommit: (v: string) => void; placeholder?: string; className?: string
}) {
  const [local, setLocal] = useState(value)
  const composing = useRef(false)
  useEffect(() => { if (!composing.current) setLocal(value) }, [value])
  return (
    <input
      value={local}
      className={className}
      placeholder={placeholder}
      onChange={e => setLocal(e.target.value)}
      onCompositionStart={() => { composing.current = true }}
      onCompositionEnd={e => { composing.current = false; onCommit((e.target as HTMLInputElement).value) }}
      onBlur={e => { if (!composing.current) onCommit(e.target.value) }}
    />
  )
}

function AreaCell({ value, onCommit, placeholder, className }: {
  value: string; onCommit: (v: string) => void; placeholder?: string; className?: string
}) {
  const addBullets = (text: string) => {
    if (!text.trim()) return text
    return text.split('\n').map(line => {
      const t = line.trim()
      return t === '' ? '' : t.startsWith('• ') ? t : '• ' + t
    }).join('\n')
  }
  const [local, setLocal] = useState(() => addBullets(value))
  const composing = useRef(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (!composing.current) setLocal(addBullets(value)) }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !composing.current) {
      e.preventDefault()
      const ta = e.currentTarget
      const s = ta.selectionStart
      const next = local.slice(0, s) + '\n• ' + local.slice(ta.selectionEnd)
      setLocal(next)
      setTimeout(() => ta.setSelectionRange(s + 3, s + 3), 0)
    }
  }
  const handleFocus = () => {
    if (!local.trim()) setLocal('• ')
  }

  return (
    <textarea
      ref={taRef}
      value={local}
      rows={2}
      className={className}
      placeholder={placeholder}
      onChange={e => setLocal(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onCompositionStart={() => { composing.current = true }}
      onCompositionEnd={e => { composing.current = false; onCommit((e.target as HTMLTextAreaElement).value) }}
      onBlur={e => { if (!composing.current) onCommit(e.target.value) }}
    />
  )
}

interface DayRecord {
  id: string
  date: string
  city: string
  company: string
  activity: string
  transportCost: number | null
  transportReceipt: string | null
  accommodationCost: number | null
  accommodationReceipt: string | null
  mealCost: number | null
  mealReceipt: string | null
  otherCost: number | null
  otherReceipt: string | null
}

type CostKey = 'transportCost' | 'accommodationCost' | 'mealCost' | 'otherCost'
type ReceiptKey = 'transportReceipt' | 'accommodationReceipt' | 'mealReceipt' | 'otherReceipt'

const COST_COLS: { label: string; cost: CostKey; receipt: ReceiptKey }[] = [
  { label: '교통비',  cost: 'transportCost',      receipt: 'transportReceipt'      },
  { label: '숙박비',  cost: 'accommodationCost',   receipt: 'accommodationReceipt'  },
  { label: '식비',    cost: 'mealCost',            receipt: 'mealReceipt'           },
  { label: '기타',    cost: 'otherCost',           receipt: 'otherReceipt'          },
]

function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start)
  const last = new Date(end)
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function fmtDate(d: string) {
  const dt = new Date(d)
  return `${dt.getUTCMonth() + 1}월 ${dt.getUTCDate()}일`
}

function fmtKrw(n: number | null | undefined) {
  if (!n) return ''
  return Math.round(n).toLocaleString('ko-KR')
}

function sumCol(rows: DayRecord[], key: CostKey) {
  return rows.reduce((s, r) => s + (r[key] ?? 0), 0)
}

export default function TripDayTable({
  tripId,
  startDate,
  endDate,
}: {
  tripId: string
  startDate: string
  endDate: string
}) {
  const [rows, setRows] = useState<DayRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOver, setDragOver] = useState<{ date: string; col: CostKey } | null>(null)
  const [uploading, setUploading] = useState<{ date: string; col: CostKey } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUpload = useRef<{ date: string; col: CostKey } | null>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const allDates = dateRange(startDate, endDate)

  // ── load ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/trips/${tripId}/days`)
      .then(r => r.json())
      .then((data: DayRecord[]) => {
        setRows(data)
        setLoading(false)
      })
  }, [tripId])

  // row for a date (may not exist yet)
  const rowFor = useCallback((date: string) => rows.find(r => r.date === date), [rows])

  // ── ensure row exists ────────────────────────────────────────────
  const ensureRow = useCallback(async (date: string): Promise<DayRecord> => {
    const existing = rows.find(r => r.date === date)
    if (existing) return existing
    const res = await fetch(`/api/trips/${tripId}/days`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, city: '', company: '', activity: '',
        transportCost: null, transportReceipt: null,
        accommodationCost: null, accommodationReceipt: null,
        mealCost: null, mealReceipt: null,
        otherCost: null, otherReceipt: null,
      }),
    })
    const created: DayRecord = await res.json()
    setRows(prev => [...prev, created])
    return created
  }, [rows, tripId])

  // ── persist row (debounced) ──────────────────────────────────────
  const persist = useCallback((row: DayRecord) => {
    clearTimeout(saveTimers.current[row.id])
    saveTimers.current[row.id] = setTimeout(() => {
      fetch(`/api/trips/${tripId}/days/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      })
    }, 500)
  }, [tripId])

  // ── update field ────────────────────────────────────────────────
  const updateField = useCallback(async (date: string, patch: Partial<DayRecord>) => {
    const row = await ensureRow(date)
    const updated = { ...row, ...patch }
    setRows(prev => prev.map(r => r.date === date ? updated : r))
    persist(updated)
  }, [ensureRow, persist])

  // ── receipt upload + OCR ─────────────────────────────────────────
  const COST_LABEL: Record<CostKey, string> = {
    transportCost:     '교통비',
    accommodationCost: '숙박비',
    mealCost:          '식비',
    otherCost:         '기타',
  }

  const uploadReceipt = useCallback(async (date: string, col: CostKey, file: File) => {
    const receiptKey = col.replace('Cost', 'Receipt') as ReceiptKey
    setUploading({ date, col })
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', COST_LABEL[col])
      fd.append('date', date)
      const res = await fetch(`/api/trips/${tripId}/days/ocr`, { method: 'POST', body: fd })
      const data = await res.json()

      // 현재 행의 기존 금액·영수증 URL 읽기
      const currentRow    = rows.find(r => r.date === date)
      const prevAmount    = (currentRow?.[col]        as number | null) ?? 0
      const prevReceipt   = (currentRow?.[receiptKey] as string | null) ?? ''

      const patch: Partial<DayRecord> = {
        // 영수증 URL 누적 (파이프 구분)
        [receiptKey]: prevReceipt ? `${prevReceipt}|${data.url}` : data.url,
      }
      // 금액 누적 합산
      if (data.amount != null) patch[col] = prevAmount + data.amount

      await updateField(date, patch)
    } finally {
      setUploading(null)
    }
  }, [tripId, updateField, rows])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const p = pendingUpload.current
    if (!p || !e.target.files?.[0]) return
    uploadReceipt(p.date, p.col, e.target.files[0])
    e.target.value = ''
  }, [uploadReceipt])

  // ── totals ───────────────────────────────────────────────────────
  const totals = COST_COLS.map(c => sumCol(rows, c.cost))
  const grandTotal = totals.reduce((s, v) => s + v, 0)

  if (loading) return <div className="text-slate-400 py-8 text-center text-sm">로딩 중…</div>

  return (
    <div>
      <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={onFileChange} />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 700 }}>
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 w-20 text-center">일자</th>
              <th className="border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-600 w-20 text-center">도시</th>
              <th className="border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-600 w-24 text-center">업체명</th>
              <th className="border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-600 text-center">주요활동</th>
              {COST_COLS.map(c => (
                <th key={c.label} className="border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-600 w-24 text-center">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allDates.map(date => {
              const row = rowFor(date)
              return (
                <tr key={date} className="hover:bg-slate-50/60">
                  {/* 일자 */}
                  <td className="border border-slate-200 px-3 py-2 text-center text-sm font-semibold text-slate-700 whitespace-nowrap bg-slate-50">
                    {fmtDate(date)}
                  </td>
                  {/* 도시 */}
                  <td className="border border-slate-200 p-1.5">
                    <TextCell value={row?.city ?? ''} onCommit={v => updateField(date, { city: v })}
                      placeholder="도시"
                      className="w-full text-xs px-2 py-1.5 rounded border border-transparent hover:border-slate-200 focus:border-indigo-300 focus:outline-none bg-transparent" />
                  </td>
                  {/* 업체명 */}
                  <td className="border border-slate-200 p-1.5">
                    <TextCell value={row?.company ?? ''} onCommit={v => updateField(date, { company: v })}
                      placeholder="업체명"
                      className="w-full text-xs px-2 py-1.5 rounded border border-transparent hover:border-slate-200 focus:border-indigo-300 focus:outline-none bg-transparent" />
                  </td>
                  {/* 주요활동 */}
                  <td className="border border-slate-200 p-1.5">
                    <AreaCell value={row?.activity ?? ''} onCommit={v => updateField(date, { activity: v })}
                      placeholder="주요활동"
                      className="w-full text-xs px-2 py-1.5 rounded border border-transparent hover:border-slate-200 focus:border-indigo-300 focus:outline-none bg-transparent resize-none" />
                  </td>
                  {/* 비용 셀 */}
                  {COST_COLS.map(c => {
                    const receiptKey = c.receipt
                    const isUploading = uploading?.date === date && uploading?.col === c.cost
                    const isDragOver  = dragOver?.date  === date && dragOver?.col  === c.cost
                    const receiptUrl  = row?.[receiptKey] ?? null
                    return (
                      <td key={c.cost}
                        className={`border border-slate-200 p-1.5 ${isDragOver ? 'bg-blue-50 border-blue-300' : ''}`}
                        onDragOver={e => { e.preventDefault(); setDragOver({ date, col: c.cost }) }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={async e => { e.preventDefault(); setDragOver(null); const f = e.dataTransfer.files[0]; if (f) uploadReceipt(date, c.cost, f) }}
                      >
                        {/* 금액 입력 */}
                        <div className="flex items-center gap-0.5">
                          <input type="number"
                            value={row?.[c.cost] ?? ''}
                            onChange={e => updateField(date, { [c.cost]: e.target.value ? Number(e.target.value) : null })}
                            className="w-full text-[11px] px-1 py-1 rounded border border-transparent hover:border-slate-200 focus:border-indigo-300 focus:outline-none bg-transparent text-right"
                            placeholder="0" />
                          {/* 영수증 추가 버튼 (항상 표시) */}
                          {isUploading ? (
                            <span className="text-[9px] text-blue-400 shrink-0">…</span>
                          ) : (
                            <button onClick={() => { pendingUpload.current = { date, col: c.cost }; fileInputRef.current?.click() }}
                              className="text-[11px] leading-none shrink-0 text-slate-300 hover:text-blue-500 transition"
                              title="영수증 추가">📎</button>
                          )}
                        </div>
                        {/* 첨부된 영수증 목록 (다중) */}
                        {receiptUrl && (
                          <div className="flex flex-wrap gap-x-1 mt-0.5">
                            {receiptUrl.split('|').map((url, i) => (
                              <div key={i} className="flex items-center">
                                <a href={url} target="_blank" rel="noopener noreferrer" title={`영수증 ${i+1} 보기`}
                                  className="text-[10px] text-blue-500 hover:underline">📄{i+1}</a>
                                <button onClick={() => {
                                  const urls = receiptUrl.split('|').filter((_, idx) => idx !== i)
                                  updateField(date, { [receiptKey]: urls.length > 0 ? urls.join('|') : null })
                                }} className="text-slate-300 hover:text-red-400 text-[9px] ml-0.5">✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {/* 합계 행 */}
            <tr className="bg-slate-100 font-bold">
              <td colSpan={4} className="border border-slate-300 px-2 py-1.5 text-xs text-right text-slate-700">합계</td>
              {COST_COLS.map((c, i) => (
                <td key={c.cost} className="border border-slate-300 px-1 py-1.5 text-right text-[11px] text-indigo-700">
                  {totals[i] > 0 ? fmtKrw(totals[i]) : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {grandTotal > 0 && (
        <div className="mt-3 flex justify-end">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-5 py-2 text-sm">
            <span className="text-slate-500">총 출장비용</span>
            <span className="ml-3 text-xl font-bold text-indigo-700">{fmtKrw(grandTotal)}</span>
            <span className="ml-1 text-slate-500">원</span>
          </div>
        </div>
      )}

      <p className="mt-2 text-[11px] text-slate-400 text-center">
        영수증을 비용 셀에 드래그하거나 📎를 클릭해 첨부하면 금액이 자동 인식됩니다. 자동 저장됩니다.
      </p>
    </div>
  )
}
