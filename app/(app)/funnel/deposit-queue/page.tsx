import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { canViewAllLeads } from '@/lib/permissions'
import { readDepositQueue } from '@/lib/sales-process-read'
import { readSalesProcess } from '@/lib/sales-process'

export default async function DepositQueuePage() {
  const session=await auth()
  if(!session?.user?.id) redirect('/login')
  const canSeeAll=await canViewAllLeads(session.user.id)
  const {deals,positions}=await readDepositQueue()
  const visible=deals.filter(d=>(canSeeAll || d.assignee===session.user!.name) && (d.customer?.customerSegment ?? d.customerSegment)!=='B2B')
    .sort((a,b)=>{
      const ad=readSalesProcess(a.salesProcessJson).deposit, bd=readSalesProcess(b.salesProcessJson).deposit
      return ad.model.localeCompare(bd.model,'ko') || ad.spec.localeCompare(bd.spec,'ko') || (ad.date||'9999').localeCompare(bd.date||'9999')
    })
  return <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
    <Link href="/funnel" className="text-sm text-blue-700">← 영업 파이프라인</Link>
    <h1 className="text-xl font-bold">계약금 · 출고 대기 순번</h1>
    <p className="text-sm text-slate-600">B2C · 같은 모델·주요 사양 내 실제 입금일 순입니다. 실제 출고 일정과는 별도이며, 미입금·증빙 미확인·환불·순번 검토 대상은 순번을 부여하지 않습니다.</p>
    <div className="grid gap-3 md:grid-cols-2">
      {visible.map(d=>{const p=readSalesProcess(d.salesProcessJson).deposit, rank=positions.get(d.id)
        return <Link key={d.id} href={`/funnel/${d.id}`} className="rounded-xl bg-white border border-slate-200 p-4 space-y-2 hover:border-blue-400 break-words">
          <div className="flex gap-2 justify-between"><strong>{d.name}</strong><span className="text-sm text-blue-700">{rank?.position ? `${rank.position}순위` : '확인 필요'}</span></div>
          <p className="text-sm">{p.model||'모델 미확인'} · {p.spec||'주요 사양 미확인'}</p>
          <p className="text-sm text-slate-600">실제 입금일 {p.date||'확인 필요'} {p.time} · {p.amountWon===null?'금액 미확인':`${p.amountWon.toLocaleString('ko-KR')}원`}</p>
          <p className="text-xs text-slate-500">{rank?.message}</p>
        </Link>})}
    </div>
    {!visible.length && <p className="py-8 text-slate-500">아직 확인할 계약금 기록이 없습니다.</p>}
  </div>
}
