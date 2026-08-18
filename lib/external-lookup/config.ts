import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * 외부 시스템(buildup-ev) 고객조회 API 공유 비밀키 설정.
 * 키는 .env / SSM(APP_ENV)에만 둔다 — 코드·로그·응답에 절대 노출 금지.
 */
export const MIN_LOOKUP_KEY_LENGTH = 32

export class ExternalLookupConfigurationError extends Error {
  constructor(code: string) {
    super(code)
    this.name = 'ExternalLookupConfigurationError'
  }
}

/** WARP_LOOKUP_API_KEY 검증 — 미설정·32자 미만·공백 포함이면 거부(기능 비활성). */
export function readLookupApiKey(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const key = (env.WARP_LOOKUP_API_KEY ?? '').trim()
  if (!key) throw new ExternalLookupConfigurationError('lookup_key_not_configured')
  if (key.length < MIN_LOOKUP_KEY_LENGTH || /\s/u.test(key)) {
    throw new ExternalLookupConfigurationError('lookup_key_too_weak')
  }
  return key
}

/** 타이밍 공격 방지 비교 — SHA-256으로 길이를 맞춘 뒤 timingSafeEqual. */
export function safeKeyEqual(expected: string, provided: string): boolean {
  const a = createHash('sha256').update(expected).digest()
  const b = createHash('sha256').update(provided).digest()
  return timingSafeEqual(a, b)
}
