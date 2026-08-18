export const WARP_ACCOUNT_AUTHORITY = 'system:warp'
export const HQ_ACTION_PATH = '/api/v1/actions'

export type HqGatewayConfig = Readonly<{
  actionUrl: string
  authorization: string
  timeoutMs: number
}>

export class AccountControlConfigurationError extends Error {
  constructor(code: string) {
    super(code)
    this.name = 'AccountControlConfigurationError'
  }
}

export function readHqGatewayConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): HqGatewayConfig {
  const baseUrl = (env.CLEVER_HQ_GATEWAY_URL ?? '').trim()
  const clientKey = (env.CLEVER_HQ_CLIENT_KEY ?? '').trim()
  const clientSecret = (env.CLEVER_HQ_CLIENT_SECRET ?? '').trim()
  if (!baseUrl || !clientKey || !clientSecret) {
    throw new AccountControlConfigurationError('hq_gateway_not_configured')
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(clientKey) || clientSecret.length > 512 || /[\s.]/u.test(clientSecret)) {
    throw new AccountControlConfigurationError('invalid_hq_machine_credential')
  }

  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new AccountControlConfigurationError('invalid_hq_gateway_url')
  }
  const isLoopback = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '::1'
  if (
    (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback))
    || parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
  ) {
    throw new AccountControlConfigurationError('invalid_hq_gateway_url')
  }

  return Object.freeze({
    actionUrl: new URL(HQ_ACTION_PATH, parsed).toString(),
    authorization: `Bearer ${clientKey}.${clientSecret}`,
    timeoutMs: 5_000,
  })
}
