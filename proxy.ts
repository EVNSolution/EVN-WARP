import { auth } from '@/auth'
import { NextResponse } from 'next/server'

// 사외 계정은 영업 파이프라인 · 고객관리(CRM)만 접근 가능
const EXTERNAL_ALLOWED_PREFIXES = ['/funnel', '/customers']

export default auth((req) => {
  const isLoggedIn  = !!req.auth
  const pathname    = req.nextUrl.pathname
  const isLoginPage = pathname === '/login'
  const isExternal  = (req.auth?.user as any)?.employmentType === '사외'
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
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
