import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import PrintButton from '../../PrintButton'

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
    select: { name: true, position: true, hireDate: true, team: { select: { name: true } } },
  })
  if (!user) redirect('/login')

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const hireDateStr = user.hireDate ? user.hireDate.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'

  return (
    <>
      <style>{`
        @page { size: A4; margin: 25mm 20mm; }
        @media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { font-family: 'Noto Sans KR', sans-serif; font-size: 11pt; color: #1e293b; background: white; }
        .page { max-width: 170mm; margin: 0 auto; }
        table { border-collapse: collapse; width: 100%; margin-top: 4mm; }
        td { border: 1px solid #cbd5e1; padding: 7px 10px; }
        .lbl { width: 40mm; background: #f8fafc; font-weight: 600; text-align: center; white-space: nowrap; }
        .val { font-size: 11pt; }
      `}</style>

      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <PrintButton />
        <a href="/hr" className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 bg-white shadow">
          ← 돌아가기
        </a>
      </div>

      <div className="page">
        <h1 style={{ textAlign: 'center', fontSize: '22pt', fontWeight: 800, letterSpacing: '10px', margin: '10mm 0 18mm' }}>
          재 직 증 명 서
        </h1>

        <table>
          <tbody>
            <tr><td className="lbl">성　　명</td><td className="val">{user.name}</td></tr>
            <tr><td className="lbl">입　사　일</td><td className="val">{hireDateStr}</td></tr>
            <tr><td className="lbl">직급 / 직책</td><td className="val">{user.position ?? '—'}</td></tr>
            <tr><td className="lbl">부　　서</td><td className="val">{user.team?.name ?? '—'}</td></tr>
            <tr><td className="lbl">용　　도</td><td className="val">{purpose || '—'}</td></tr>
          </tbody>
        </table>

        <p style={{ marginTop: '16mm', fontSize: '12pt', textAlign: 'center', lineHeight: 1.8 }}>
          위 사람은 위와 같이 당사에 재직하고 있음을 증명합니다.
        </p>
        <p style={{ marginTop: '8mm', textAlign: 'center', fontSize: '12pt' }}>{today}</p>

        <table style={{ marginTop: '16mm' }}>
          <tbody>
            <tr><td className="lbl">회 사 명</td><td className="val">이브이앤솔루션</td></tr>
            <tr><td className="lbl">대 표 자</td><td className="val">　　　　　　　　　 (인)</td></tr>
            <tr><td className="lbl">사업자등록번호</td><td className="val">　　　　　　　　　</td></tr>
            <tr><td className="lbl">주　　소</td><td className="val">　　　　　　　　　</td></tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
