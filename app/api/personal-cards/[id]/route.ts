import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  await prisma.$executeRaw`DELETE FROM "PersonalCard" WHERE "id" = ${id} AND "userId" = ${me.id}`
  return NextResponse.json({ ok: true })
}
