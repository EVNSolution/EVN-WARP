import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canManageUsers } from '@/lib/permissions'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const me = session?.user as any
  if (!(await canManageUsers(me?.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await prisma.announcement.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
