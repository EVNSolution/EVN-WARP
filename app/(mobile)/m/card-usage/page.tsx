import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { canManageUsers } from '@/lib/permissions'
import { CardUsageManager } from '@/components/CardUsageModal'

export const dynamic = 'force-dynamic'

export default async function MobileCardUsagePage() {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) redirect('/login')

  const todayStr = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)  // KST
  const canViewAll = await canManageUsers(me.id)

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      <div className="px-4 pt-5 pb-1">
        <h1 className="text-lg font-bold text-gray-900">법인카드사용</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">활동과 연계되지 않은 사용 등록 · 활동 중 사용분은 활동추가 › 비용에서 입력</p>
      </div>
      <CardUsageManager todayStr={todayStr} myUserId={me.id} canViewAll={canViewAll} className="pb-6" />
    </div>
  )
}
