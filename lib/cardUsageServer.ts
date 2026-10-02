import { prisma } from '@/lib/db'
import { CARD_USAGE_CATEGORIES, PAY_METHODS, RECEIPT_PAY_METHODS, CARD_RECEIPT_PREFIX } from '@/lib/cardUsage'

export type CardUsageInput = {
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
  receiptUrl:      string | null
  activityId:      string | null
}

function last4(num: string) {
  const digits = num.replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : digits
}

// 요청 본문 검증 + 카드 표시명 스냅샷 생성. 개인카드는 본인 소유만 허용.
export async function parseCardUsageInput(body: any, ownerUserId: string | null): Promise<CardUsageInput | string> {
  const date      = String(body?.date ?? '')
  const payMethod = String(body?.payMethod ?? '')
  const merchant  = String(body?.merchant ?? '').trim()
  const category  = String(body?.category ?? '')
  const amount    = Number(body?.amount)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '일자가 올바르지 않습니다.'
  if (!(PAY_METHODS as readonly string[]).includes(payMethod)) return '사용카드를 선택해주세요.'
  if (!merchant) return '사용처를 입력해주세요.'
  if (!(CARD_USAGE_CATEGORIES as readonly string[]).includes(category)) return '해당업무를 선택해주세요.'
  if (!Number.isFinite(amount) || amount <= 0) return '금액을 입력해주세요.'

  let corporateCardId: string | null = null
  let personalCardId:  string | null = null
  let cardLabel:       string | null = null

  if (payMethod === '법인카드') {
    const card = await prisma.corporateCard.findUnique({ where: { id: String(body?.corporateCardId ?? '') } })
    if (!card) return '법인카드를 선택해주세요.'
    corporateCardId = card.id
    cardLabel = `법인 ${card.holderName} ••••${last4(card.cardNumber)}`
  } else if (payMethod === '개인카드') {
    const card = await prisma.personalCard.findUnique({ where: { id: String(body?.personalCardId ?? '') } })
    if (!card || (ownerUserId && card.userId !== ownerUserId)) return '개인카드를 선택해주세요.'
    personalCardId = card.id
    cardLabel = `개인 ${card.alias}${card.last4 ? ` ••••${card.last4}` : ''}`
  } else {
    cardLabel = '현금'
  }

  const attendees   = String(body?.attendees ?? '').trim() || null
  const description = String(body?.description ?? '').trim() || null
  const activityId  = body?.activityId ? String(body.activityId) : null
  // 영수증은 개인카드·현금만, 업로드 API가 만든 경로만 허용
  const receiptUrl  = RECEIPT_PAY_METHODS.has(payMethod)
    ? String(body?.receiptUrl ?? '').split('|').map(s => s.trim())
        .filter(u => u.startsWith(CARD_RECEIPT_PREFIX) && !u.includes('..')).join('|') || null
    : null

  return {
    date, payMethod, corporateCardId, personalCardId, cardLabel,
    merchant, attendees, category, description, amount: Math.round(amount), receiptUrl, activityId,
  }
}

// 활동 제목을 붙여서 반환
export async function withActivityTitles<T extends { activityId: string | null }>(rows: T[]) {
  const ids = [...new Set(rows.map(r => r.activityId).filter((v): v is string => !!v))]
  if (ids.length === 0) return rows.map(r => ({ ...r, activityTitle: null as string | null }))
  const acts = await prisma.workActivity.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } })
  const map = new Map(acts.map(a => [a.id, a.title]))
  return rows.map(r => ({ ...r, activityTitle: r.activityId ? map.get(r.activityId) ?? null : null }))
}
