export type HqMailPayload = {
  to: string[]
  subject: string
  text_body: string
  html_body?: string
}

export type HqMailQueueRow = {
  id: string
  notificationId: string
  idempotencyKey: string
  payloadJson: string
  attemptCount: number
}

export type HqMailQueueStore = {
  claimDue(limit: number, includeDeferred?: boolean): Promise<HqMailQueueRow[]>
  markAccepted(id: string, operationId: string): Promise<boolean>
  markRetry(id: string, errorCode: string): Promise<boolean>
  markHeld(id: string, errorCode: string): Promise<boolean>
}

export type HqFetch = (input: string, init: {
  method: string
  headers: Record<string, string>
  body: string
  signal?: AbortSignal
}) => Promise<{ status: number; json(): Promise<unknown> }>

export type HqSubmitResult =
  | { state: 'accepted'; operationId: string }
  | { state: 'retry'; errorCode: string }
  | { state: 'held'; errorCode: string }

export type HqMailDrainSummary = {
  due: number
  accepted: number
  queued: number
  held: number
}

const DEFAULT_INTERNAL_DOMAIN = 'evnsolution.com'
const DEFAULT_TIMEOUT_MS = 2500

export function hqMailIdempotencyKey(notificationId: string): string {
  return `warp.notification.${notificationId}`
}

export function isInternalEmployeeEmail(email: string, domain = DEFAULT_INTERNAL_DOMAIN): boolean {
  const normalized = email.trim().toLowerCase()
  const suffix = `@${domain.trim().toLowerCase()}`
  return normalized.length > suffix.length && normalized.endsWith(suffix)
}

export function buildWarpNotificationMailPayload({
  recipientEmail,
  message,
  link,
}: {
  recipientEmail: string
  message: string
  link?: string | null
}): HqMailPayload {
  const safeLink = link || '/'
  return {
    to: [recipientEmail.trim().toLowerCase()],
    subject: 'WARP 출장 결재 알림',
    text_body: `${message}\n\n확인 경로: ${safeLink}`,
  }
}

export function safeHqErrorCode(value: unknown, fallback = 'hq_unavailable'): string {
  const text = String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '_')
  return (text || fallback).slice(0, 64)
}

function configured(baseUrl: string | undefined, authorization: string | undefined): boolean {
  return Boolean(baseUrl && authorization && authorization.startsWith('Bearer '))
}

async function parseJson(response: { json(): Promise<unknown> }): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

export async function submitHqMailRequest({
  baseUrl,
  authorization,
  idempotencyKey,
  payload,
  fetchImpl = fetch as HqFetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  baseUrl?: string
  authorization?: string
  idempotencyKey: string
  payload: HqMailPayload
  fetchImpl?: HqFetch
  timeoutMs?: number
}): Promise<HqSubmitResult> {
  if (!configured(baseUrl, authorization)) {
    return { state: 'retry', errorCode: 'hq_config_missing' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs))
  try {
    const response = await fetchImpl(`${baseUrl!.replace(/\/+$/, '')}/api/v1/capabilities/mail/send`, {
      method: 'POST',
      headers: {
        Authorization: authorization!,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const body = await parseJson(response)
    const bodyRecord = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const code = safeHqErrorCode(bodyRecord.code, `http_${response.status}`)

    if (
      (response.status === 200 || response.status === 202)
      && bodyRecord.ok === true
      && (bodyRecord.code === 'accepted' || bodyRecord.code === 'replayed')
      && typeof bodyRecord.operation_id === 'string'
      && bodyRecord.operation_id
    ) {
      return { state: 'accepted', operationId: bodyRecord.operation_id }
    }
    if (response.status === 409 && code === 'idempotency_conflict') {
      return { state: 'held', errorCode: code }
    }
    if (response.status === 429 || response.status >= 500) {
      return { state: 'retry', errorCode: code }
    }
    if (response.status >= 400) {
      return { state: 'held', errorCode: code }
    }
    return { state: 'retry', errorCode: code }
  } catch {
    return { state: 'retry', errorCode: 'hq_unavailable' }
  } finally {
    clearTimeout(timeout)
  }
}

export async function drainHqMailQueueStore({
  store,
  limit,
  baseUrl,
  authorization,
  fetchImpl,
  timeoutMs,
  includeDeferred = false,
}: {
  store: HqMailQueueStore
  limit: number
  baseUrl?: string
  authorization?: string
  fetchImpl?: HqFetch
  timeoutMs?: number
  includeDeferred?: boolean
}): Promise<HqMailDrainSummary> {
  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit || 1), 50))
  const rows = await store.claimDue(boundedLimit, includeDeferred)
  const summary = { due: rows.length, accepted: 0, queued: 0, held: 0 }

  for (const row of rows) {
    let payload: HqMailPayload
    try {
      payload = JSON.parse(row.payloadJson) as HqMailPayload
    } catch {
      if (await store.markHeld(row.id, 'invalid_payload_json')) summary.held += 1
      continue
    }

    const result = await submitHqMailRequest({
      baseUrl,
      authorization,
      idempotencyKey: row.idempotencyKey,
      payload,
      fetchImpl,
      timeoutMs,
    })
    if (result.state === 'accepted') {
      if (await store.markAccepted(row.id, result.operationId)) summary.accepted += 1
    } else if (result.state === 'held') {
      if (await store.markHeld(row.id, result.errorCode)) summary.held += 1
    } else {
      if (await store.markRetry(row.id, result.errorCode)) summary.queued += 1
    }
  }

  return summary
}
