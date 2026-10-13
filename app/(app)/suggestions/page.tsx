import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { isAdminRole } from '@/lib/permissions'
import SuggestionsClient from './SuggestionsClient'

export default async function SuggestionsPage() {
  const session = await auth()
  const me = session?.user as any

  // AI(CLEVER) 연결로 들어온 피드백은 AI 업무 기록 화면에서 관리한다 — 제안함은 WARP 기능/UI 의견 전용
  const suggestions = await prisma.suggestion.findMany({
    where: { NOT: { title: { startsWith: '[AI 피드백]' } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <SuggestionsClient
      initialSuggestions={JSON.parse(JSON.stringify(suggestions))}
      myUserId={me?.id ?? ''}
      isAdmin={isAdminRole(me?.role)}
    />
  )
}
