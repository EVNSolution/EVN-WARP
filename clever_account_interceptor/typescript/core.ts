export const CORRELATION_ID_HEADER = 'X-Correlation-ID'
export const ACCOUNT_SUBJECT_HEADER = 'X-Clever-Account-Subject'
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key'
export const CONTRACT_VERSION = '1.0'

const AUTHORITY_PATTERN = /^[a-z0-9](?:[a-z0-9._:-]{0,79})$/
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/

export class InterceptorError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'InterceptorError'
    this.code = code
  }
}

export type AccountContext = Readonly<{
  authority: string
  subject: string
  correlationId: string
}>

export type SafeAccountEvidence = Readonly<{
  authority: string
  subject: string
  correlation_id: string
}>

export function newCorrelationId(): string {
  return crypto.randomUUID().replaceAll('-', '')
}

function normalizeAuthority(value?: string | null): string {
  const authority = (value ?? '').trim().toLocaleLowerCase('en-US')
  if (authority && !AUTHORITY_PATTERN.test(authority)) {
    throw new InterceptorError('invalid_account_authority')
  }
  return authority
}

function normalizeSubject(value: string | null | undefined, required: boolean): string {
  const subject = (value ?? '').trim()
  if (!subject) {
    if (required) throw new InterceptorError('account_context_required')
    return ''
  }
  if (subject.length > 512 || [...subject].some(character => character.codePointAt(0)! < 32)) {
    throw new InterceptorError('invalid_account_subject')
  }
  return subject
}

function normalizeCorrelationId(value?: string | null): string {
  const correlationId = (value ?? '').trim() || newCorrelationId()
  if (!CORRELATION_ID_PATTERN.test(correlationId)) {
    throw new InterceptorError('invalid_correlation_id')
  }
  return correlationId
}

export function buildAccountContext(input: {
  authority?: string | null
  subject?: string | null
  correlationId?: string | null
}): AccountContext {
  const authority = normalizeAuthority(input.authority)
  const subject = normalizeSubject(input.subject, Boolean(authority))
  if (subject && !authority) throw new InterceptorError('account_context_denied')
  return Object.freeze({
    authority,
    subject,
    correlationId: normalizeCorrelationId(input.correlationId),
  })
}

export function interceptHeaders(headers: Headers, authority?: string | null): AccountContext {
  if (authority == null) {
    return buildAccountContext({ correlationId: headers.get(CORRELATION_ID_HEADER) })
  }
  return buildAccountContext({
    authority,
    subject: headers.get(ACCOUNT_SUBJECT_HEADER),
    correlationId: headers.get(CORRELATION_ID_HEADER),
  })
}

export function validateIdempotencyKey(value?: string | null): string {
  const key = (value ?? '').trim()
  if (!key || key.length > 200 || /\s/u.test(key)) {
    throw new InterceptorError('invalid_idempotency_key')
  }
  return key
}

export function outboundHeaders(context: AccountContext, idempotencyKey?: string | null): Readonly<Record<string, string>> {
  const headers: Record<string, string> = { [CORRELATION_ID_HEADER]: context.correlationId }
  if (context.authority) headers[ACCOUNT_SUBJECT_HEADER] = context.subject
  if (idempotencyKey != null) headers[IDEMPOTENCY_KEY_HEADER] = validateIdempotencyKey(idempotencyKey)
  return Object.freeze(headers)
}

export function safeEvidence(context: AccountContext): SafeAccountEvidence {
  return Object.freeze({
    authority: context.authority,
    subject: context.subject,
    correlation_id: context.correlationId,
  })
}
