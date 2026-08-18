/**
 * buildup-ev 외부 API 클라이언트 — 서버 전용 (#7).
 *
 * 인증: WARP 조회에 쓰는 것과 **같은 공유키**(WARP_LOOKUP_API_KEY)를 x-api-key 로 보낸다.
 * 자동 기입(부가 기능)과 달리 이쪽은 관리자가 버튼으로 부르는 흐름이라
 * 실패를 삼키지 않고 던진다 — 화면에서 원인을 봐야 고칠 수 있다.
 */
import { readLookupApiKey } from '@/lib/external-lookup/config'
import type { BuildupCustomer } from './classify'

const TIMEOUT_MS = 10_000

export class BuildupImportError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = 'BuildupImportError'
  }
}

export function isBuildupConfigured(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return Boolean((env.BUILDUP_API_BASE_URL ?? '').trim() && (env.WARP_LOOKUP_API_KEY ?? '').trim())
}

function baseUrl(): string {
  const base = (process.env.BUILDUP_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
  if (!base) throw new BuildupImportError('BUILDUP_API_BASE_URL 이 설정되지 않았습니다')
  return base
}

async function call(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'x-api-key': readLookupApiKey(),
      'Accept': 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
  if (!res.ok) {
    // 응답 본문에 자격증명은 없다 — 상태·요약만 화면에 전달
    const text = await res.text().catch(() => '')
    throw new BuildupImportError(`buildup ${path} 실패 (${res.status}): ${text.slice(0, 200)}`, res.status)
  }
  return res.json()
}

/** buildup 고객 목록 export (최대 500건/회 — has_more 면 이어 받는다). */
export async function fetchBuildupCustomers(): Promise<BuildupCustomer[]> {
  const all: BuildupCustomer[] = []
  let since: string | undefined
  // 무한루프 방지 상한 — 500건×20회면 당분간 충분하고, 넘으면 설계를 다시 본다
  for (let page = 0; page < 20; page++) {
    const q = since ? `?since=${encodeURIComponent(since)}` : ''
    const body = await call(`/api/external/customers${q}`) as { data: BuildupCustomer[]; has_more: boolean }
    all.push(...body.data)
    if (!body.has_more || body.data.length === 0) break
    since = body.data[body.data.length - 1].updated_at
  }
  return all
}

/** buildup이 렌더·보관하는 문서를 받아온다 — 없으면(404) null. (#27 딜 서류함 첨부용) */
export interface BuildupDocument {
  buffer: Buffer
  contentType: string
  filename: string
}

export async function fetchQuoteDocument(
  quoteId: number,
  kind: 'quote-pdf' | 'contract-pdf',
): Promise<BuildupDocument | null> {
  const res = await fetch(`${baseUrl()}/api/external/quotes/${quoteId}/${kind}`, {
    headers: { 'x-api-key': readLookupApiKey() },
    signal: AbortSignal.timeout(30_000), // 즉석 렌더(puppeteer)가 있어 여유를 둔다
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new BuildupImportError(`buildup 문서 수신 실패 (${res.status})`, res.status)
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
  const disposition = res.headers.get('content-disposition') ?? ''
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1]
    ?? `${kind === 'quote-pdf' ? 'quote' : 'contract'}_${quoteId}.pdf`
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType, filename }
}

/** WARP 승인 후 연결 write-back — buildup customer.warp_customer_id 에 기록. */
export async function linkBuildupCustomers(links: ReadonlyArray<{ id: number; warp_customer_id: string }>): Promise<number> {
  if (links.length === 0) return 0
  const body = await call('/api/external/customers/link', {
    method: 'POST',
    body: JSON.stringify({ links }),
  }) as { data: { updated: number } }
  return body.data.updated
}
