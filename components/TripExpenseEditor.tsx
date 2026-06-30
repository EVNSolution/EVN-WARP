'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

interface Expense {
  id: string
  date: string
  category: string
  detail: string
  currency: string
  amountForeign: number | null
  exchangeRate: number | null
  amountKrw: number
  receiptUrl: string | null
  receiptName: string | null
  memo: string
  sortOrder: number
}

type DraftExpense = Omit<Expense, 'id'> & { id?: string; _saving?: boolean }

const CATEGORIES = ['항공', '고속철', '버스', '택시', '주유비', '통행료', '호텔', '식비', '통신비', '비자', '행사비', '기타']
const CURRENCIES = ['KRW', 'CNY', 'USD', 'EUR', 'JPY', 'GBP', 'THB', 'VND']

function formatKrw(n: number) {
  return Math.round(n).toLocaleString('ko-KR')
}

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

export default function TripExpenseEditor({
  tripId,
  startDate,
  endDate,
}: {
  tripId: string
  startDate: string
  endDate: string
}) {
  const [rows, setRows] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [rateCache, setRateCache] = useState<Record<string, number>>({}) // "USD" -> 1350
  const [fetching, setFetching] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUploadId = useRef<string | null>(null)

  // ── load ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/trips/${tripId}/expenses`)
      .then(r => r.json())
      .then(data => { setRows(data); setLoading(false) })
  }, [tripId])

  // ── exchange rate fetch ──────────────────────────────────────────
  const fetchRate = useCallback(async (currency: string) => {
    if (currency === 'KRW' || rateCache[currency]) return rateCache[currency] ?? null
    setFetching(currency)
    try {
      const res = await fetch(`/api/exchange-rate?currency=${currency}&date=${startDate}`)
      const data = await res.json()
      if (data.rate) {
        setRateCache(prev => ({ ...prev, [currency]: data.rate }))
        return data.rate as number
      }
    } finally {
      setFetching(null)
    }
    return null
  }, [rateCache, startDate])

  // ── save (debounced per row) ─────────────────────────────────────
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const persistRow = useCallback((row: Expense) => {
    clearTimeout(saveTimers.current[row.id])
    saveTimers.current[row.id] = setTimeout(async () => {
      await fetch(`/api/trips/${tripId}/expenses/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      })
    }, 600)
  }, [tripId])

  // ── add row ─────────────────────────────────────────────────────
  const addRow = useCallback(async (date: string) => {
    const base: Omit<Expense, 'id'> = {
      date,
      category: '식비',
      detail: '',
      currency: 'KRW',
      amountForeign: null,
      exchangeRate: null,
      amountKrw: 0,
      receiptUrl: null,
      receiptName: null,
      memo: '',
      sortOrder: rows.filter(r => r.date === date).length,
    }
    const res = await fetch(`/api/trips/${tripId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(base),
    })
    const created: Expense = await res.json()
    setRows(prev => [...prev, created])
  }, [tripId, rows])

  // ── update field ────────────────────────────────────────────────
  const updateRow = useCallback(async (id: string, patch: Partial<Expense>) => {
    let updated!: Expense
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r
      updated = { ...r, ...patch }
      return updated
    }))
    // auto-fetch rate when currency changes
    if (patch.currency && patch.currency !== 'KRW') {
      const rate = await fetchRate(patch.currency)
      if (rate) {
        setRows(prev => prev.map(r => {
          if (r.id !== id) return r
          const merged = { ...r, ...patch, exchangeRate: rate }
          // recalc KRW
          if (merged.amountForeign != null) {
            merged.amountKrw = Math.round(merged.amountForeign * rate)
          }
          updated = merged
          return merged
        }))
      }
    }
    // recalc KRW when amount or rate changes
    if (patch.amountForeign !== undefined || patch.exchangeRate !== undefined) {
      setRows(prev => prev.map(r => {
        if (r.id !== id) return r
        const merged = { ...r, ...patch }
        if (merged.currency !== 'KRW' && merged.amountForeign != null && merged.exchangeRate != null) {
          merged.amountKrw = Math.round(merged.amountForeign * merged.exchangeRate)
        }
        updated = merged
        return merged
      }))
    }
    // schedule save
    if (updated) persistRow(updated)
  }, [fetchRate, persistRow])

  // ── delete row ──────────────────────────────────────────────────
  const deleteRow = useCallback(async (id: string) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return
    await fetch(`/api/trips/${tripId}/expenses/${id}`, { method: 'DELETE' })
    setRows(prev => prev.filter(r => r.id !== id))
  }, [tripId])

  // ── receipt upload ───────────────────────────────────────────────
  const uploadReceipt = useCallback(async (expId: string, file: File) => {
    setUploadingId(expId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/trips/${tripId}/expenses/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) {
        await updateRow(expId, { receiptUrl: data.url, receiptName: data.name })
      }
    } finally {
      setUploadingId(null)
    }
  }, [tripId, updateRow])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const id = pendingUploadId.current
    if (!id || !e.target.files?.[0]) return
    uploadReceipt(id, e.target.files[0])
    e.target.value = ''
  }, [uploadReceipt])

  // ── group by date ────────────────────────────────────────────────
  const allDates = dateRange(startDate, endDate)
  const byDate = allDates.map(date => ({
    date,
    items: rows.filter(r => r.date === date),
  }))

  const totalKrw = rows.reduce((s, r) => s + (r.amountKrw ?? 0), 0)

  if (loading) return <div className="text-slate-400 py-8 text-center text-sm">로딩 중...</div>

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-slate-500">총 경비</span>
          <span className="ml-2 text-lg font-bold text-blue-700">{formatKrw(totalKrw)} 원</span>
        </div>
        <a
          href={`/api/trips/${tripId}/export`}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          엑셀 내보내기
        </a>
      </div>

      {/* hidden file input */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange}
        accept="image/*,.pdf" />

      {/* day sections */}
      {byDate.map(({ date, items }) => (
        <div key={date} className="border border-slate-200 rounded-lg overflow-hidden">
          {/* day header */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-sm font-semibold text-slate-700">
              {date} ({['일', '월', '화', '수', '목', '금', '토'][new Date(date).getDay()]})
            </span>
            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <span className="text-xs text-slate-400">
                  {formatKrw(items.reduce((s, r) => s + (r.amountKrw ?? 0), 0))} 원
                </span>
              )}
              <button
                onClick={() => addRow(date)}
                className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100"
              >
                + 항목 추가
              </button>
            </div>
          </div>

          {/* rows */}
          {items.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 text-center">항목 없음</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-100">
                    <th className="px-3 py-1.5 text-left w-24">구분</th>
                    <th className="px-3 py-1.5 text-left w-28">세부정보</th>
                    <th className="px-3 py-1.5 text-left w-20">통화</th>
                    <th className="px-3 py-1.5 text-right w-28">외화 금액</th>
                    <th className="px-3 py-1.5 text-right w-24">환율</th>
                    <th className="px-3 py-1.5 text-right w-28">원화 금액</th>
                    <th className="px-3 py-1.5 text-left w-28">영수증</th>
                    <th className="px-3 py-1.5 text-left">비고</th>
                    <th className="px-2 py-1.5 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(row => (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-50 hover:bg-slate-50/50 ${dragOverId === row.id ? 'bg-blue-50' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDragOverId(row.id) }}
                      onDragLeave={() => setDragOverId(null)}
                      onDrop={async e => {
                        e.preventDefault()
                        setDragOverId(null)
                        const file = e.dataTransfer.files[0]
                        if (file) uploadReceipt(row.id, file)
                      }}
                    >
                      {/* category */}
                      <td className="px-3 py-1">
                        <select
                          value={row.category}
                          onChange={e => updateRow(row.id, { category: e.target.value })}
                          className="w-full text-xs border border-slate-200 rounded px-1 py-0.5 bg-white"
                        >
                          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      {/* detail */}
                      <td className="px-3 py-1">
                        <input
                          value={row.detail}
                          onChange={e => updateRow(row.id, { detail: e.target.value })}
                          placeholder="장소/내용"
                          className="w-full text-xs border border-slate-200 rounded px-1.5 py-0.5"
                        />
                      </td>
                      {/* currency */}
                      <td className="px-3 py-1">
                        <select
                          value={row.currency}
                          onChange={e => updateRow(row.id, { currency: e.target.value })}
                          className="w-full text-xs border border-slate-200 rounded px-1 py-0.5 bg-white"
                        >
                          {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      {/* foreign amount */}
                      <td className="px-3 py-1">
                        {row.currency === 'KRW' ? (
                          <span className="text-xs text-slate-300 block text-right">—</span>
                        ) : (
                          <input
                            type="number"
                            value={row.amountForeign ?? ''}
                            onChange={e => updateRow(row.id, { amountForeign: e.target.value ? Number(e.target.value) : null })}
                            placeholder="0"
                            className="w-full text-xs border border-slate-200 rounded px-1.5 py-0.5 text-right"
                          />
                        )}
                      </td>
                      {/* exchange rate */}
                      <td className="px-3 py-1">
                        {row.currency === 'KRW' ? (
                          <span className="text-xs text-slate-300 block text-right">—</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={row.exchangeRate ?? ''}
                              onChange={e => updateRow(row.id, { exchangeRate: e.target.value ? Number(e.target.value) : null })}
                              placeholder={fetching === row.currency ? '조회중' : '환율'}
                              className="w-full text-xs border border-slate-200 rounded px-1.5 py-0.5 text-right"
                            />
                            {rateCache[row.currency] == null && (
                              <button
                                onClick={() => fetchRate(row.currency).then(rate => {
                                  if (rate) updateRow(row.id, { exchangeRate: rate })
                                })}
                                title="기준환율 자동조회"
                                className="text-blue-500 hover:text-blue-700 shrink-0"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      {/* krw */}
                      <td className="px-3 py-1">
                        {row.currency === 'KRW' ? (
                          <input
                            type="number"
                            value={row.amountKrw || ''}
                            onChange={e => updateRow(row.id, { amountKrw: Number(e.target.value) || 0 })}
                            placeholder="0"
                            className="w-full text-xs border border-slate-200 rounded px-1.5 py-0.5 text-right"
                          />
                        ) : (
                          <span className="text-xs text-right block font-medium">
                            {row.amountKrw ? formatKrw(row.amountKrw) : '—'}
                          </span>
                        )}
                      </td>
                      {/* receipt */}
                      <td className="px-3 py-1">
                        {row.receiptUrl ? (
                          <div className="flex items-center gap-1">
                            <a
                              href={row.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline truncate max-w-[80px]"
                              title={row.receiptName ?? ''}
                            >
                              {row.receiptName ?? '영수증'}
                            </a>
                            <button
                              onClick={() => updateRow(row.id, { receiptUrl: null, receiptName: null })}
                              className="text-slate-300 hover:text-red-400 shrink-0"
                              title="삭제"
                            >✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              pendingUploadId.current = row.id
                              fileInputRef.current?.click()
                            }}
                            disabled={uploadingId === row.id}
                            className="text-xs text-slate-400 hover:text-blue-600 border border-dashed border-slate-200 rounded px-2 py-0.5 w-full text-center hover:border-blue-300 transition"
                          >
                            {uploadingId === row.id ? '업로드 중…' : '📎 첨부'}
                          </button>
                        )}
                      </td>
                      {/* memo */}
                      <td className="px-3 py-1">
                        <input
                          value={row.memo}
                          onChange={e => updateRow(row.id, { memo: e.target.value })}
                          placeholder="비고"
                          className="w-full text-xs border border-slate-200 rounded px-1.5 py-0.5"
                        />
                      </td>
                      {/* delete */}
                      <td className="px-2 py-1 text-center">
                        <button
                          onClick={() => deleteRow(row.id)}
                          className="text-slate-300 hover:text-red-500 transition"
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* grand total */}
      <div className="flex justify-end">
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-6 py-3 text-sm">
          <span className="text-slate-500">합계</span>
          <span className="ml-3 text-xl font-bold text-blue-700">{formatKrw(totalKrw)}</span>
          <span className="ml-1 text-slate-500">원</span>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center">
        영수증 파일은 행에 직접 드래그하거나 📎 버튼을 클릭하여 첨부할 수 있습니다.
        자동 저장됩니다.
      </p>
    </div>
  )
}
