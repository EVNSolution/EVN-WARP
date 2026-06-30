import { prisma } from '@/lib/db'
import CustomerListClient from './CustomerListClient'

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      leads: { select: { id: true, stageCode: true, salesStatus: true } },
      activities: { select: { id: true, date: true, type: true }, orderBy: { date: 'desc' }, take: 1 },
    },
  })

  const total      = customers.length
  const potential  = customers.filter(c => c.status === '잠재고객').length
  const active     = customers.filter(c => c.status === '활성').length
  const done       = customers.filter(c => c.status === '완료').length
  const lost       = customers.filter(c => c.status === '이탈').length

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ background: '#111111' }}>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">고객 관리</h1>
          <p className="text-[11px] mt-0.5" style={{ color: '#C5D42A' }}>
            잠재고객 발굴 · 활동이력 · 리드 전환
          </p>
        </div>
        <div className="flex items-center gap-5 text-xs">
          {[
            { label: '전체', val: total,     color: 'text-white' },
            { label: '잠재',  val: potential, color: 'text-slate-400' },
            { label: '활성',  val: active,    color: 'text-blue-400' },
            { label: '완료',  val: done,      color: 'text-green-400' },
            { label: '이탈',  val: lost,      color: 'text-slate-500' },
          ].map(({ label, val, color }) => (
            <div key={label} className="text-center">
              <div className="text-white/50 text-[10px]">{label}</div>
              <div className={`font-bold text-base ${color}`}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      <CustomerListClient customers={customers as any} />
    </div>
  )
}
