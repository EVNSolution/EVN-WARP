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

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 py-3 shrink-0" style={{ background: '#111111' }}>
        <h1 className="text-lg font-bold text-white leading-tight">고객 관리</h1>
        <p className="text-[11px] mt-0.5" style={{ color: '#C5D42A' }}>
          잠재고객 발굴 · 활동이력 · 리드 전환
        </p>
      </div>

      <CustomerListClient customers={customers as any} />
    </div>
  )
}
