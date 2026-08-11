import { auth } from '@/auth'
import Sidebar from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const user = session?.user
  const isAdmin    = (user as any)?.role === 'admin'
  const isExternal = (user as any)?.employmentType === '사외'

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar userName={user?.name ?? ''} userEmail={user?.email ?? ''} isAdmin={isAdmin} isExternal={isExternal} />
      <main className="flex-1 overflow-auto" style={{ backgroundColor: '#f8f9fa' }}>{children}</main>
    </div>
  )
}
