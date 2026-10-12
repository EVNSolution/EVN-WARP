import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { dongjakLogin, dongjakStatus } from '@/lib/mcp/dongjak'

/**
 * 회의실 예약(동작사무실) 계정 연결 — 내 계정 화면에서 쓴다.
 * 비밀번호는 로그인 순간에만 사용하고 저장하지 않는다. 세션 식별자만 User 에 둔다.
 */

async function me() {
  const session = await auth()
  const u = session?.user as any
  return u?.id ? { id: u.id as string } : null
}

export async function GET() {
  const user = await me()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { dongjakSessionId: true } })
  const status = await dongjakStatus(row?.dongjakSessionId)
  return NextResponse.json({ connected: status.loggedIn, userName: status.userName ?? null })
}

export async function POST(req: NextRequest) {
  const user = await me()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const { id, password } = await req.json().catch(() => ({}))
  if (!id || !password) return NextResponse.json({ error: 'ID 와 비밀번호를 입력해 주세요.' }, { status: 400 })
  try {
    const sessionId = `sess_${randomBytes(9).toString('hex')}`
    const r = await dongjakLogin(sessionId, String(id), String(password))
    await prisma.user.update({ where: { id: user.id }, data: { dongjakSessionId: sessionId } })
    return NextResponse.json({ ok: true, userName: r.userName })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '로그인 실패' }, { status: 400 })
  }
}

export async function DELETE() {
  const user = await me()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  await prisma.user.update({ where: { id: user.id }, data: { dongjakSessionId: null } })
  return NextResponse.json({ ok: true })
}
