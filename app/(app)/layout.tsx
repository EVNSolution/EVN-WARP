import { auth } from '@/auth'
import Sidebar from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const user = session?.user

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar userName={user?.name ?? ''} userEmail={user?.email ?? ''} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
