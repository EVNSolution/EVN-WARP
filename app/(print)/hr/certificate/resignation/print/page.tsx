import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import PrintButton from '../../PrintButton'

export default async function ResignationPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; desiredDate?: string }>
}) {
  const { reason, desiredDate } = await searchParams
  const session = await auth()
  if (!session?.user) redirect('/login')
  const me = session.user as any

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { name: true, position: true, team: { select: { name: true } } },
  })
  if (!user) redirect('/login')

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })

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
        .val { font-size: 11pt; white-space: pre-wrap; }
        .approval-box { border: 1px solid #cbd5e1; text-align: center; }
        .approval-box .role { background: #f8fafc; font-size: 9pt; font-weight: 600; padding: 4px; border-bottom: 1px solid #cbd5e1; }
        .approval-box .sig { padding: 26px 8px; font-size: 9pt; min-height: 40px; }
      `}</style>

      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <PrintButton />
        <a href="/hr" className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 bg-white shadow">
          ← 돌아가기
        </a>
      </div>

      <div className="page">
        <h1 style={{ textAlign: 'center', fontSize: '22pt', fontWeight: 800, letterSpacing: '10px', margin: '10mm 0 18mm' }}>
          사 직 서
        </h1>

        <table>
          <tbody>
            <tr><td className="lbl">소　　속</td><td className="val">{user.team?.name ?? '—'}</td></tr>
            <tr><td className="lbl">직급 / 직책</td><td className="val">{user.position ?? '—'}</td></tr>
            <tr><td className="lbl">성　　명</td><td className="val">{user.name}</td></tr>
            <tr><td className="lbl">사 직 사 유</td><td className="val">{reason || '—'}</td></tr>
            <tr><td className="lbl">사직희망일</td><td className="val">{desiredDate || '—'}</td></tr>
          </tbody>
        </table>

        <p style={{ marginTop: '16mm', fontSize: '12pt', textAlign: 'center', lineHeight: 1.8 }}>
          위 본인은 위와 같은 사유로 사직하고자 하오니 승인하여 주시기 바랍니다.
        </p>
        <p style={{ marginTop: '8mm', textAlign: 'center', fontSize: '12pt' }}>{today}</p>
        <p style={{ marginTop: '10mm', textAlign: 'right', fontSize: '11pt' }}>신 청 인 : {user.name}　(서명)</p>

        <table style={{ marginTop: '16mm' }}>
          <tbody>
            <tr>
              {['팀장', '본부장', '대표이사'].map(role => (
                <td key={role} className="approval-box" style={{ width: '33.33%' }}>
                  <div className="role">{role}</div>
                  <div className="sig" />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
