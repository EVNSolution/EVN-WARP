import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db'
import type { McpUser } from './tools'

/**
 * AI 연결 토큰 — 원문은 발급 순간 한 번만 노출하고 DB 에는 sha256 해시만 둔다.
 * 사용자당 활성 토큰 1개: 재발급하면 기존 토큰은 즉시 폐기된다.
 */

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateToken(): string {
  return `warp_${randomBytes(24).toString('base64url')}`
}

/** Bearer/URL 토큰 → 사용자. 유효하지 않으면 null. */
export async function resolveMcpUser(token: string): Promise<McpUser | null> {
  if (!token || token.length < 20 || token.length > 200) return null
  const row = await prisma.mcpToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, teamId: true, dongjakSessionId: true } } },
  })
  if (!row || row.revokedAt) return null
  // lastUsedAt 은 분 단위로만 갱신 (매 호출 write 방지)
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    prisma.mcpToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
  }
  return { id: row.user.id, name: row.user.name, teamId: row.user.teamId, dongjakSessionId: row.user.dongjakSessionId }
}
