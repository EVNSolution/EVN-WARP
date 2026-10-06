import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import CustomerMergePanel from '@/components/CustomerMergePanel'

export default async function CustomerDuplicatesPage() {
  const session = await auth()
  const actor = session?.user?.id ? await prisma.user.findUnique({
    where: { id: session.user.id }, select: { role: true, employmentType: true },
  }) : null
  if (!actor || !['admin', 'ceo'].includes(actor.role) || actor.employmentType === '사외') {
    return <div className="p-6 text-sm">중복 고객 통합은 관리자·대표 계정에서 사용할 수 있습니다.</div>
  }
  return <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
    <Link href="/customers" className="text-sm text-slate-600 underline">← 고객 관리로 돌아가기</Link>
    <CustomerMergePanel />
  </main>
}
