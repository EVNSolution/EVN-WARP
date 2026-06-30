import React from 'react'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'

// ── 인쇄 전용 버튼 (Client) ──────────────────────────────────────────
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
function num(v: number | null | undefined) {
  if (!v) return ''
  return v.toLocaleString('ko-KR')
}

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
  const approvers: any[] = (() => {
    try { return JSON.parse((trip as any).approversJson ?? '[]') } catch { return [] }
  })()

  const totalTransport     = days.reduce((s, d) => s + (d.transportCost ?? 0), 0)
  const totalAccommodation = days.reduce((s, d) => s + (d.accommodationCost ?? 0), 0)
  const totalMeal          = days.reduce((s, d) => s + (d.mealCost ?? 0), 0)
  const totalOther         = days.reduce((s, d) => s + (d.otherCost ?? 0), 0)
  const grandTotal         = totalTransport + totalAccommodation + totalMeal + totalOther

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <>
      <style>{`
        @page { size: A4; margin: 18mm 15mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: 'Noto Sans KR', sans-serif; font-size: 10pt; color: #1e293b; background: white; }
        .page { max-width: 190mm; margin: 0 auto; padding: 10mm 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #cbd5e1; padding: 4px 6px; }
        th { background: #f1f5f9; font-weight: 600; text-align: center; font-size: 9pt; }
        .sec-title { background: #1e3a5f; color: white; font-size: 9.5pt; font-weight: 700;
          padding: 4px 8px; margin: 10px 0 0; }
        .info-label { width: 22mm; background: #f8fafc; font-weight: 600; font-size: 9pt;
          color: #475569; white-space: nowrap; text-align: center; }
        .info-val { font-size: 9.5pt; padding: 4px 8px; }
        .approval-box { border: 1px solid #cbd5e1; text-align: center; }
        .approval-box .role { background: #f1f5f9; font-size: 8pt; font-weight: 600; padding: 3px; border-bottom: 1px solid #cbd5e1; }
        .approval-box .name { font-size: 9pt; padding: 16px 8px; min-height: 32px; }
      `}</style>

      {/* 인쇄 버튼 (화면에서만 표시) */}
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
            <div>작성일: {today}</div>
            <div style={{ marginTop: 2 }}>
              <span style={{ background: trip.type === '해외출장' ? '#dbeafe' : '#ffedd5', color: trip.type === '해외출장' ? '#1d4ed8' : '#c2410c', padding: '1px 6px', borderRadius: 4, fontSize: '8pt', fontWeight: 600 }}>
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
              <td className="info-val">{trip.userName}{trip.teamName ? ` (${trip.teamName})` : ''}</td>
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
              <th style={{ width: '10%' }}>일자</th>
              <th style={{ width: '9%' }}>도시</th>
              <th style={{ width: '12%' }}>업체명</th>
              <th>주요 활동</th>
              <th style={{ width: '9%' }}>교통비</th>
              <th style={{ width: '9%' }}>숙박비</th>
              <th style={{ width: '9%' }}>식비</th>
              <th style={{ width: '9%' }}>기타</th>
              <th style={{ width: '10%' }}>소계</th>
            </tr>
          </thead>
          <tbody>
            {days.map(d => {
              const rowTotal = (d.transportCost ?? 0) + (d.accommodationCost ?? 0) + (d.mealCost ?? 0) + (d.otherCost ?? 0)
              return (
                <tr key={d.id}>
                  <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{fmtMd(d.date)}</td>
                  <td style={{ textAlign: 'center', fontSize: '9pt' }}>{d.city ?? ''}</td>
                  <td style={{ fontSize: '9pt' }}>{d.company ?? ''}</td>
                  <td style={{ fontSize: '9pt', whiteSpace: 'pre-wrap' }}>{d.activity ?? ''}</td>
                  <td style={{ textAlign: 'right', fontSize: '8.5pt' }}>{num(d.transportCost)}</td>
                  <td style={{ textAlign: 'right', fontSize: '8.5pt' }}>{num(d.accommodationCost)}</td>
                  <td style={{ textAlign: 'right', fontSize: '8.5pt' }}>{num(d.mealCost)}</td>
                  <td style={{ textAlign: 'right', fontSize: '8.5pt' }}>{num(d.otherCost)}</td>
                  <td style={{ textAlign: 'right', fontSize: '8.5pt', fontWeight: rowTotal ? 600 : 'normal' }}>{rowTotal ? num(rowTotal) : ''}</td>
                </tr>
              )
            })}
            {days.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#94a3b8', padding: '12px' }}>일정 내역 없음</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
              <td colSpan={4} style={{ textAlign: 'right', fontSize: '9pt' }}>합 계</td>
              <td style={{ textAlign: 'right' }}>{num(totalTransport) || '—'}</td>
              <td style={{ textAlign: 'right' }}>{num(totalAccommodation) || '—'}</td>
              <td style={{ textAlign: 'right' }}>{num(totalMeal) || '—'}</td>
              <td style={{ textAlign: 'right' }}>{num(totalOther) || '—'}</td>
              <td style={{ textAlign: 'right', color: '#1e3a5f' }}>{krw(grandTotal)}</td>
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
                  const entries: [string, string | null][] = [
                    ['교통비', d.transportReceipt],
                    ['숙박비', d.accommodationReceipt],
                    ['식비', d.mealReceipt],
                    ['기타', d.otherReceipt],
                  ]
                  for (const [cat, urls] of entries) {
                    if (!urls) continue
                    urls.split('|').forEach((url, i) => {
                      const name = decodeURIComponent(url.split('/').pop() ?? url)
                      rows.push(
                        <tr key={`${d.id}-${cat}-${i}`}>
                          <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{fmtMd(d.date)}</td>
                          <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{cat}</td>
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
                    <div className="name">{trip.userName}</div>
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
                    <div className="name">{trip.userName}</div>
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
