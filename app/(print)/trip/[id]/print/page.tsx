import React from 'react'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'

import PrintButton from './PrintButton'

function fmt(d: string) {
  const dt = new Date(d)
  return `${dt.getUTCFullYear()}.${String(dt.getUTCMonth() + 1).padStart(2, '0')}.${String(dt.getUTCDate()).padStart(2, '0')}`
}
function fmtMd(d: string) {
  const dt = new Date(d)
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`
}
function krw(v: number | null | undefined) {
  if (!v) return '—'
  return v.toLocaleString('ko-KR') + '원'
}
function num(v: number | null | undefined, suffix = '') {
  if (!v) return ''
  return v.toLocaleString('ko-KR') + suffix
}

// 출장개시일 기준 환율 조회 (서버에서 직접 호출)
async function fetchRate(currency: string, date: string): Promise<number | null> {
  if (!currency || currency === 'KRW') return null
  try {
    const cur = currency.toLowerCase()
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${cur}.json`,
      { next: { revalidate: 86400 } }
    )
    if (res.ok) {
      const data = await res.json()
      const rate = data[cur]?.['krw']
      if (rate) return Math.round(rate * 100) / 100
    }
    // fallback
    const res2 = await fetch(
      `https://latest.currency-api.pages.dev/v1/currencies/${cur}.json`,
      { next: { revalidate: 86400 } }
    )
    const data2 = await res2.json()
    return data2[cur]?.['krw'] ?? null
  } catch {
    return null
  }
}

type CostKey = 'transportCost' | 'accommodationCost' | 'mealCost' | 'otherCost'
const COST_COLS: { key: CostKey; label: string; receipt: 'transportReceipt' | 'accommodationReceipt' | 'mealReceipt' | 'otherReceipt' }[] = [
  { key: 'transportCost',     label: '교통비',  receipt: 'transportReceipt'     },
  { key: 'accommodationCost', label: '숙박비',  receipt: 'accommodationReceipt' },
  { key: 'mealCost',          label: '식비',    receipt: 'mealReceipt'           },
  { key: 'otherCost',         label: '기타',    receipt: 'otherReceipt'          },
]

