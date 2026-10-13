import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { weeklyDigest } from '@/lib/weekly-digest'

/** 주간회의 브리핑 강제 재생성 — 회의 중 「새로고침」 버튼이 호출한다. */
export async function POST() {
  const session = await auth()
  if (!(session?.user as any)?.id) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const digest = await weeklyDigest(true)
  return NextResponse.json({ ok: true, generatedAt: digest.generatedAt })
}
