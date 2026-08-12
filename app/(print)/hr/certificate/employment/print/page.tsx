import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import PrintButton from '../../PrintButton'

function ymd(d: Date) {
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }
}

export default async function EmploymentCertPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ purpose?: string }>
}) {
  const { purpose } = await searchParams
  const session = await auth()
  if (!session?.user) redirect('/login')
  const me = session.user as any

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { name: true, position: true, hireDate: true, ssnFront: true, ssnBack: true, address: true, team: { select: { name: true } } },
  })
  if (!user) redirect('/login')

  const today = ymd(new Date())
  const hire = user.hireDate ? ymd(user.hireDate) : null
  const ssn = user.ssnFront
    ? `${user.ssnFront} - ${user.ssnBack ? user.ssnBack.charAt(0) + '●●●●●●' : '●●●●●●●'}`
    : ''

  return (
    <>
      <style>{`
        @page { size: A4; margin: 25mm 20mm; }
        @media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { font-family: 'Noto Sans KR', sans-serif; font-size: 11pt; color: #1e293b; background: white; }
        .page { max-width: 170mm; margin: 0 auto; }
        table { border-collapse: collapse; width: 100%; margin-top: 6mm; }
        td { border: 1px solid #cbd5e1; padding: 7px 12px; }
        .lbl { width: 42mm; background: #f8fafc; font-weight: 600; text-align: center; white-space: nowrap; }
        .val { font-size: 11pt; min-height: 1em; }
        .seal-slot { display: inline-block; width: 26mm; height: 26mm; vertical-align: middle; }
      `}</style>

      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <PrintButton />
        <a href="/hr" className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 bg-white shadow">
          ← 돌아가기
        </a>
      </div>

      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #1e293b', paddingBottom: '3mm' }}>
          <div style={{ fontSize: '18pt', fontWeight: 900, letterSpacing: '-0.03em' }}>
            EV<span style={{ color: '#8fa300' }}>&amp;</span>
          </div>
          <div style={{ fontSize: '9pt', color: '#64748b' }}>이브이앤솔루션 서식 1호</div>
        </div>

        <h1 style={{ textAlign: 'center', fontSize: '22pt', fontWeight: 800, letterSpacing: '10px', margin: '14mm 0 14mm' }}>
          재 직 증 명 서
        </h1>

        <table>
          <tbody>
            <tr><td className="lbl">성　　명</td><td className="val">{user.name}</td></tr>
            <tr><td className="lbl">주민등록번호</td><td className="val">{ssn}</td></tr>
            <tr><td className="lbl">소　　속</td><td className="val">{user.team?.name ?? ''}</td></tr>
            <tr><td className="lbl">직　　위</td><td className="val">{user.position ?? ''}</td></tr>
            <tr><td className="lbl">현　주　소</td><td className="val">{user.address ?? ''}</td></tr>
            <tr><td className="lbl">용　　도</td><td className="val">{purpose || ''}</td></tr>
          </tbody>
        </table>

        <p style={{ marginTop: '14mm', fontSize: '12pt', textAlign: 'center', lineHeight: 2 }}>
          상기인은 {hire ? `${hire.y}년 ${hire.m}월 ${hire.d}일` : '　　　년 　　월 　　일'}자로 당사에 입사하여{' '}
          {today.y}년 {today.m}월 {today.d}일<br />
          현재 당사에 재직중임을 증명합니다.
        </p>

        <p style={{ marginTop: '10mm', textAlign: 'center', fontSize: '12pt' }}>
          {today.y}년&nbsp;&nbsp;{today.m}월&nbsp;&nbsp;{today.d}일
        </p>

        <div style={{ marginTop: '14mm', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '14pt', fontWeight: 800, marginBottom: '4mm' }}>이브이앤솔루션 주식회사</p>
            <p style={{ fontSize: '13pt', fontWeight: 700 }}>대표이사 민원기</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/company-seal.png" alt="" className="seal-slot" style={{ marginTop: '9mm', marginLeft: '-3mm' }} />
        </div>

        <p style={{ marginTop: '20mm', fontSize: '9pt', color: '#64748b' }}>
          ※ 본 증명서는 보증용으로 사용 할 수 없습니다.
        </p>
      </div>
    </>
  )
}
