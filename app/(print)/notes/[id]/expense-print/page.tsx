import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import PrintButton from './PrintButton'

function krw(v: number | null | undefined) {
  if (!v) return '—'
  return v.toLocaleString('ko-KR') + '원'
}
function fmt(d: string) {
  return d.replace(/-/g, '.')
}

export default async function ExpensePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const activity = await prisma.workActivity.findUnique({
    where: { id },
    include: { team: true, task: { select: { code: true, title: true } } },
  })
  if (!activity) notFound()

  const a = activity as any
  const hasExpense = a.expenseTransport || a.expenseAccomm || a.expenseMeal || a.expenseOther
  const total = (a.expenseTransport ?? 0) + (a.expenseAccomm ?? 0) + (a.expenseMeal ?? 0) + (a.expenseOther ?? 0)

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })

  const ROWS = [
    { label: '교통비', amount: a.expenseTransport, receipt: a.expenseTransportReceipt },
    { label: '숙박비', amount: a.expenseAccomm,    receipt: a.expenseAccommReceipt },
    { label: '식비',   amount: a.expenseMeal,      receipt: a.expenseMealReceipt },
    { label: '기타',   amount: a.expenseOther,     receipt: a.expenseOtherReceipt },
  ]

  const allReceipts = ROWS.flatMap(r =>
    r.receipt ? r.receipt.split('|').map((url: string) => ({ cat: r.label, url, name: decodeURIComponent(url.split('/').pop() ?? url) })) : []
  )

  return (
    <>
      <style>{`
        @page { size: A4; margin: 18mm 15mm; }
        @media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { font-family: 'Noto Sans KR', sans-serif; font-size: 10pt; color: #1e293b; background: white; }
        .page { max-width: 180mm; margin: 0 auto; padding: 8mm 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #cbd5e1; padding: 5px 8px; }
        th { background: #f1f5f9; font-weight: 600; text-align: center; font-size: 9pt; }
        .sec-title { background: #1e3a5f; color: white; font-size: 9.5pt; font-weight: 700; padding: 4px 8px; margin: 10px 0 0; }
        .lbl { width: 28mm; background: #f8fafc; font-weight: 600; font-size: 9pt; color: #475569; text-align: center; white-space: nowrap; }
        .val { font-size: 9.5pt; }
        .approval-box { border: 1px solid #cbd5e1; text-align: center; }
        .approval-box .role { background: #f1f5f9; font-size: 8pt; font-weight: 600; padding: 3px; border-bottom: 1px solid #cbd5e1; }
        .approval-box .sig { padding: 22px 8px; font-size: 9pt; min-height: 36px; }
      `}</style>

      {/* 화면 전용 버튼 */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <PrintButton />
        <a href={`/notes/${id}/edit`}
          className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 bg-white shadow">
          ← 돌아가기
        </a>
      </div>

      <div className="page">
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #1e3a5f', paddingBottom: 6, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: '8pt', color: '#64748b', marginBottom: 2 }}>EV& 솔루션</div>
            <div style={{ fontSize: '17pt', fontWeight: 800, color: '#1e3a5f' }}>비용신청품의서</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '8.5pt', color: '#64748b' }}>
            <div>신청일: {today}</div>
            <div style={{ marginTop: 3 }}>
              <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '1px 7px', borderRadius: 4, fontSize: '8pt', fontWeight: 600 }}>
                {a.expenseStatus ?? '초안'}
              </span>
            </div>
          </div>
        </div>

        {/* ① 신청 정보 */}
        <div className="sec-title">① 신청 정보</div>
        <table>
          <tbody>
            <tr>
              <td className="lbl">신청자</td>
              <td className="val">{a.userName ?? '—'}{activity.team?.name ? ` / ${activity.team.name}` : ''}</td>
              <td className="lbl">신청일</td>
              <td className="val">{today}</td>
            </tr>
            <tr>
              <td className="lbl">활동 일자</td>
              <td className="val">{fmt(activity.date)}{a.endDate ? ` ~ ${fmt(a.endDate)}` : ''}</td>
              <td className="lbl">활동 유형</td>
              <td className="val">{activity.type}</td>
            </tr>
            <tr>
              <td className="lbl">제목</td>
              <td className="val" colSpan={3}>{activity.title}</td>
            </tr>
            {activity.task && (
              <tr>
                <td className="lbl">연계 과제</td>
                <td className="val" colSpan={3}>[{activity.task.code}] {activity.task.title}</td>
              </tr>
            )}
            {activity.content && (
              <tr>
                <td className="lbl">활동 내용</td>
                <td className="val" colSpan={3} style={{ whiteSpace: 'pre-wrap', fontSize: '9pt' }}>{activity.content}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ② 비용 명세 */}
        <div className="sec-title">② 비용 명세</div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '20%' }}>구분</th>
              <th style={{ width: '30%' }}>금액</th>
              <th>증빙 영수증</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(r => (
              <tr key={r.label}>
                <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '9pt' }}>{r.label}</td>
                <td style={{ textAlign: 'right', fontSize: '9.5pt' }}>{krw(r.amount)}</td>
                <td style={{ fontSize: '8.5pt', color: '#475569' }}>
                  {r.receipt
                    ? r.receipt.split('|').map((url: string, i: number) =>
                        <span key={i}>{i > 0 ? ', ' : ''}{decodeURIComponent(url.split('/').pop() ?? url)}</span>)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
              <td style={{ textAlign: 'center' }}>합 계</td>
              <td style={{ textAlign: 'right', color: '#1e3a5f', fontSize: '10pt' }}>{krw(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>

        {/* 비용 메모 */}
        {a.expenseNote && (
          <div style={{ fontSize: '8.5pt', color: '#475569', marginTop: 4, padding: '4px 8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4 }}>
            <strong>비고:</strong> {a.expenseNote}
          </div>
        )}

        {/* ③ 영수증 첨부 목록 */}
        {allReceipts.length > 0 && (
          <>
            <div className="sec-title">③ 영수증 첨부 목록</div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>구분</th>
                  <th>파일명</th>
                </tr>
              </thead>
              <tbody>
                {allReceipts.map((r, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{r.cat}</td>
                    <td style={{ fontSize: '8.5pt' }}>{r.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ④ 결재란 */}
        <div className="sec-title">④ 결재란</div>
        <table>
          <tbody>
            <tr>
              {['신청자', '검토', '승인'].map((role, i) => (
                <td key={i} className="approval-box" style={{ width: '33.33%' }}>
                  <div className="role">{role}</div>
                  <div className="sig">
                    {role === '신청자' ? (a.userName ?? '') : ''}
                    {role === '승인' && a.expenseApproverName ? (
                      <>
                        <div>{a.expenseApproverName}</div>
                        {a.expenseStatus === '승인' && <div style={{ fontSize: '7.5pt', color: '#16a34a', marginTop: 2 }}>✓ 승인완료</div>}
                        {a.expenseStatus === '반려' && <div style={{ fontSize: '7.5pt', color: '#dc2626', marginTop: 2 }}>✕ 반려</div>}
                      </>
                    ) : ''}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 14, fontSize: '8pt', color: '#94a3b8', textAlign: 'center' }}>
          EV& 솔루션 · 비용신청품의서 · {activity.title}
        </div>
      </div>
    </>
  )
}
