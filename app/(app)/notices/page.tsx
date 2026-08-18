import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { canManageUsers } from '@/lib/permissions'
import NoticesClient from './NoticesClient'

export default async function NoticesPage() {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) redirect('/login')

  const [isManager, announcements, teams] = await Promise.all([
    canManageUsers(me.id),
    prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.team.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])

  return (
    <NoticesClient
      isManager={isManager}
      initialAnnouncements={JSON.parse(JSON.stringify(announcements))}
      teams={teams}
    />
  )
}
