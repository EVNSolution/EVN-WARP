import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import AccountClient from './AccountClient'

export default async function AccountPage() {
  const session = await auth()
  const me = session?.user as any

  const [teams, dbUser] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    me?.id ? prisma.user.findUnique({ where: { id: me.id }, select: { teamId: true } }) : null,
  ])

  return (
    <AccountClient
      userName={me?.name ?? ''}
      userEmail={me?.email ?? ''}
      teams={teams}
      currentTeamId={dbUser?.teamId ?? null}
    />
  )
}
