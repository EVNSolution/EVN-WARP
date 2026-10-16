import { readLookupApiKey } from '@/lib/external-lookup/config'
import { BuildupImportError } from './client'
import { parseQuoteSnapshot, type BuildupQuoteSummary } from './quotes'

async function read(path: string): Promise<unknown> {
  const base = (process.env.BUILDUP_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
  if (!base) throw new BuildupImportError('BuildUP EV 연결이 설정되지 않았습니다.', 503)
  const response = await fetch(`${base}${path}`, { headers: { 'x-api-key': readLookupApiKey() },
    cache: 'no-store', signal: AbortSignal.timeout(45_000) })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new BuildupImportError(typeof body?.error === 'string' ? body.error : 'BuildUP EV 견적 조회에 실패했습니다. 연결 상태를 확인해 주세요.', response.status)
  }
  return response.json()
}
export async function fetchLinkedQuotes(customerId: string): Promise<{quotes:BuildupQuoteSummary[];hasMore:boolean}> {
  const data = await read(`/api/external/customers/${encodeURIComponent(customerId)}/quotes`) as { quotes:BuildupQuoteSummary[];hasMore:boolean }
  if (!Array.isArray(data?.quotes) || data.quotes.length > 100 || typeof data.hasMore !== 'boolean' ||
    data.quotes.some(q => !Number.isSafeInteger(q.id) || q.id <= 0 || typeof q.model !== 'string' || typeof q.status !== 'string'))
    throw new BuildupImportError('BuildUP EV 견적 목록 형식을 확인할 수 없습니다.')
  return data
}
export async function fetchLinkedQuote(customerId: string, quoteId: number) {
  return parseQuoteSnapshot(await read(`/api/external/customers/${encodeURIComponent(customerId)}/quotes/${quoteId}`), customerId, quoteId)
}
