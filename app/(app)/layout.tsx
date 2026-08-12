import { auth } from '@/auth'
import { canManageUsers, isAdminRole } from '@/lib/permissions'
import Sidebar from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const user = session?.user
  const isAdmin      = isAdminRole((user as any)?.role)
  const isExternal    = (user as any)?.employmentType === '사외'
  const isManagement  = await canManageUsers((user as any)?.id)

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar userName={user?.name ?? ''} userEmail={user?.email ?? ''} isAdmin={isAdmin} isExternal={isExternal} isManagement={isManagement} />
      <main className="flex-1 overflow-auto" style={{ backgroundColor: '#f8f9fa' }}>{children}</main>
    </div>
  )
}
