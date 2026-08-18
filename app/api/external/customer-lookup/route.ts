import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  ExternalLookupConfigurationError,
  readLookupApiKey,
  safeKeyEqual,
} from '@/lib/external-lookup/config'
import { digitsOnly, filterByPhone, toExternalDto } from '@/lib/external-lookup/match'

/**
 * 외부 시스템(buildup-ev) 고객조회 — 서버 간 호출 전용, `x-api-key` 공유 비밀키 인증.
 *
 * 이름 **완전일치** + 전화번호 숫자 **완전일치**여야만 1건을 돌려준다.
 * 부분검색·목록 반환은 만들지 않는다 — 고객 정보가 새는 통로가 되기 때문이다.
 * (proxy.ts 의 세션 인증에서 /api/external 은 제외돼 있다 — 이 라우트가 직접 키를 검사한다)
 */
const NO_STORE = { 'Cache-Control': 'no-store' } as const

export async function GET(req: NextRequest) {
  // 키 미설정 = 기능 꺼짐(503). 키 문제를 401로 뭉개면 호출측이 키 오타와 구분 못 한다.
  let apiKey: string
  try {
    apiKey = readLookupApiKey()
  } catch (e) {
    if (e instanceof ExternalLookupConfigurationError) {
      return NextResponse.json({ error: 'lookup_not_configured' }, { status: 503, headers: NO_STORE })
    }
    throw e
  }

  const provided = req.headers.get('x-api-key') ?? ''
  if (!provided || !safeKeyEqual(apiKey, provided)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const url = new URL(req.url)
  const name = url.searchParams.get('name')?.trim() ?? ''
  const phoneDigits = digitsOnly(url.searchParams.get('phone'))
  // 유선번호(9자리)까지 허용하되, 그보다 짧으면 오입력으로 본다
  if (!name || phoneDigits.length < 9) {
    return NextResponse.json({ error: 'name_and_phone_required' }, { status: 400, headers: NO_STORE })
  }

  // SQLite 는 하이픈 제거 비교를 쿼리로 못 하므로 이름으로 좁힌 뒤 JS 에서 전화번호를 거른다.
  // B2B 는 상호(companyName)로 조회되는 경우가 많아 개인명과 상호 둘 다 완전일치로 본다.
  const candidates = await prisma.customer.findMany({
    where: { OR: [{ name }, { companyName: name }] },
    orderBy: { updatedAt: 'desc' },
  })
  const matches = filterByPhone(candidates, phoneDigits)
  // 개인정보 마스킹 — 이름은 남기지 않고 전화는 뒷 4자리만
  console.info(`[external-lookup] phone=****${phoneDigits.slice(-4)} matches=${matches.length}`)

  if (matches.length === 0) {
    return NextResponse.json({ matched: false }, { headers: NO_STORE })
  }
  // 중복 등록돼 있으면 가장 최근 수정본 1건 + 총 매칭 수(호출측 안내용)
  return NextResponse.json(
    { matched: true, matchCount: matches.length, customer: toExternalDto(matches[0]) },
    { headers: NO_STORE },
  )
}