export default async function TripPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const trip = await prisma.tripReport.findUnique({
    where: { id },
    include: { dayRecords: { orderBy: { date: 'asc' } } },
  })
  if (!trip) notFound()

  const days = trip.dayRecords
  const isOverseas = trip.type === '해외출장'
  const approvers: any[] = (() => {
    try { return JSON.parse((trip as any).approversJson ?? '[]') } catch { return [] }
  })()

  // ── 통화 맵 파싱 ──────────────────────────────────────────────────────
  // costCurrencies: JSON {"transportCost":"CNY","mealCost":"KRW", ...} per day
  type CurrencyMap = Partial<Record<CostKey, string>>
  const dateCurrencyMap: Record<string, CurrencyMap> = {}
  for (const d of days) {
    try {
      dateCurrencyMap[d.date] = JSON.parse((d as any).costCurrencies ?? '{}')
    } catch {
      dateCurrencyMap[d.date] = {}
    }
  }

  function getCellCurrency(date: string, col: CostKey, defaultCur: string): string {
    return dateCurrencyMap[date]?.[col] ?? defaultCur
  }

  // ── 해외출장: 주요 외화 감지 & 환율 조회 ──────────────────────────────
  // 가장 많이 사용된 외화를 주요 통화로 선정
  let fxCurrency = ''
  let fxRate: number | null = null

  if (isOverseas) {
    const currencyCount: Record<string, number> = {}
    for (const d of days) {
      const map = dateCurrencyMap[d.date]
      for (const col of COST_COLS) {
        const val = d[col.key] ?? 0
        if (!val) continue
        const cur = map?.[col.key] ?? ''
        if (cur && cur !== 'KRW') currencyCount[cur] = (currencyCount[cur] ?? 0) + 1
      }
    }
    fxCurrency = Object.entries(currencyCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'CNY'
    fxRate = await fetchRate(fxCurrency, trip.startDate)
  }

  // ── 합계 계산 ─────────────────────────────────────────────────────────
  let totalFxRaw = 0   // 외화 합계 (raw)
  let totalKrw   = 0   // KRW 환산 합계

  const colTotals: Record<CostKey, { fx: number; krw: number }> = {
    transportCost:     { fx: 0, krw: 0 },
    accommodationCost: { fx: 0, krw: 0 },
    mealCost:          { fx: 0, krw: 0 },
    otherCost:         { fx: 0, krw: 0 },
  }

  for (const d of days) {
    for (const col of COST_COLS) {
      const val = d[col.key] ?? 0
      if (!val) continue
      const cur = getCellCurrency(d.date, col.key, fxCurrency || 'KRW')
      if (cur === 'KRW') {
        colTotals[col.key].krw += val
        totalKrw += val
      } else {
        colTotals[col.key].fx += val
        totalFxRaw += val
        totalKrw += fxRate ? Math.round(val * fxRate) : val
      }
    }
  }

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const travelersArr: { userId: string; userName: string }[] = (() => {
    try {
      const arr = JSON.parse((trip as any).travelersJson ?? '[]')
      if (arr.length > 0) return arr
    } catch {}
    return trip.userName ? [{ userId: trip.userId ?? '', userName: trip.userName }] : []
  })()
  const authorName = travelersArr.map(t => t.userName).join(', ') || (session?.user as any)?.name || ''

  return (
    <>
      <style>{`
        @page { size: A4; margin: 15mm 10mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: 'Noto Sans KR', sans-serif; font-size: 10pt; color: #1e293b; background: white; }
        .page { max-width: 210mm; margin: 0 auto; padding: 10mm 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #cbd5e1; padding: 4px 6px; }
        th { background: #f1f5f9; font-weight: 600; text-align: center; font-size: 9pt; }
        .sec-title { background: #1e3a5f; color: white; font-size: 9.5pt; font-weight: 700;
          padding: 4px 8px; margin: 10px 0 0; }
        .info-label { width: 22mm; background: #f8fafc; font-weight: 600; font-size: 9pt;
          color: #475569; white-space: nowrap; text-align: center; }
        .info-val { font-size: 9.5pt; padding: 4px 8px; }
        .approval-box { border: 1px solid #cbd5e1; text-align: center; padding: 0; vertical-align: top; }
        .approval-box .role { background: #f1f5f9; font-size: 8pt; font-weight: 600; padding: 3px; border-bottom: 1px solid #cbd5e1; }
        .approval-box .name { font-size: 9pt; padding: 16px 8px; min-height: 32px; }
        .cur-badge { font-size: 7pt; color: #2563eb; margin-left: 2px; font-weight: 600; }
      `}</style>

      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <PrintButton />
        <a href={`/trip/${id}`}
          className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 bg-white shadow">
          ← 돌아가기
        </a>
      </div>

      <div className="page">
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8, borderBottom: '2px solid #1e3a5f', paddingBottom: 6 }}>
          <div>
            <div style={{ fontSize: '8pt', color: '#64748b', marginBottom: 2 }}>EV& 솔루션</div>
            <div style={{ fontSize: '18pt', fontWeight: 800, color: '#1e3a5f', letterSpacing: '-0.5px' }}>출장 보고서</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '8.5pt', color: '#64748b' }}>
            <div>작성자: {authorName}</div>
            <div style={{ marginTop: 2 }}>작성일: {today}</div>
            <div style={{ marginTop: 2 }}>
              <span style={{ background: isOverseas ? '#dbeafe' : '#ffedd5', color: isOverseas ? '#1d4ed8' : '#c2410c', padding: '1px 6px', borderRadius: 4, fontSize: '8pt', fontWeight: 600 }}>
                {trip.type}
              </span>
              <span style={{ marginLeft: 6, fontWeight: 600, color: '#334155' }}>{trip.status}</span>
            </div>
          </div>
        </div>

        {/* ① 기본 정보 */}
        <div className="sec-title">① 기본 정보</div>
        <table>
          <tbody>
            <tr>
              <td className="info-label">출장자</td>
              <td className="info-val">{authorName}{trip.teamName ? ` (${trip.teamName})` : ''}</td>
              <td className="info-label">출장지</td>
              <td className="info-val">{trip.destination}</td>
            </tr>
            <tr>
              <td className="info-label">출장 기간</td>
              <td className="info-val">{fmt(trip.startDate)} ~ {fmt(trip.endDate)}</td>
              <td className="info-label">교통편</td>
              <td className="info-val">{trip.transport ?? '—'}</td>
            </tr>
            <tr>
              <td className="info-label">숙박</td>
              <td className="info-val" colSpan={3}>{trip.accommodation ?? '—'}</td>
            </tr>
            {isOverseas && fxCurrency && (
              <tr>
                <td className="info-label">적용 환율</td>
                <td className="info-val" colSpan={3}>
                  {fxRate
                    ? `1 ${fxCurrency} = ${fxRate.toLocaleString('ko-KR')} KRW (${trip.startDate} 기준)`
                    : `${fxCurrency} — 환율 조회 실패, 직접 확인 필요`}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ② 방문 정보 */}
        <div className="sec-title">② 방문 정보</div>
        <table>
          <tbody>
            <tr>
              <td className="info-label">출장 목적</td>
              <td className="info-val" colSpan={3} style={{ whiteSpace: 'pre-wrap' }}>{trip.purpose}</td>
            </tr>
            {trip.visitTarget && (
              <tr>
                <td className="info-label">방문처</td>
                <td className="info-val" colSpan={3}>{trip.visitTarget}</td>
              </tr>
            )}
            {trip.companions && (
              <tr>
                <td className="info-label">동행자</td>
                <td className="info-val" colSpan={3}>{trip.companions}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ③ 일자별 일정 및 비용 명세 */}
        <div className="sec-title">③ 일자별 일정 및 비용 명세</div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '8%' }}>일자</th>
              <th style={{ width: '7%' }}>도시</th>
              <th style={{ width: '11%' }}>업체명</th>
              <th>주요 활동</th>
              <th style={{ width: '9%' }}>교통비</th>
              <th style={{ width: '9%' }}>숙박비</th>
              <th style={{ width: '8%' }}>식비</th>
              <th style={{ width: '8%' }}>기타</th>
              <th style={{ width: '13%' }}>소계(KRW)</th>
            </tr>
          </thead>
          <tbody>
            {days.map(d => {
              const rowKrw = COST_COLS.reduce((s, col) => {
                const val = d[col.key] ?? 0
                if (!val) return s
                const cur = getCellCurrency(d.date, col.key, fxCurrency || 'KRW')
                return s + (cur === 'KRW' ? val : fxRate ? Math.round(val * fxRate) : val)
              }, 0)
              return (
                <tr key={d.id}>
                  <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{fmtMd(d.date)}</td>
                  <td style={{ textAlign: 'center', fontSize: '9pt' }}>{d.city ?? ''}</td>
                  <td style={{ fontSize: '9pt' }}>{d.company ?? ''}</td>
                  <td style={{ fontSize: '9pt', whiteSpace: 'pre-wrap' }}>{d.activity ?? ''}</td>
                  {COST_COLS.map(col => {
                    const val = d[col.key] ?? 0
                    const cur = val ? getCellCurrency(d.date, col.key, fxCurrency || 'KRW') : 'KRW'
                    return (
                      <td key={col.key} style={{ textAlign: 'right', fontSize: '8.5pt' }}>
                        {val ? (
                          <>
                            {num(val)}
                            <span className="cur-badge">{cur}</span>
                          </>
                        ) : ''}
                      </td>
                    )
                  })}
                  <td style={{ textAlign: 'right', fontSize: '8.5pt', fontWeight: rowKrw ? 600 : 'normal' }}>
                    {rowKrw ? num(rowKrw) : ''}
                  </td>
                </tr>
              )
            })}
            {days.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: '12px' }}>일정 내역 없음</td></tr>
            )}
          </tbody>
          <tfoot>
            {/* 외화 소계 행 (해외출장이고 외화가 있을 때) */}
            {isOverseas && fxCurrency && totalFxRaw > 0 && (
              <tr style={{ background: '#eff6ff', fontSize: '8pt', color: '#1d4ed8' }}>
                <td colSpan={4} style={{ textAlign: 'right', fontSize: '8.5pt' }}>
                  외화 소계
                </td>
                {COST_COLS.map(col => (
                  <td key={col.key} style={{ textAlign: 'right' }}>
                    {colTotals[col.key].fx ? `${num(colTotals[col.key].fx)} ${fxCurrency}` : ''}
                  </td>
                ))}
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  {num(totalFxRaw)} {fxCurrency}
                </td>
              </tr>
            )}
            <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
              <td colSpan={4} style={{ textAlign: 'right', fontSize: '9pt' }}>합 계 (KRW)</td>
              {COST_COLS.map(col => {
                const krwVal = colTotals[col.key].krw + (fxRate ? Math.round(colTotals[col.key].fx * fxRate) : colTotals[col.key].fx)
                return (
                  <td key={col.key} style={{ textAlign: 'right' }}>{krwVal ? num(krwVal) : '—'}</td>
                )
              })}
              <td style={{ textAlign: 'right', color: '#1e3a5f' }}>{krw(totalKrw)}</td>
            </tr>
          </tfoot>
        </table>

        {/* 영수증 목록 */}
        {days.some(d => d.transportReceipt || d.accommodationReceipt || d.mealReceipt || d.otherReceipt) && (
          <>
            <div className="sec-title">영수증 첨부 목록</div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '10%' }}>일자</th>
                  <th style={{ width: '15%' }}>구분</th>
                  <th>파일명</th>
                </tr>
              </thead>
              <tbody>
                {days.flatMap(d => {
                  const rows: React.ReactElement[] = []
                  for (const col of COST_COLS) {
                    const urls = d[col.receipt]
                    if (!urls) continue
                    urls.split('|').forEach((url, i) => {
                      const name = decodeURIComponent(url.split('/').pop() ?? url)
                      rows.push(
                        <tr key={`${d.id}-${col.key}-${i}`}>
                          <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{fmtMd(d.date)}</td>
                          <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{col.label}</td>
                          <td style={{ fontSize: '8.5pt' }}>{name}</td>
                        </tr>
                      )
                    })
                  }
                  return rows
                })}
              </tbody>
            </table>
          </>
        )}

        {/* ④ 결재란 */}
        <div className="sec-title">④ 결재란</div>
        <table>
          <tbody>
            <tr>
              {approvers.length > 0 ? (
                <>
                  <td className="approval-box" style={{ width: `${100 / (approvers.length + 1)}%` }}>
                    <div className="role">작성자</div>
                    <div className="name">{authorName}</div>
                  </td>
                  {approvers.map((a: any, i: number) => (
                    <td key={i} className="approval-box" style={{ width: `${100 / (approvers.length + 1)}%` }}>
                      <div className="role">{i === approvers.length - 1 ? '최종승인' : `검토 ${i + 1}`}</div>
                      <div className="name">
                        {a.userName}
                        {a.status === '승인' && <div style={{ fontSize: '7.5pt', color: '#16a34a', marginTop: 2 }}>✓ 승인완료</div>}
                        {a.status === '반려' && <div style={{ fontSize: '7.5pt', color: '#dc2626', marginTop: 2 }}>✕ 반려</div>}
                      </div>
                    </td>
                  ))}
                </>
              ) : (
                <>
                  <td className="approval-box" style={{ width: '25%' }}>
                    <div className="role">작성자</div>
                    <div className="name">{authorName}</div>
                  </td>
                  <td className="approval-box" style={{ width: '25%' }}>
                    <div className="role">검토</div>
                    <div className="name" />
                  </td>
                  <td className="approval-box" style={{ width: '25%' }}>
                    <div className="role">승인</div>
                    <div className="name">
                      {trip.approverName ?? ''}
                      {trip.status === '승인' && <div style={{ fontSize: '7.5pt', color: '#16a34a', marginTop: 2 }}>✓ 승인완료</div>}
                    </div>
                  </td>
                </>
              )}
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 14, fontSize: '8pt', color: '#94a3b8', textAlign: 'center' }}>
          EV& 솔루션 · 출장보고서 · {trip.title}
        </div>
      </div>
    </>
  )
}
