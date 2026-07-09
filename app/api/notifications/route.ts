import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) return NextResponse.json([], { status: 401 })

  const notifications = await (prisma as any).notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return NextResponse.json(notifications)
}
