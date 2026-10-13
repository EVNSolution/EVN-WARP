import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import {
  cancelReservation, DongjakAuthError, DongjakProfileError, reserveRoom, roomStatus,
  type DongjakProfile,
} from '@/lib/mcp/dongjak'

/**
 * 회의실 현황 조회·예약·취소 — 업무공간 「회의실」 탭이 쓴다.
 * 내 계정에 연결된 회의실 세션(dongjakSessionId)으로 그 사람 권한으로 동작한다.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function mySession(): Promise<{ userId: string; sessionId: string; profile: DongjakProfile | null } | null> {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return null
  const row = await prisma.user.findUnique({
    where: { id: me.id },
    select: { dongjakSessionId: true, dongjakProfile: true },
  })
  if (!row?.dongjakSessionId) return null
  let profile: DongjakProfile | null = null
  try { profile = row.dongjakProfile ? JSON.parse(row.dongjakProfile) : null } catch { profile = null }
  return { userId: me.id, sessionId: row.dongjakSessionId, profile }
}
export async function GET(req: NextRequest) {
  const date = new URL(req.url).searchParams.get('date')
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: '날짜(date=YYYY-MM-DD)가 필요합니다.' }, { status: 400 })
  }

  const mine = await mySession()
  if (!mine) return NextResponse.json({ connected: false })

  try {
    const day = await roomStatus(mine.sessionId, date)
    // 예약 서버는 예약자 이름만 주므로, WARP 구성원 명단과 대조해 「우리 회사」 예약을 표시한다.
    // "장원철 외 3명" 같은 표기도 잡히게 이름으로 시작하는지도 본다.
    const members = (await prisma.user.findMany({ select: { name: true } }))
      .map(m => m.name)
      .filter(n => n && n.length >= 2)
    const reservations = day.reservations.map(r => ({
      ...r,
      company: !r.mine && !!r.userName && members.some(n => r.userName === n || r.userName!.startsWith(n)),
    }))
    return NextResponse.json({ connected: true, ...day, reservations })
  } catch (e) {
    if (e instanceof DongjakAuthError) return NextResponse.json({ connected: false })
    return NextResponse.json({ error: e instanceof Error ? e.message : '조회 실패' }, { status: 502 })
  }
}

/** 예약 — 탭의 「빈 시간 클릭 → 예약」 UI 가 쓴다. */
export async function POST(req: NextRequest) {
  const mine = await mySession()
  if (!mine) return NextResponse.json({ error: '회의실 예약 계정이 연결되어 있지 않습니다 — 내 계정 → AI 연결에서 연결해 주세요.' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 }) }
  const startHour = Number(body?.startHour)
  const endHour = Number(body?.endHour)
  const userName = String(body?.userName ?? '').trim()
  if (
    !body?.roomId || typeof body.date !== 'string' || !DATE_RE.test(body.date)
    || !Number.isInteger(startHour) || !Number.isInteger(endHour)
    || startHour < 0 || endHour > 24 || endHour <= startHour
  ) return NextResponse.json({ error: '방·날짜·시간을 확인해 주세요.' }, { status: 400 })
  if (!userName) return NextResponse.json({ error: '예약자(사용자) 이름을 입력해 주세요.' }, { status: 400 })

  // 예약 창에서 기본정보 5종을 함께 보낸 경우(최초 1회) — 저장 후 이번 예약부터 사용
  let profile = mine.profile
  const p = body?.profile
  if (p && typeof p === 'object') {
    const candidate: DongjakProfile = {
      companyName: String(p.companyName ?? '').trim(),
      businessNumber: String(p.businessNumber ?? '').trim(),
      phone: String(p.phone ?? '').trim(),
      email: String(p.email ?? '').trim(),
      roomNumber: String(p.roomNumber ?? '').trim(),
    }
    if (Object.values(candidate).every(v => v)) {
      await prisma.user.update({ where: { id: mine.userId }, data: { dongjakProfile: JSON.stringify(candidate) } })
      profile = candidate
    }
  }

  try {
    const message = await reserveRoom(mine.sessionId, {
      roomId: String(body.roomId), date: body.date, startHour, endHour,
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined,
      userName,
    }, profile)
    return NextResponse.json({ ok: true, message })
  } catch (e) {
    if (e instanceof DongjakAuthError) {
      return NextResponse.json({ error: '회의실 로그인이 만료되었습니다 — 내 계정 → AI 연결에서 다시 연결해 주세요.' }, { status: 401 })
    }
    if (e instanceof DongjakProfileError) {
      // 창이 이 코드를 받으면 기본정보 입력란을 열어 바로 받는다
      return NextResponse.json({
        code: 'profile_required',
        error: '처음 한 번 예약 기본정보(회사명·사업자등록번호·연락처·이메일·호실) 입력이 필요합니다.',
      }, { status: 400 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : '예약에 실패했습니다.' }, { status: 502 })
  }
}

/** 취소 — 타임라인에서 내 예약 블록 클릭 시. 본인 세션 권한이라 본인 예약만 취소된다. */
export async function DELETE(req: NextRequest) {
  const mine = await mySession()
  if (!mine) return NextResponse.json({ error: '회의실 예약 계정이 연결되어 있지 않습니다.' }, { status: 401 })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const roomId = url.searchParams.get('roomId')
  if (!id || !roomId) return NextResponse.json({ error: '취소할 예약 정보가 없습니다.' }, { status: 400 })

  try {
    const message = await cancelReservation(mine.sessionId, id, roomId)
    return NextResponse.json({ ok: true, message })
  } catch (e) {
    if (e instanceof DongjakAuthError) {
      return NextResponse.json({ error: '회의실 로그인이 만료되었습니다 — 내 계정 → AI 연결에서 다시 연결해 주세요.' }, { status: 401 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : '취소에 실패했습니다.' }, { status: 502 })
  }
}
