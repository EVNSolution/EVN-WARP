import { auth } from '@/auth'
import AccountClient from './AccountClient'

export default async function AccountPage() {
  const session = await auth()
  const user = session?.user

  return (
    <AccountClient
      userName={user?.name ?? ''}
      userEmail={user?.email ?? ''}
    />
  )
}
