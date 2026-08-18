import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  ExternalLookupConfigurationError,
  readLookupApiKey,
  safeKeyEqual,
} from '@/lib/external-lookup/config'
import { parseDealEvent } from '@/lib/buildup-import/events'

/**
 * buildup 딜 이벤트 수신 (#27) — 서버 간 호출 전용, x-api-key 공유키 인증.
 *
 * 수신함(BuildupEvent)에 쌓기만 한다 — 딜 자동 기입·자동 생성은 하지 않는다.
 * 담당자가 고객관리/파이프라인 화면의 배지를 보고 들어와 확인 후 직접 기입한다.
 * 멱등: eventKey 재전송은 payload 만 갱신되고 확인 상태는 유지된다.
 */
const NO_STORE = { 'Cache-Control': 'no-store' } as const

export async function POST(req: NextRequest) {
  let apiKey: string
  try {
    apiKey = readLookupApiKey()
  } catch (e) {
    if (e instanceof ExternalLookupConfigurationError) {
      return NextResponse.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE })
    }
    throw e
  }
  const provided = req.headers.get('x-api-key') ?? ''
  if (!provided || !safeKeyEqual(apiKey, provided)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const payload = parseDealEvent(await req.json().catch(() => null))
  if (!payload) {
    return NextResponse.json({ error: 'bad_payload' }, { status: 400, headers: NO_STORE })
  }

  const fields = {
    type: payload.type,
    buildupQuoteId: payload.quote.id,
    quoteNo: payload.quote.quote_no,
    customerName: payload.customer?.name ?? null,
    warpCustomerId: payload.customer?.warp_customer_id ?? null,
    payloadJson: JSON.stringify(payload),
  }
  const saved = await prisma.buildupEvent.upsert({
    where: { eventKey: payload.event_key },
    // 같은 키 재수신 = 내용이 바뀌었다는 뜻(buildup 은 액션당 1회만 보낸다).
    // 이미 「확인 완료」였어도 **대기로 되돌려** 재확인을 요구한다 — 그래야
    // 견적 수정·재계약이 조용히 묻히지 않는다.
    update: { ...fields, status: 'pending', confirmedBy: null, confirmedAt: null },
    create: { eventKey: payload.event_key, ...fields },
  })
  console.info(`[deal-events] ${payload.type} quote=${payload.quote.id} → ${saved.status}`)
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
