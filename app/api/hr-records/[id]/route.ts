import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canManageUsers } from '@/lib/permissions'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!(await canManageUsers((session?.user as any)?.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await prisma.hrRecord.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
