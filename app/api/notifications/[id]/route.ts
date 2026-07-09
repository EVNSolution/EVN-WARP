import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function PATCH(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.$executeRaw`
    UPDATE "Notification" SET "read" = 1 WHERE id = ${id} AND "userId" = ${userId}
  `
  return NextResponse.json({ ok: true })
}
