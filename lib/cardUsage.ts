// 카드/현금 사용내역 공통 상수·타입 (클라이언트/서버 공용)

export const CARD_USAGE_CATEGORIES = [
  '교통비', '숙박비', '통신비', '수수료', '접대비', '마케팅비', '식대', '기타',
] as const

export const PAY_METHODS = ['법인카드', '개인카드', '현금'] as const

export type CardUsageCategory = typeof CARD_USAGE_CATEGORIES[number]
export type PayMethod = typeof PAY_METHODS[number]

export type CardUsage = {
  id:              string
  date:            string
  payMethod:       string
  corporateCardId: string | null
  personalCardId:  string | null
  cardLabel:       string | null
  merchant:        string
  attendees:       string | null
  category:        string
  description:     string | null
  amount:          number
  activityId:      string | null
  activityTitle?:  string | null
  userId:          string | null
  userName:        string | null
  status:          string
  approverName:    string | null
  approverNote:    string | null
  approvedAt:      string | null
  createdAt:       string
}

// 입력 폼 값 (id 없으면 신규)
export type CardUsageDraft = {
  id?:             string
  date:            string
  payMethod:       PayMethod
  corporateCardId: string
  personalCardId:  string
  merchant:        string
  attendees:       string
  category:        CardUsageCategory
  description:     string
  amount:          string
}

export function emptyDraft(date: string): CardUsageDraft {
  return {
    date, payMethod: '법인카드', corporateCardId: '', personalCardId: '',
    merchant: '', attendees: '', category: '식대', description: '', amount: '',
  }
}

export function draftFromUsage(u: CardUsage): CardUsageDraft {
  return {
    id:              u.id,
    date:            u.date,
    payMethod:       (PAY_METHODS as readonly string[]).includes(u.payMethod) ? u.payMethod as PayMethod : '법인카드',
    corporateCardId: u.corporateCardId ?? '',
    personalCardId:  u.personalCardId ?? '',
    merchant:        u.merchant,
    attendees:       u.attendees ?? '',
    category:        (CARD_USAGE_CATEGORIES as readonly string[]).includes(u.category) ? u.category as CardUsageCategory : '기타',
    description:     u.description ?? '',
    amount:          String(u.amount),
  }
}

// 저장 전 검증 — 오류 메시지 또는 null
export function validateDraft(d: CardUsageDraft): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return '일자를 입력해주세요.'
  if (d.payMethod === '법인카드' && !d.corporateCardId) return '법인카드를 선택해주세요.'
  if (d.payMethod === '개인카드' && !d.personalCardId) return '개인카드를 선택하거나 추가해주세요.'
  if (!d.merchant.trim()) return '사용처를 입력해주세요.'
  if (!(Number(d.amount) > 0)) return '금액을 입력해주세요.'
  return null
}

export const STATUS_STYLE: Record<string, string> = {
  '신청': 'bg-amber-100 text-amber-700',
  '승인': 'bg-green-100 text-green-700',
  '반려': 'bg-red-100 text-red-600',
}
