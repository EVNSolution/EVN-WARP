/**
 * buildup 딜 이벤트 (#27) — 파싱·요약 순수 함수.
 * buildup services/warp-crm.ts 의 pushWarpDealEvent payload 와 동일 계약.
 */

export const DEAL_EVENT_TYPES = ['quote_created', 'contract_completed'] as const
export type DealEventType = (typeof DEAL_EVENT_TYPES)[number]

export interface DealEventPayload {
  event_key: string
  type: DealEventType
  occurred_at: string
  quote: {
    id: number
    quote_no: string | null
    status: string
    model_code: string
    supply_price: number
    final_price: number
  }
  customer: {
    id: number
    name: string
    phone: string | null
    warp_customer_id: string | null
  } | null
}

/** 외부 입력 검증 — 계약에 안 맞으면 null (400 처리용). 초과 필드는 버린다. */
export function parseDealEvent(body: unknown): DealEventPayload | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  const type = b.type
  if (typeof type !== 'string' || !DEAL_EVENT_TYPES.includes(type as DealEventType)) return null
  if (typeof b.event_key !== 'string' || !b.event_key || b.event_key.length > 80) return null

  const q = b.quote as Record<string, unknown> | undefined
  if (typeof q !== 'object' || q === null || !Number.isInteger(q.id)) return null

  const rawCustomer = b.customer as Record<string, unknown> | null | undefined
  const customer = (typeof rawCustomer === 'object' && rawCustomer !== null && Number.isInteger(rawCustomer.id))
    ? {
      id: rawCustomer.id as number,
      name: typeof rawCustomer.name === 'string' ? rawCustomer.name : '',
      phone: typeof rawCustomer.phone === 'string' ? rawCustomer.phone : null,
      warp_customer_id: typeof rawCustomer.warp_customer_id === 'string' ? rawCustomer.warp_customer_id : null,
    }
    : null

  return {
    event_key: b.event_key,
    type: type as DealEventType,
    occurred_at: typeof b.occurred_at === 'string' ? b.occurred_at : new Date().toISOString(),
    quote: {
      id: q.id as number,
      quote_no: typeof q.quote_no === 'string' ? q.quote_no : null,
      status: typeof q.status === 'string' ? q.status : '',
      model_code: typeof q.model_code === 'string' ? q.model_code : '',
      supply_price: typeof q.supply_price === 'number' ? q.supply_price : 0,
      final_price: typeof q.final_price === 'number' ? q.final_price : 0,
    },
    customer,
  }
}

export function eventTypeLabel(type: DealEventType): string {
  return type === 'quote_created' ? '견적서 작성' : '계약 체결'
}

/** 수신함 목록에 보여줄 한 줄 요약. */
export function eventSummary(p: DealEventPayload): string {
  const won = p.quote.final_price > 0 ? `${p.quote.final_price.toLocaleString('ko-KR')}원` : null
  return [
    p.customer?.name || '고객 미상',
    p.quote.model_code,
    won,
    p.quote.quote_no ? `견적번호 ${p.quote.quote_no}` : `견적 #${p.quote.id}`,
  ].filter(Boolean).join(' · ')
}
