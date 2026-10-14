import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { weeklyDigest } from '@/lib/weekly-digest'

/**
 * 주간회의 브리핑 새로고침 — 「새로고침」 버튼이 호출한다.
 * 재생성 주기(업무시간 1시간 / 그 외 3시간)가 지났을 때만 새로 만들고,
 * 주기 안이면 기존 요약을 그대로 돌려준다 (AI 재호출 없음 — 비용 보호).
 */
export async function POST() {
  const session = await auth()
  if (!(session?.user as any)?.id) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const digest = await weeklyDigest(true) // 주기가 지났으면 새 결과를 기다려서 돌려준다
  return NextResponse.json({ ok: true, generatedAt: digest.generatedAt })
}
