import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import TripForm from '@/components/TripForm'

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; date?: string }>
}) {
  const session = await auth()
  const user = session?.user as any
  const { type, date } = await searchParams

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })

  const today = new Date().toISOString().slice(0, 10)
  const tripType = type === '해외출장' ? '해외출장' : '국내출장'
  const startDate = date ?? today

  return (
    <TripForm
      mode="create"
      currentUserId={user?.id ?? ''}
      users={users}
      initial={{
        type: tripType,
        title: '',
        userId: user?.id ?? '',
        userName: user?.name ?? user?.email ?? '',
        destination: '',
        purpose: '',
        startDate,
        endDate: startDate,
        status: '초안',
      }}
    />
  )
}
