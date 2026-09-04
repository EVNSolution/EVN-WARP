import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

function fmt(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')
}

function maskPhone(phone: string | null | undefined) {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 4) {
    const last4 = digits.slice(-4)
    const prefix = digits.length === 11 ? `${digits.slice(0,3)}-****-` : `${digits.slice(0,3)}-***-`
    return `${prefix}${last4}`
  }
  return phone
}

export default async function KiaLetterPage() {
  const session = await auth()
  if (!(session?.user as any)?.id) redirect('/login')

  const today = new Date()
  const dateStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const docNo = `EVN-${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}-01`

  const deals = await prisma.salesDeal.findMany({
    where: { stageCode: '2-1', salesStatus: { not: '이탈' } },
    select: {
      name: true, phone: true, vehicleModel: true,
      purchaseMethod: true, contractedAt: true, capitalCheckedAt: true, bodyType: true,
    },
    orderBy: { stageChangedAt: 'desc' },
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&family=Noto+Sans+KR:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif; background: #e8ecf2; color: #1c2536; font-size: 14px; line-height: 1.75; padding: 32px 16px 48px; }
        .print-bar { max-width: 860px; margin: 0 auto 20px; display: flex; justify-content: flex-end; gap: 8px; }
        .btn { padding: 8px 18px; border: none; font-family: 'Noto Sans KR', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; border-radius: 4px; }
        .btn-print { background: #1a4b8c; color: #fff; }
        .btn-back { background: #fff; color: #4a5570; border: 1px solid #c5d0e0; }
        .page { background: #fff; max-width: 860px; margin: 0 auto; box-shadow: 0 4px 32px rgba(26,36,54,.14); padding: 64px 72px 72px; }
        .letterhead { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 20px; border-bottom: 3px solid #1a4b8c; margin-bottom: 32px; }
        .lh-name { font-family: 'Noto Serif KR', serif; font-size: 22px; font-weight: 700; color: #1a4b8c; }
        .lh-sub { font-size: 11px; color: #8898b4; letter-spacing: .05em; margin-top: 2px; }
        .lh-meta { text-align: right; font-size: 11px; color: #4a5570; line-height: 1.6; }
        .lh-meta strong { color: #1c2536; font-weight: 600; }
        .doc-header { background: #f4f6f9; border: 1px solid #c5d0e0; border-left: 4px solid #1a4b8c; padding: 18px 22px; margin-bottom: 28px; display: grid; grid-template-columns: auto 1fr; gap: 6px 24px; font-size: 13px; }
        .doc-header .lbl { color: #8898b4; font-weight: 600; white-space: nowrap; }
        .doc-subject { margin-bottom: 28px; padding-bottom: 16px; border-bottom: 1px solid #dde4ef; }
        .doc-subject .subject-label { font-size: 10px; font-weight: 600; letter-spacing: .12em; color: #8898b4; text-transform: uppercase; margin-bottom: 6px; }
        .doc-subject h1 { font-family: 'Noto Serif KR', serif; font-size: 18px; font-weight: 700; }
        .body-p { font-size: 13.5px; line-height: 1.9; word-break: keep-all; margin-bottom: 24px; }
        .section-title { font-weight: 600; font-size: 13px; color: #1a4b8c; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .section-title::before { content: ''; display: inline-block; width: 3px; height: 14px; background: #1a4b8c; border-radius: 2px; }
        .table-note { font-size: 12.5px; color: #4a5570; margin-bottom: 8px; }
        .table-wrap { overflow-x: auto; border: 1px solid #c5d0e0; margin: 0 0 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; min-width: 680px; }
        .thead-group th { padding: 8px 12px; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-align: center; border-bottom: 1px solid #c5d0e0; border-right: 1px solid #c5d0e0; }
        .th-evn { background: #dde5f2; color: #1a4b8c; }
        .th-kia { background: #d0e2fb; color: #1355aa; }
        .thead-col th { padding: 9px 10px; font-size: 11px; font-weight: 600; color: #4a5570; border-bottom: 2px solid #c5d0e0; border-right: 1px solid #dde4ef; white-space: nowrap; text-align: center; }
        .col-evn { background: #f4f6f9; }
        .col-kia { background: #e8f0fc; }
        tbody tr { border-bottom: 1px solid #dde4ef; }
        tbody tr:last-child { border-bottom: none; }
        tbody td { padding: 9px 10px; border-right: 1px solid #dde4ef; vertical-align: middle; }
        tbody td:last-child { border-right: none; }
        .td-evn { background: #fafbfd; }
        .td-kia { background: #f5f9ff; color: #8898b4; text-align: center; font-size: 11px; }
        td.name-cell { font-weight: 600; }
        td.phone-cell { font-size: 11px; color: #4a5570; text-align: center; }
        td.center { text-align: center; }
        td.model-cell { font-weight: 500; color: #2d6abf; text-align: center; }
        .confirm-list { background: #e8f0fc; border: 1px solid #b8d0f5; border-left: 4px solid #2d6abf; padding: 16px 20px; margin: 20px 0; }
        .confirm-list .cl-title { font-weight: 700; font-size: 12.5px; color: #1a4b8c; margin-bottom: 10px; }
        .confirm-list ol { padding-left: 20px; }
        .confirm-list li { font-size: 13px; line-height: 1.8; margin-bottom: 4px; }
        .confirm-list li strong { color: #2d6abf; }
        .signature { margin-top: 48px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .sig-date { font-size: 13px; color: #4a5570; margin-bottom: 12px; }
        .sig-block { text-align: right; padding: 16px 24px; border: 1px solid #c5d0e0; min-width: 220px; }
        .sig-company { font-family: 'Noto Serif KR', serif; font-size: 14px; font-weight: 700; margin-bottom: 2px; }
        .sig-ceo { font-size: 13px; color: #4a5570; }
        .sig-stamp { display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; border: 2px solid #cc2b2b; border-radius: 4px; font-family: 'Noto Serif KR', serif; font-size: 13px; font-weight: 700; color: #cc2b2b; margin: 10px 0 0 auto; }
        .footnote { margin-top: 32px; padding-top: 16px; border-top: 1px solid #dde4ef; font-size: 11px; color: #8898b4; line-height: 1.7; }
        .fn-mark { color: #2d6abf; font-weight: 600; }
        .no-data { text-align: center; padding: 24px; color: #8898b4; font-size: 13px; }
        @media print {
          body { background: white; padding: 0; }
          .print-bar { display: none; }
          .page { box-shadow: none; padding: 20mm 18mm; }
        }
      `}</style>

      <div className="print-bar">
        <a href="/sales-report" className="btn btn-back">← 영업리포트</a>
        <button className="btn btn-print" onClick={() => window.print()}>🖨 인쇄 / PDF 저장</button>
      </div>

      <div className="page">
        {/* 레터헤드 */}
        <div className="letterhead">
          <div>
            <div className="lh-name">이브이앤솔루션(주)</div>
            <div className="lh-sub">EV&amp;SOLUTION CO., LTD.</div>
          </div>
          <div className="lh-meta">
            <strong>문서번호</strong> {docNo}<br />
            <strong>시&nbsp;&nbsp;&nbsp;&nbsp;행</strong> {dateStr}<br />
            <strong>담&nbsp;&nbsp;&nbsp;&nbsp;당</strong> 영업팀
          </div>
        </div>

        {/* 공문 헤더 */}
        <div className="doc-header">
          <span className="lbl">수&nbsp;&nbsp;&nbsp;신</span>
          <span>기아 주식회사 대장신도시대리점 안영환 대표님</span>
          <span className="lbl">발&nbsp;&nbsp;&nbsp;신</span>
          <span>이브이앤솔루션(주) 대표이사</span>
          <span className="lbl">참&nbsp;&nbsp;&nbsp;조</span>
          <span>영업 담당자</span>
        </div>

        {/* 제목 */}
        <div className="doc-subject">
          <div className="subject-label">제 목</div>
          <h1>EV 차량(PV5) 구매 고객 리드 현황 공유 및 확인 요청</h1>
        </div>

        {/* 본문 */}
        <p className="body-p">
          귀 대리점의 지속적인 협조에 깊이 감사드립니다.<br /><br />
          당사는 귀 대리점과의 주간 업무 협업 효율을 높이기 위해, 본 공문을 매주 정례적으로 발송하고자 합니다.
          이를 통해 납차 일정·보조금 처리 현황을 양사가 동일한 정보 기반 위에서 신속하게 조율할 수 있도록 하겠습니다.
        </p>

        {/* 고객 현황 */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-title">판매신청단계 고객 현황</div>
          <p className="table-note">
            아래 고객 정보는 당사가 확보·확인 완료한 사항입니다.
            파란 배경 컬럼은 귀 대리점 확인을 요청하는 항목입니다.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr className="thead-group">
                  <th colSpan={6} className="th-evn">EVN 확보 정보</th>
                  <th colSpan={3} className="th-kia">기아 대리점 확인 요청사항</th>
                </tr>
                <tr className="thead-col">
                  <th className="col-evn">성명</th>
                  <th className="col-evn">연락처</th>
                  <th className="col-evn">차량모델</th>
                  <th className="col-evn">구매방식</th>
                  <th className="col-evn">계약금납입일</th>
                  <th className="col-evn">사전신용<br />조회일</th>
                  <th className="col-kia">차량견적<br />제공일</th>
                  <th className="col-kia">보조금<br />신청현황</th>
                  <th className="col-kia">출고<br />예정일</th>
                </tr>
              </thead>
              <tbody>
                {deals.length === 0 ? (
                  <tr><td colSpan={9} className="no-data">판매신청단계(2-1) 고객이 없습니다.</td></tr>
                ) : deals.map((d, i) => (
                  <tr key={i}>
                    <td className="td-evn name-cell">{d.name}</td>
                    <td className="td-evn phone-cell">{maskPhone(d.phone)}</td>
                    <td className="td-evn model-cell">{d.vehicleModel ?? '—'}</td>
                    <td className="td-evn center">{d.purchaseMethod ?? '—'}</td>
                    <td className="td-evn center">{fmt(d.contractedAt)}</td>
                    <td className="td-evn center">{fmt(d.capitalCheckedAt)}</td>
                    <td className="td-kia">—</td>
                    <td className="td-kia">—</td>
                    <td className="td-kia">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 확인 요청 */}
        <div className="confirm-list">
          <div className="cl-title">📋 귀 대리점 확인 요청사항</div>
          <ol>
            <li><strong>차량 견적 제공일</strong> — 각 고객별 공식 견적서 제공 일자</li>
            <li><strong>보조금 신청 현황</strong> — 신청 전 / 신청 진행 중 / 신청 완료 여부 및 처리 기관</li>
            <li><strong>차량 출고 예정 시점</strong> — 현재 기준 예상 납차 일정 (월/분기 단위도 가능)</li>
          </ol>
        </div>

        <p className="body-p">
          상기 내용은 당사 영업리포트 시스템을 통해 정례적으로 주 1회 공유될 예정이며,
          귀 대리점의 회신 내용은 당사 시스템에 반영하여 납차·특장 일정을 조율하는 데 활용됩니다.<br />
          바쁘신 중에 협조를 요청드려 죄송합니다. 확인 후 이메일 또는 유선으로 회신 주시면 감사하겠습니다.
        </p>

        {/* 서명 */}
        <div className="signature">
          <div className="sig-date">{dateStr}</div>
          <div className="sig-block">
            <div className="sig-company">이브이앤솔루션(주)</div>
            <div className="sig-ceo">대표이사 &nbsp; (인)</div>
            <div className="sig-stamp">직인</div>
          </div>
        </div>

        {/* 각주 */}
        <div className="footnote">
          <span className="fn-mark">※</span> 본 공문에 기재된 고객 개인정보(성명·연락처)는 차량 계약 및 보조금 처리 목적으로만 공유되며,
          「개인정보 보호법」 제17조에 따른 제3자 제공 동의를 득한 정보입니다.<br />
          <span className="fn-mark">※</span> 연락처: EVN 영업팀 · adamlee@evnsolution.com
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        document.querySelector('.btn-print')?.addEventListener('click', () => window.print());
      `}} />
    </>
  )
}
