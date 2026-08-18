import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import CustomerListClient from './CustomerListClient'
import BuildupEventNotice from '@/components/BuildupEventNotice'

export default async function CustomersPage() {
  const session    = await auth()
  const me         = session?.user as any
  const isExternal = me?.employmentType === '사외'

  const customers = await prisma.customer.findMany({
    where: isExternal ? { assignee: me?.name ?? '__none__' } : undefined,
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

      {/* buildup 미처리 이벤트 배지 — 이 화면에 온 사람에게만 보인다 (#27) */}
      <BuildupEventNotice />

      <CustomerListClient customers={customers as any} />
    </div>
  )
}
