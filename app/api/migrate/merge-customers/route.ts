import { NextResponse } from 'next/server'

// Compatibility baseline: legacy merges must fail before any write, including after rollback.
export async function POST() {
  return NextResponse.json({ error: '기존 고객 통합 기능은 중단되었습니다. 새 중복 고객 확인 기능에서 미리보기 후 진행해 주세요.' }, { status: 409 })
}
