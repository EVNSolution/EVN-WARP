/**
 * buildup-ev 고객 역방향 수집(#7) — 분류·변환 순수 함수.
 *
 * WARP 고객 리스트가 전체 고객의 모판이 되도록, buildup에서 생긴 고객을
 * 「신규 / 중복 의심 / 이미 연결됨」으로 갈라 승인 팝업에 보여준다.
 * 자동 병합은 하지 않는다 — 중복 판정은 사람이 최종 승인한다.
 */
import { digitsOnly } from '@/lib/external-lookup/match'

/** buildup 외부 export API 가 주는 고객 행 (buildup routes/external.ts 와 동일 계약). */
export interface BuildupCustomer {
  id: number
  name: string
  ceo_name: string | null
  email: string | null
  phone: string | null
  tel: string | null
  address: string | null
  address_detail: string | null
  reg_no: string | null
  warp_customer_id: string | null
  created_at: string
  updated_at: string
}

/** 중복 판정에 쓰는 WARP 고객 최소 필드. */
export interface WarpMatchTarget {
  id: string
  name: string
  companyName: string | null
  phone: string | null
  companyPhone: string | null
  birthInfo: string | null
  soleBusinessNo: string | null
  businessRegNo: string | null
}

export interface SuspectMatch {
  warpId: string
  warpName: string
  warpCompanyName: string | null
  reasons: string[]
}

export type ImportClass =
  | { kind: 'linked' }
  | { kind: 'new' }
  | { kind: 'suspect'; matches: SuspectMatch[] }

/** 한 buildup 고객이 WARP 후보와 겹치는 이유 목록. 비어 있으면 무관한 고객이다. */
function matchReasons(b: BuildupCustomer, w: WarpMatchTarget): string[] {
  const reasons: string[] = []

  const bPhones = [digitsOnly(b.phone), digitsOnly(b.tel)].filter(d => d.length >= 9)
  const wPhones = [digitsOnly(w.phone), digitsOnly(w.companyPhone)].filter(d => d.length >= 9)
  if (bPhones.some(d => wPhones.includes(d))) reasons.push('전화 일치')

  const bName = b.name.trim()
  if (bName && (bName === w.name.trim() || bName === (w.companyName ?? '').trim())) reasons.push('이름/상호 일치')
  // 법인 견적은 buildup name=상호, ceo_name=대표 — 대표 이름이 WARP 개인명과 겹치는 경우
  const bCeo = (b.ceo_name ?? '').trim()
  if (bCeo && bCeo === w.name.trim()) reasons.push('대표자명 일치')

  const bReg = digitsOnly(b.reg_no)
  if (bReg.length === 8 && bReg === digitsOnly(w.birthInfo)) reasons.push('생년월일 일치')
  if (bReg.length === 10 && (bReg === digitsOnly(w.soleBusinessNo) || bReg === digitsOnly(w.businessRegNo))) {
    reasons.push('사업자번호 일치')
  }
  return reasons
}

/** buildup 고객 1건 분류. 겹치는 이유가 많은 후보 순으로 최대 5건까지 보여준다. */
export function classifyCustomer(b: BuildupCustomer, warpCustomers: readonly WarpMatchTarget[]): ImportClass {
  if (b.warp_customer_id) return { kind: 'linked' }

  const matches = warpCustomers
    .map(w => ({ w, reasons: matchReasons(b, w) }))
    .filter(m => m.reasons.length > 0)
    .sort((a, x) => x.reasons.length - a.reasons.length)
    .slice(0, 5)
    .map(m => ({
      warpId: m.w.id,
      warpName: m.w.name,
      warpCompanyName: m.w.companyName,
      reasons: m.reasons,
    }))

  return matches.length ? { kind: 'suspect', matches } : { kind: 'new' }
}

/**
 * buildup 고객 → WARP 고객 생성 데이터.
 *
 * 법인 추정: ceo_name 이 있으면 buildup 폼 규칙상 name=상호였다는 뜻이라
 * WARP 에는 name=대표자·companyName=상호(B2B)로 넣는다.
 * reg_no 는 자릿수로 성격을 가른다 — 8자리 생년월일 / 10자리 사업자번호.
 * 확신할 수 없는 값은 넣지 않는다(모판에 틀린 값을 심지 않는다).
 */
export function toWarpCreateData(b: BuildupCustomer): Record<string, unknown> {
  const reg = digitsOnly(b.reg_no)
  const fullAddress = [b.address, b.address_detail].map(v => (v ?? '').trim()).filter(Boolean).join(' ') || null
  const isCorporate = Boolean((b.ceo_name ?? '').trim())

  if (isCorporate) {
    return {
      name: (b.ceo_name ?? '').trim(),
      companyName: b.name.trim(),
      customerSegment: 'B2B',
      phone: b.phone || null,
      companyPhone: b.tel || null,
      email: b.email || null,
      businessRegNo: reg.length === 10 ? b.reg_no : null,
      companyAddress: fullAddress,
      source: 'buildup',
    }
  }
  return {
    name: b.name.trim(),
    customerSegment: 'B2C',
    phone: b.phone || null,
    companyPhone: b.tel || null,
    email: b.email || null,
    birthInfo: reg.length === 8 ? b.reg_no : null,
    // 10자리인데 법인 표식(ceo_name)이 없으면 개인사업자로 본다
    isSoleProprietor: reg.length === 10 ? true : null,
    soleBusinessNo: reg.length === 10 ? b.reg_no : null,
    addressDetail: fullAddress,
    source: 'buildup',
  }
}
