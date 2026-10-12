import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { generateToken, hashToken } from '@/lib/mcp/auth'

/**
 * AI 연결 토큰 관리 — 내 계정 화면에서 쓴다.
 * 토큰 원문은 POST 응답에서 한 번만 내려가고 서버에는 해시만 남는다.
 */

async function me() {
  const session = await auth()
  const u = session?.user as any
  return u?.id ? { id: u.id as string } : null
}

export async function GET() {
  const user = await me()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const row = await prisma.mcpToken.findFirst({
    where: { userId: user.id, revokedAt: null },
    select: { createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ connected: !!row, createdAt: row?.createdAt ?? null, lastUsedAt: row?.lastUsedAt ?? null })
}

export async function POST() {
  const user = await me()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const token = generateToken()
  await prisma.$transaction([
    // 재발급 = 기존 활성 토큰 전부 폐기 (사용자당 1개)
    prisma.mcpToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.mcpToken.create({ data: { userId: user.id, tokenHash: hashToken(token) } }),
  ])
  return NextResponse.json({ token })
}

export async function DELETE() {
  const user = await me()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  await prisma.mcpToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
  return NextResponse.json({ ok: true })
}
