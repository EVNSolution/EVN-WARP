import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import PrintTrigger from './PrintTrigger'

function fmt(date?: string | Date | null) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function fmtMoney(n?: number | null) {
  if (n == null || n === 0) return '—'
  return n.toLocaleString('ko-KR') + '원'
}

export default async function TripPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const trip = await prisma.tripReport.findUnique({
    where: { id },
    include: {
      dayRecords: { orderBy: { date: 'asc' } },
      expenses:   { orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }] },
    },
  })
  if (!trip) notFound()

  const travelers = (() => {
    try {
      const arr = JSON.parse((trip as any).travelersJson ?? '[]')
      if (arr.length > 0) return arr.map((t: any) => t.userName).join(', ')
    } catch {}
    return trip.userName
  })()

  const approvers: any[] = (() => {
    try { return JSON.parse((trip as any).approversJson ?? '[]') } catch { return [] }
  })()

  const budgetTotal = (trip.budgetTransport ?? 0) + (trip.budgetAccomm ?? 0) +
    (trip.budgetMeal ?? 0) + (trip.budgetOther ?? 0)
  const actualTotal = (trip.actualTransport ?? 0) + (trip.actualAccomm ?? 0) +
    (trip.actualMeal ?? 0) + (trip.actualOther ?? 0)

  const expenseTotal = trip.expenses.reduce((s, e) => s + (e.amountKrw ?? 0), 0)

  const statusLabel: Record<string, string> = {
    '초안': '초안', '승인요청': '결재 진행 중', '승인': '최종 승인', '반려': '반려',
  }

  return (
    <>
      <PrintTrigger />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; font-size: 11px; color: #111; background: white; }
        @page { size: A4; margin: 15mm 12mm; }
        @media print {
          .no-print { display: none !important; }
        }

        .doc { max-width: 740px; margin: 0 auto; padding: 24px 0; }

        /* 타이틀 */
        .doc-title { text-align: center; font-size: 20px; font-weight: 900; letter-spacing: 6px; margin-bottom: 6px; }
        .doc-sub   { text-align: center; font-size: 11px; color: #666; margin-bottom: 20px; }

        /* 결재란 */
        .approval-box { display: flex; justify-content: flex-end; margin-bottom: 16px; }
        .approval-table { border-collapse: collapse; min-width: 320px; }
        .approval-table th,
        .approval-table td { border: 1px solid #333; padding: 4px 8px; text-align: center; font-size: 10px; }
        .approval-table th { background: #f5f5f5; font-weight: 700; width: 80px; }
        .approval-table .name-cell { min-width: 80px; height: 44px; vertical-align: top; padding-top: 5px; }
        .approval-table .date-cell { font-size: 9px; color: #555; white-space: nowrap; }
        .approval-table .status-cell { font-size: 9px; font-weight: 700; }
        .status-승인 { color: #15803d; }
        .status-동의 { color: #1d4ed8; }
        .status-반려 { color: #b91c1c; }
        .status-대기 { color: #6b7280; }

        /* 섹션 */
        .section { margin-bottom: 14px; }
        .section-title { font-size: 11px; font-weight: 800; background: #111; color: white; padding: 4px 10px; margin-bottom: 0; letter-spacing: 1px; }
        .info-table { width: 100%; border-collapse: collapse; }
        .info-table td { border: 1px solid #ccc; padding: 5px 9px; vertical-align: top; }
        .info-table .label { background: #f9f9f9; font-weight: 700; width: 90px; white-space: nowrap; color: #444; }
        .info-table .value { white-space: pre-wrap; word-break: break-all; }

        /* 일정 테이블 */
        .day-table { width: 100%; border-collapse: collapse; }
        .day-table th { background: #f0f0f0; font-weight: 700; border: 1px solid #ccc; padding: 4px 6px; text-align: center; }
        .day-table td { border: 1px solid #ccc; padding: 4px 6px; vertical-align: top; }
        .day-table .num { text-align: right; }

        /* 비용 테이블 */
        .expense-table { width: 100%; border-collapse: collapse; }
        .expense-table th { background: #f0f0f0; font-weight: 700; border: 1px solid #ccc; padding: 4px 6px; text-align: center; }
        .expense-table td { border: 1px solid #ccc; padding: 4px 6px; }
        .expense-table .num { text-align: right; }
        .expense-table tfoot td { background: #f5f5f5; font-weight: 700; }

        /* 예산 요약 */
        .budget-row { display: flex; gap: 0; margin-bottom: 0; }
        .budget-cell { flex: 1; border: 1px solid #ccc; padding: 5px 8px; }
        .budget-cell + .budget-cell { border-left: 0; }
        .budget-cell .bl { font-size: 9px; color: #888; margin-bottom: 2px; }
        .budget-cell .bv { font-size: 12px; font-weight: 700; }

        /* 서명란 */
        .sign-section { margin-top: 16px; }
        .sign-table { width: 100%; border-collapse: collapse; }
        .sign-table th { background: #f5f5f5; border: 1px solid #333; padding: 5px 8px; font-weight: 700; text-align: center; }
        .sign-table td { border: 1px solid #333; padding: 6px 10px; min-height: 50px; vertical-align: top; }
        .sign-name { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
        .sign-type { display: inline-block; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; margin-bottom: 3px; }
        .sign-type-동의 { background: #dbeafe; color: #1d4ed8; }
        .sign-type-결재 { background: #dcfce7; color: #15803d; }
        .sign-date { font-size: 9px; color: #555; margin-top: 4px; }
        .sign-comment { font-size: 9px; color: #444; margin-top: 3px; border-top: 1px dashed #ccc; padding-top: 3px; }
        .sign-status { font-size: 10px; font-weight: 700; margin-top: 2px; }

        hr.divider { border: none; border-top: 1px solid #ddd; margin: 12px 0; }
      `}</style>

      <div className="doc">

        {/* 문서 제목 */}
        <div className="doc-title">{trip.type === '해외출장' ? '해 외 출 장 보 고 서' : '출 장 보 고 서'}</div>
        <div className="doc-sub">
          {trip.title} &nbsp;·&nbsp; 상태: <strong>{statusLabel[trip.status] ?? trip.status}</strong>
          {trip.submittedAt && ` &nbsp;·&nbsp; 제출일: ${fmt(trip.submittedAt)}`}
        </div>

        {/* 결재란 (우상단) — 결재자가 있을 때만 */}
        {approvers.length > 0 && (
          <div className="approval-box">
            <table className="approval-table">
              <thead>
                <tr>
                  <th></th>
                  {approvers.map((a, i) => (
                    <th key={i}>{a.type === '동의' ? '동의' : '결재'}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ background: '#f5f5f5', fontWeight: 700 }}>담당자</td>
                  {approvers.map((a, i) => (
                    <td key={i} className="name-cell">
                      <div style={{ fontWeight: 700, fontSize: 11 }}>{a.userName}</div>
                      {a.status && a.status !== '대기' && (
                        <div className={`status-cell status-${a.status === '승인' ? (a.type === '동의' ? '동의' : '승인') : a.status}`}>
                          {a.status === '승인' ? (a.type === '동의' ? '동의함' : '승인') : a.status}
                        </div>
                      )}
                      {!a.status && <div className="status-cell status-대기">미처리</div>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ background: '#f5f5f5', fontWeight: 700 }}>처리일</td>
                  {approvers.map((a, i) => (
                    <td key={i} className="date-cell">
                      {a.approvedAt ? fmt(a.approvedAt) : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ background: '#f5f5f5', fontWeight: 700 }}>의견</td>
                  {approvers.map((a, i) => (
                    <td key={i} style={{ fontSize: 9, color: '#444', minWidth: 80 }}>
                      {a.comment || '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ① 기본 정보 */}
        <div className="section">
          <div className="section-title">① 기본 정보</div>
          <table className="info-table">
            <tbody>
              <tr><td className="label">출장 구분</td><td className="value">{trip.type}</td>
                  <td className="label">출장자</td><td className="value">{travelers}</td></tr>
              <tr><td className="label">팀</td><td className="value">{trip.teamName ?? '—'}</td>
                  <td className="label">출장지</td><td className="value">{trip.destination}</td></tr>
              <tr><td className="label">출장 기간</td><td className="value" colSpan={3}>{trip.startDate} ~ {trip.endDate}</td></tr>
              {trip.transport && <tr><td className="label">교통편</td><td className="value" colSpan={3}>{trip.transport}</td></tr>}
              {trip.accommodation && <tr><td className="label">숙박</td><td className="value" colSpan={3}>{trip.accommodation}</td></tr>}
            </tbody>
          </table>
        </div>

        {/* ② 방문 정보 */}
        <div className="section">
          <div className="section-title">② 방문 정보</div>
          <table className="info-table">
            <tbody>
              <tr><td className="label">출장 목적</td><td className="value" colSpan={3}>{trip.purpose}</td></tr>
              {trip.visitTarget && <tr><td className="label">방문처</td><td className="value" colSpan={3}>{trip.visitTarget}</td></tr>}
              {trip.companions && <tr><td className="label">동행자</td><td className="value" colSpan={3}>{trip.companions}</td></tr>}
            </tbody>
          </table>
        </div>

        {/* ③ 일자별 일정 */}
        {trip.dayRecords.length > 0 && (
          <div className="section">
            <div className="section-title">③ 일자별 일정 및 비용</div>
            <table className="day-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>날짜</th>
                  <th style={{ width: 70 }}>도시</th>
                  <th>주요 활동</th>
                  <th style={{ width: 60 }}>교통</th>
                  <th style={{ width: 60 }}>숙박</th>
                  <th style={{ width: 60 }}>식비</th>
                  <th style={{ width: 60 }}>기타</th>
                </tr>
              </thead>
              <tbody>
                {trip.dayRecords.map(d => (
                  <tr key={d.id}>
                    <td>{d.date}</td>
                    <td>{d.city ?? '—'}</td>
                    <td>{d.activity ?? '—'}</td>
                    <td className="num">{d.transportCost ? d.transportCost.toLocaleString() : '—'}</td>
                    <td className="num">{d.accommodationCost ? d.accommodationCost.toLocaleString() : '—'}</td>
                    <td className="num">{d.mealCost ? d.mealCost.toLocaleString() : '—'}</td>
                    <td className="num">{d.otherCost ? d.otherCost.toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ④ 예산 vs 실비 */}
        {budgetTotal > 0 && (
          <div className="section">
            <div className="section-title">④ 예산 및 실비 (단위: 만원)</div>
            <div className="budget-row">
              {[
                { label: '교통비 예산', bv: trip.budgetTransport, av: trip.actualTransport },
                { label: '숙박비 예산', bv: trip.budgetAccomm,    av: trip.actualAccomm },
                { label: '식  비 예산', bv: trip.budgetMeal,      av: trip.actualMeal },
                { label: '기  타 예산', bv: trip.budgetOther,     av: trip.actualOther },
              ].map(({ label, bv, av }) => (
                <div key={label} className="budget-cell">
                  <div className="bl">{label}</div>
                  <div className="bv">{bv != null ? bv + '만' : '—'}</div>
                  <div className="bl" style={{ marginTop: 2 }}>실비</div>
                  <div style={{ fontWeight: 700, fontSize: 11 }}>{av != null ? av + '만' : '—'}</div>
                </div>
              ))}
              <div className="budget-cell">
                <div className="bl">예산 합계</div>
                <div className="bv">{budgetTotal}만</div>
                <div className="bl" style={{ marginTop: 2 }}>실비 합계</div>
                <div style={{ fontWeight: 700, fontSize: 11 }}>{actualTotal}만</div>
              </div>
            </div>
          </div>
        )}

        {/* ⑤ 비용 명세 */}
        {trip.expenses.length > 0 && (
          <div className="section">
            <div className="section-title">⑤ 비용 명세</div>
            <table className="expense-table">
              <thead>
                <tr>
                  <th style={{ width: 65 }}>날짜</th>
                  <th style={{ width: 70 }}>구분</th>
                  <th>세부내용</th>
                  <th style={{ width: 80 }}>통화/금액</th>
                  <th style={{ width: 85 }}>원화금액</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {trip.expenses.map(e => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{e.category}</td>
                    <td>{e.detail ?? '—'}</td>
                    <td className="num">
                      {e.currency !== 'KRW' && e.amountForeign
                        ? `${e.currency} ${e.amountForeign.toLocaleString()}`
                        : '—'}
                    </td>
                    <td className="num">{e.amountKrw.toLocaleString()}원</td>
                    <td>{e.memo ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right' }}>합계</td>
                  <td className="num">{expenseTotal.toLocaleString()}원</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ⑥ 출장 결과 */}
        {(trip.result || trip.nextAction) && (
          <div className="section">
            <div className="section-title">⑥ 출장 결과</div>
            <table className="info-table">
              <tbody>
                {trip.result    && <tr><td className="label">출장 결과</td><td className="value">{trip.result}</td></tr>}
                {trip.nextAction && <tr><td className="label">후속 조치</td><td className="value">{trip.nextAction}</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ⑦ 결재 서명란 */}
        {(approvers.length > 0 || trip.approverName) && (
          <div className="sign-section">
            <div className="section-title">⑦ 결재 확인</div>
            <table className="sign-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>구분</th>
                  <th>성명</th>
                  <th>처리 상태</th>
                  <th>처리 일자</th>
                  <th>의견</th>
                </tr>
              </thead>
              <tbody>
                {/* 작성자 */}
                <tr>
                  <td style={{ fontWeight: 700, background: '#f9f9f9' }}>작성자</td>
                  <td><div className="sign-name">{trip.userName}</div></td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>제출</td>
                  <td style={{ textAlign: 'center' }}>{trip.submittedAt ? fmt(trip.submittedAt) : '—'}</td>
                  <td>—</td>
                </tr>

                {/* 결재자들 */}
                {approvers.map((a: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, background: '#f9f9f9', textAlign: 'center' }}>
                      <span className={`sign-type sign-type-${a.type ?? '결재'}`}>{a.type ?? '결재'}</span>
                    </td>
                    <td>
                      <div className="sign-name">{a.userName}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className={`sign-status status-${a.status === '승인' && a.type === '동의' ? '동의' : a.status ?? '대기'}`}>
                        {a.status === '승인' && a.type === '동의' ? '동의함'
                          : a.status === '승인' ? '승인'
                          : a.status === '반려' ? '반려'
                          : '미처리'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: a.approvedAt ? 700 : 400 }}>
                      {a.approvedAt ? fmt(a.approvedAt) : '—'}
                    </td>
                    <td>{a.comment || '—'}</td>
                  </tr>
                ))}

                {/* 구버전 단일 결재자 */}
                {approvers.length === 0 && trip.approverName && (
                  <tr>
                    <td style={{ fontWeight: 700, background: '#f9f9f9', textAlign: 'center' }}>
                      <span className="sign-type sign-type-결재">결재</span>
                    </td>
                    <td><div className="sign-name">{trip.approverName}</div></td>
                    <td style={{ textAlign: 'center' }}>
                      <div className={`sign-status status-${trip.status === '승인' ? '승인' : '대기'}`}>
                        {trip.status === '승인' ? '승인' : trip.status === '반려' ? '반려' : '미처리'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: trip.approvedAt ? 700 : 400 }}>
                      {trip.approvedAt ? fmt(trip.approvedAt) : '—'}
                    </td>
                    <td>{trip.approvalComment || '—'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 출력 일자 */}
        <div style={{ marginTop: 16, textAlign: 'right', fontSize: 9, color: '#aaa' }}>
          출력일: {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
        </div>

        {/* 인쇄 버튼 (화면에서만) */}
        <div className="no-print" style={{ textAlign: 'center', marginTop: 24 }}>
          <button
            onClick={() => window.print()}
            style={{ padding: '10px 32px', background: '#111', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
            🖨 인쇄
          </button>
          <button
            onClick={() => window.close()}
            style={{ marginLeft: 12, padding: '10px 24px', background: '#eee', color: '#555', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            닫기
          </button>
        </div>

      </div>
    </>
  )
}
