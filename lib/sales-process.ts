import { ALL_PROCESS_CODES } from './pipeline'

export interface SalesProcessData {
  inquiryStatus: '신규 문의' | '상담 대기' | '부재중 대기'
  callbackAt: string
  finalQuote: { date: string; model: string; spec: string; amountWon: number | null; documentId: string }
  deposit: {
    status: 'unpaid' | 'paid' | 'refunded' | 'cancelled'
    amountWon: number | null; date: string; time: string; model: string; spec: string
    documentId: string; reviewPending: boolean
  }
}
export const PROCESS_GATES: Record<string, string[]> = {
  '1-1': ['1-1-call'], '1-2': ['1-2-2', '1-2-4'], '1-3': ['1-3-confirmed'],
}
export const GATE_LABELS: Record<string, string> = {
  '1-1-call': '전화통화 완료', '1-2-2': '구매의사 확인',
  '1-2-4': '1차 견적서 발송 완료', '1-3-confirmed': '최종 견적서 확정',
}
export function emptySalesProcess(): SalesProcessData {
  return { inquiryStatus: '신규 문의', callbackAt: '',
    finalQuote: { date: '', model: '', spec: '', amountWon: null, documentId: '' },
    deposit: { status: 'unpaid', amountWon: null, date: '', time: '', model: '', spec: '', documentId: '', reviewPending: false } }
}
export function readSalesProcess(json: string | null | undefined): SalesProcessData {
  const blank = emptySalesProcess()
  if (!json) return blank
  try { const p = JSON.parse(json); return { ...blank, ...p, finalQuote: { ...blank.finalQuote, ...p.finalQuote }, deposit: { ...blank.deposit, ...p.deposit } } }
  catch { return blank }
}
export function validDate(value: string): boolean {
  const date = new Date(value + 'T00:00:00Z')
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function koreaToday(): string { return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10) }
export function quoteError(p: SalesProcessData): string | null {
  const q = p.finalQuote
  if (!q.date || !validDate(q.date) || q.date > koreaToday()) return '실제 최종 견적 확정일을 입력해 주세요.'
  if (!q.model.trim() || !q.spec.trim() || !Number.isSafeInteger(q.amountWon) || q.amountWon! <= 0 || !q.documentId)
    return '최종 견적의 모델·주요 사양·최종 금액(원)과 견적 자료를 확인해 주세요.'
  return null
}
export function depositError(p: SalesProcessData): string | null {
  const d = p.deposit
  if (d.status !== 'paid') return '판매신청의 첫 업무인 EV& 계약금 입금을 확인해 주세요.'
  if (d.amountWon !== 100000) return '계약금이 10만원과 다릅니다. 실제 금액을 보존하고 개별 확인해 주세요.'
  if (!d.date || !validDate(d.date) || d.date > koreaToday()) return '실제 입금일 확인 필요 — 확인 전에는 순번을 부여하지 않습니다.'
  if (!d.model.trim() || !d.spec.trim() || !d.documentId) return '계약금의 모델·주요 사양과 송금 증빙을 확인해 주세요.'
  if (d.reviewPending) return '입금일·사양 변경에 따른 순번 검토가 필요합니다.'
  return null
}
export function isGateComplete(value: unknown): boolean {
  if (value === true) return true
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  const time=Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString()===value && time<=Date.now()
}
export function transitionError(segment: string | null, from: string, to: string,
  checks: Record<string, unknown>, process: SalesProcessData): string | null {
  if (segment === 'B2B' || from === to) return null
  const start = ALL_PROCESS_CODES.indexOf(from), end = ALL_PROCESS_CODES.indexOf(to)
  if (end < 0) return '유효한 영업 단계를 선택해 주세요.'
  if (end <= start) return null
  for (let i = Math.max(start, 0); i < end; i++) {
    const code = ALL_PROCESS_CODES[i]
    const missing = (PROCESS_GATES[code] ?? []).filter(k => !isGateComplete(checks[k]))
    if (missing.length) return `다음 단계 이동 전 ${missing.map(k => GATE_LABELS[k]).join(' + ')} 확인이 필요합니다.`
    if (code === '1-3') { const error = quoteError(process); if (error) return error }
    if (code === '2-1') { const error = depositError(process); if (error) return error }
  }
  return null
}
export interface QueueDeal {
  id: string; stageCode: string | null; salesStatus: string | null; deliveredAt?: Date | null
  salesProcessJson: string | null; customerSegment: string | null
  customer?: { customerSegment: string | null } | null
}
export type QueueResult = { position: number | null; message: string }
const normalize = (s: string) => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
export function depositQueue(deals: QueueDeal[]): Map<string, QueueResult> {
  const result = new Map<string, QueueResult>()
  const groups = new Map<string, { id: string; date: string; time: string }[]>()
  for (const deal of deals) {
    const p = readSalesProcess(deal.salesProcessJson), d = p.deposit
    let error = depositError(p)
    if ((deal.customer?.customerSegment ?? deal.customerSegment) === 'B2B') error = 'B2B는 기존 절차를 사용합니다.'
    else if (['이탈','완료','판매보류','고객전환'].includes(deal.salesStatus ?? '') || deal.deliveredAt ||
      !['2-1','2-2','2-3','3-1','3-2','3-3'].includes(deal.stageCode ?? '')) error = '출고 대기 대상이 아닙니다.'
    if (error) { result.set(deal.id, { position: null, message: error }); continue }
    const group = JSON.stringify([normalize(d.model), normalize(d.spec)])
    groups.set(group, [...(groups.get(group) ?? []), { id: deal.id, date: d.date, time: d.time }])
  }
  for (const group of groups.values()) {
    group.sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    for (const [index, entry] of group.entries()) {
      const sameDay = group.filter(d => d.date === entry.date)
      const ambiguous = sameDay.length > 1 && (sameDay.some(d => !d.time) || sameDay.filter(d => d.time === entry.time).length > 1)
      result.set(entry.id, ambiguous ? { position: null, message: '같은 날 입금한 건의 입금시각·순서 확인 필요' } :
        { position: index + 1, message: `같은 모델·주요 사양 내 ${index + 1}순위 (실제 출고 일정과 별도)` })
    }
  }
  return result
}
