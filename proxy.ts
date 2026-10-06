import { auth } from '@/auth'
import { AccountBoundaryError, buildForwardedAccountHeaders } from '@/lib/account-control/boundary'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// 사외 계정은 영업 파이프라인 · 고객관리(CRM)만 접근 가능
const EXTERNAL_ALLOWED_PREFIXES = ['/funnel', '/customers']

// 스마트폰 UA (iPad 태블릿 제외 — PC 레이아웃 더 적합)
const MOBILE_RE = /Android.*Mobile|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i

/**
 * Account Control boundary — owner: @OziinG
 * Tracking: EVNSolution/EVN-WARP#2
 * Security: protected account-bound actions must not bypass this boundary.
 */
export default auth(async (req) => {
  const isLoggedIn  = !!req.auth
  const pathname    = req.nextUrl.pathname
  const isLoginPage = pathname === '/login'
  const isExternal  = (req.auth?.user as { employmentType?: string } | undefined)?.employmentType === '사외'
  const isMobilePath = pathname.startsWith('/m')

  // 모바일 디바이스 감지
  const ua           = req.headers.get('user-agent') ?? ''
  const forceDesktop = req.cookies.get('warp-desktop')?.value === '1'
  const mobile       = !forceDesktop && MOBILE_RE.test(ua)
  const pcHomePath = isExternal ? '/funnel' : '/dashboard'
  const homePath   = mobile ? '/m' : pcHomePath

  // 미인증 → 로그인
  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  // 인증됨 + 로그인 페이지 → 홈 (모바일이면 /m)
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL(homePath, req.url))
  }
  // 인증됨 + 모바일 기기 + PC 경로 → /m 으로 리다이렉트
  if (isLoggedIn && mobile && !isMobilePath && !pathname.startsWith('/api/')) {
    if (pathname === '/customers' || pathname.startsWith('/customers/')) {
      const destination = new URL(req.url)
      destination.pathname = `/m${pathname}`
      return NextResponse.redirect(destination)
    }
    return NextResponse.redirect(new URL('/m', req.url))
  }
  // 사외 계정 접근 제한
  if (isLoggedIn && isExternal && !isMobilePath && !pathname.startsWith('/api/')) {
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
      let customerPathname = pathname
      try { customerPathname = decodeURIComponent(pathname) } catch { /* Keep malformed paths unchanged. */ }
      if ((customerPathname === '/api/customers' || customerPathname.startsWith('/api/customers/'))
        && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        // Baseline-only guard: recheck metadata on every write, including after a live schema migration.
        try {
          const tables = await prisma.$queryRaw<unknown[]>`
            SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'CustomerMerge' LIMIT 1
          `
          if (tables.length > 0) {
            return NextResponse.json(
              { error: '복구 버전에서는 고객 정보 수정이 중단됩니다. 최신 버전 복구 후 진행해 주세요.' },
              { status: 409, headers: { 'Cache-Control': 'no-store' } },
            )
          }
        } catch {
          return NextResponse.json(
            { error: '고객 정보 수정 가능 여부를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.' },
            { status: 503, headers: { 'Cache-Control': 'no-store' } },
          )
        }
      }
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
  // api/external 은 공유키, healthz/readyz 는 배포 경계가 직접 인증·제한한다.
  matcher: ['/((?!api/auth|api/external|api/healthz|api/readyz|_next/static|_next/image|favicon.ico).*)'],
}
