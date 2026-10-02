import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

// 본인 개인카드 목록
export async function GET() {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json([], { status: 401 })
  const cards = await prisma.personalCard.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'asc' } })
  return NextResponse.json(cards)
}

// 개인카드 등록 — 카드번호 전체는 받지 않고 뒤 4자리만 저장
export async function POST(req: NextRequest) {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const body = await req.json()
  const alias = String(body?.alias ?? '').trim()
  const last4 = String(body?.last4 ?? '').replace(/\D/g, '').slice(-4) || null
  if (!alias) return NextResponse.json({ error: '카드 별칭을 입력해주세요.' }, { status: 400 })

  const id = randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "PersonalCard" ("id","userId","alias","last4") VALUES (${id}, ${me.id}, ${alias}, ${last4})`
  return NextResponse.json(await prisma.personalCard.findUnique({ where: { id } }), { status: 201 })
}
