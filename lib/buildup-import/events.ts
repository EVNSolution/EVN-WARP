/**
 * buildup 딜 이벤트 (#27) — 파싱·요약 순수 함수.
 * buildup services/warp-crm.ts 의 pushWarpDealEvent payload 와 동일 계약.
 */

export const DEAL_EVENT_TYPES = ['quote_created', 'quote_updated', 'contract_completed'] as const
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
  if (type === 'quote_created') return '견적서 작성'
  if (type === 'quote_updated') return '견적서 수정'
  return '계약 체결'
}

/**
 * 딜 서류함에 저장할 표시용 파일명 — 「연월일(6자리)_고객이름_서류명[_v버전].확장자」.
 * 예: 250818_박신규_견적서.pdf → 수정본 250819_박신규_견적서_v2.pdf
 * buildup 원본 파일명은 건드리지 않는다 — WARP 에 받아올 때만 바꾼다.
 */
export function buildAttachmentFileName(input: {
  /** 첨부 시각 (KST 기준 날짜로 변환된다) */
  date: Date
  customerName: string | null | undefined
  /** 서류 슬롯 이름 — '견적서' | '특장계약서' */
  label: string
  /** 같은 딜·같은 슬롯의 몇 번째 파일인가 (1부터) — 2 이상이면 _v 를 붙인다 */
  version: number
  /** '.pdf' 처럼 점 포함 확장자 */
  ext: string
}): string {
  // sv-SE 로케일은 YYYY-MM-DD — KST 로 변환 후 YYMMDD 6자리만 취한다
  const ymd = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' })
    .format(input.date).slice(2).replace(/-/g, '')
  // 파일명에 못 쓰는 문자·공백 제거 (경로 조작 방지 겸)
  const name = (input.customerName ?? '').replace(/[\\/:*?"<>|\s]/g, '').trim() || '고객미상'
  const version = input.version > 1 ? `_v${input.version}` : ''
  return `${ymd}_${name}_${input.label}${version}${input.ext}`
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
