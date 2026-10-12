import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { DongjakAuthError, roomStatus } from '@/lib/mcp/dongjak'

/**
 * 회의실 현황 조회 — 업무공간 「회의실」 탭이 쓴다.
 * 내 계정에 연결된 회의실 세션(dongjakSessionId)으로 그 사람 권한으로 조회한다.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const date = new URL(req.url).searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: '날짜(date=YYYY-MM-DD)가 필요합니다.' }, { status: 400 })
  }

  const row = await prisma.user.findUnique({ where: { id: me.id }, select: { dongjakSessionId: true } })
  if (!row?.dongjakSessionId) return NextResponse.json({ connected: false })

  try {
    const day = await roomStatus(row.dongjakSessionId, date)
    return NextResponse.json({ connected: true, ...day })
  } catch (e) {
    if (e instanceof DongjakAuthError) return NextResponse.json({ connected: false })
    return NextResponse.json({ error: e instanceof Error ? e.message : '조회 실패' }, { status: 502 })
  }
}
