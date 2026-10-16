import { createHash } from 'node:crypto'

export interface BuildupQuoteSummary {
  id: number; quoteNo: string | null; status: string; model: string; updatedAt: string
  sentAt: string | null; frozenAt: string | null
}
export interface BuildupQuoteSnapshot {
  quoteId: number; quoteNo: string | null; warpCustomerId: string; updatedAt: string; frozen: boolean
  model: string; spec: string; grossAmountWon: number; amountWon: number; version: string
  pdfBase64: string; pdfSha256: string
}
export function parseQuoteSnapshot(input: unknown, customerId: string, quoteId: number): BuildupQuoteSnapshot {
  const q = input as BuildupQuoteSnapshot
  if (!q || q.quoteId !== quoteId || q.warpCustomerId !== customerId ||
    ![q.model, q.spec].every(s => typeof s === 'string' && s.trim().length > 0 && s.length <= 500) ||
    ![q.amountWon, q.grossAmountWon].every(n => Number.isSafeInteger(n) && n >= 0) ||
    typeof q.updatedAt !== 'string' || !Number.isFinite(Date.parse(q.updatedAt)) || typeof q.frozen !== 'boolean' ||
    !(q.quoteNo === null || typeof q.quoteNo === 'string' && q.quoteNo.length <= 40) ||
    typeof q.version !== 'string' || !/^[a-f0-9]{64}$/.test(q.version) ||
    typeof q.pdfBase64 !== 'string' || q.pdfBase64.length > 28 * 1024 * 1024 ||
    typeof q.pdfSha256 !== 'string') throw new Error('BuildUP EV 견적 응답의 고객·금액·파일을 확인할 수 없습니다.')
  const pdf = Buffer.from(q.pdfBase64, 'base64')
  if (pdf.length > 20 * 1024 * 1024 || !pdf.subarray(0, 5).equals(Buffer.from('%PDF-')) ||
    createHash('sha256').update(pdf).digest('hex') !== q.pdfSha256) throw new Error('BuildUP EV 견적서 파일 검증에 실패했습니다.')
  return q
}
export function quotePreview(q: BuildupQuoteSnapshot) {
  return {quoteId:q.quoteId,quoteNo:q.quoteNo,warpCustomerId:q.warpCustomerId,updatedAt:q.updatedAt,
    frozen:q.frozen,model:q.model,spec:q.spec,grossAmountWon:q.grossAmountWon,amountWon:q.amountWon,
    version:q.version,pdfSha256:q.pdfSha256}
}
