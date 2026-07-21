import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function PATCH(req: NextRequest) {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { teamId } = await req.json()
  await prisma.user.update({ where: { id: me.id }, data: { teamId: teamId || null } })
  return NextResponse.json({ ok: true })
}
