import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { verifySkillsToken } from '@/lib/mcp/skills'

/**
 * 사내 스킬(EVn_Skills) 개인 GitHub 토큰 관리 — 내 계정 화면에서 쓴다.
 * 저장 전에 실제로 저장소가 읽히는지 검증한다. 토큰 값은 조회 API 로 되돌려주지 않는다.
 */

async function me() {
  const session = await auth()
  const u = session?.user as any
  return u?.id ? { id: u.id as string } : null
}

export async function GET() {
  const user = await me()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { skillsGithubToken: true } })
  return NextResponse.json({ registered: !!row?.skillsGithubToken })
}

export async function POST(req: NextRequest) {
  const user = await me()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const { token } = await req.json().catch(() => ({}))
  const value = typeof token === 'string' ? token.trim() : ''
  if (!value || value.length > 200) return NextResponse.json({ error: '토큰을 입력해 주세요.' }, { status: 400 })
  if (!(await verifySkillsToken(value))) {
    return NextResponse.json({ error: '이 토큰으로 EVn_Skills 저장소를 읽을 수 없습니다 — 대상 저장소와 Contents 읽기 권한을 확인해 주세요.' }, { status: 400 })
  }
  await prisma.user.update({ where: { id: user.id }, data: { skillsGithubToken: value } })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const user = await me()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  await prisma.user.update({ where: { id: user.id }, data: { skillsGithubToken: null } })
  return NextResponse.json({ ok: true })
}
