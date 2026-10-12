import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { listCustomers } from '@/lib/customer-list'
import CustomerListClient from './CustomerListClient'
import BuildupEventNotice from '@/components/BuildupEventNotice'

export default async function CustomersPage() {
  const session    = await auth()
  const me         = session?.user as any
  const isExternal = me?.employmentType === '사외'
  const actor = me?.id ? await prisma.user.findUnique({
    where: { id: me.id }, select: { role: true, employmentType: true },
  }) : null
  const canMergeCustomers = !!actor && ['admin', 'ceo'].includes(actor.role) && actor.employmentType !== '사외'

  const customers = await listCustomers(prisma, isExternal ? { assignee: me?.name ?? '__none__' } : undefined)

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">
      {/* 헤더 (공통 스타일: 검은 배경 + 둥근 모서리) */}
      <div className="px-6 py-3 shrink-0 mx-4 mt-3 mb-1 rounded-xl" style={{ background: '#111111' }}>
        <h1 className="text-lg font-bold text-white leading-tight">고객 관리</h1>
        <p className="text-[11px] mt-0.5" style={{ color: '#C5D42A' }}>
          잠재고객 발굴 · 활동이력 · 리드 전환
        </p>
      </div>

      {/* buildup 미처리 이벤트 배지 — 이 화면에 온 사람에게만 보인다 (#27) */}
      <BuildupEventNotice />

      <CustomerListClient customers={customers as any} canMergeCustomers={canMergeCustomers} />
    </div>
  )
}
