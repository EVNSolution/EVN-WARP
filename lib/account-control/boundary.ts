import {
  ACCOUNT_SUBJECT_HEADER,
  CORRELATION_ID_HEADER,
  type AccountContext,
  InterceptorError,
  buildAccountContext,
  interceptHeaders,
} from '@/clever_account_interceptor/typescript'

import { WARP_ACCOUNT_AUTHORITY } from './config'

export class AccountBoundaryError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number) {
    super(code)
    this.name = 'AccountBoundaryError'
    this.code = code
    this.status = status
  }
}

function asBoundaryError(error: unknown): AccountBoundaryError {
  if (error instanceof AccountBoundaryError) return error
  if (error instanceof InterceptorError) {
    const status = error.code === 'account_context_denied' ? 403 : 422
    return new AccountBoundaryError(error.code, status)
  }
  return new AccountBoundaryError('account_context_denied', 403)
}

export function buildForwardedAccountHeaders(
  requestHeaders: Headers,
  authenticatedSubject: string,
): { context: AccountContext; headers: Headers } {
  try {
    const context = buildAccountContext({
      authority: WARP_ACCOUNT_AUTHORITY,
      subject: authenticatedSubject,
      correlationId: requestHeaders.get(CORRELATION_ID_HEADER),
    })
    const forwarded = new Headers(requestHeaders)
    forwarded.set(ACCOUNT_SUBJECT_HEADER, context.subject)
    forwarded.set(CORRELATION_ID_HEADER, context.correlationId)
    return { context, headers: forwarded }
  } catch (error) {
    throw asBoundaryError(error)
  }
}

export function verifyAuthenticatedAccountContext(
  requestHeaders: Headers,
  authenticatedSubject: string | null | undefined,
): AccountContext {
  if (!authenticatedSubject) throw new AccountBoundaryError('account_context_required', 401)
  try {
    const context = interceptHeaders(requestHeaders, WARP_ACCOUNT_AUTHORITY)
    if (context.subject !== authenticatedSubject) {
      throw new AccountBoundaryError('account_context_denied', 403)
    }
    return context
  } catch (error) {
    throw asBoundaryError(error)
  }
}
