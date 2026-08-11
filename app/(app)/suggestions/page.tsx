import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import SuggestionsClient from './SuggestionsClient'

export default async function SuggestionsPage() {
  const session = await auth()
  const me = session?.user as any

  const suggestions = await prisma.suggestion.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return (
    <SuggestionsClient
      initialSuggestions={JSON.parse(JSON.stringify(suggestions))}
      myUserId={me?.id ?? ''}
      isAdmin={me?.role === 'admin'}
    />
  )
}
