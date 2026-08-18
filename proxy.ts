import { auth } from '@/auth'
import { AccountBoundaryError, buildForwardedAccountHeaders } from '@/lib/account-control/boundary'
import { NextResponse } from 'next/server'

// 사외 계정은 영업 파이프라인 · 고객관리(CRM)만 접근 가능
const EXTERNAL_ALLOWED_PREFIXES = ['/funnel', '/customers']

/**
 * Account Control boundary — owner: @OziinG
 * Tracking: EVNSolution/EVN-WARP#2
 * Security: protected account-bound actions must not bypass this boundary.
 */
export default auth((req) => {
  const isLoggedIn  = !!req.auth
  const pathname    = req.nextUrl.pathname
  const isLoginPage = pathname === '/login'
  const isExternal  = (req.auth?.user as { employmentType?: string } | undefined)?.employmentType === '사외'
  const homePath     = isExternal ? '/funnel' : '/dashboard'

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL(homePath, req.url))
  }
  if (isLoggedIn && isExternal && !pathname.startsWith('/api/')) {
    const allowed = EXTERNAL_ALLOWED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
    if (!allowed) {
      return NextResponse.redirect(new URL('/funnel', req.url))
    }
  }

  if (isLoggedIn) {
    const subject = (req.auth?.user as { id?: string } | undefined)?.id
    if (!subject) {
      return NextResponse.json({ ok: false, code: 'account_context_required' }, { status: 401 })
    }
    try {
      const forwarded = buildForwardedAccountHeaders(req.headers, subject)
      const response = NextResponse.next({ request: { headers: forwarded.headers } })
      response.headers.set('X-Correlation-ID', forwarded.context.correlationId)
      return response
    } catch (error) {
      const boundary = error instanceof AccountBoundaryError
        ? error
        : new AccountBoundaryError('account_context_denied', 403)
      return NextResponse.json({ ok: false, code: boundary.code }, { status: boundary.status })
    }
  }
})

export const config = {
  // api/external 은 세션이 아니라 자체 API 키로 인증하는 서버 간 경로 — 로그인 리다이렉트 제외
  matcher: ['/((?!api/auth|api/external|_next/static|_next/image|favicon.ico).*)'],
}
