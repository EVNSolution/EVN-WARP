import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { AccountBoundaryError } from '@/lib/account-control/boundary'
import { accountActionFingerprint, AccountActionConflictError, executeAccountAction } from '@/lib/account-control/outbox'
import { requireAccountContext } from '@/lib/account-control/request-context'
import { IDEMPOTENCY_KEY_HEADER, InterceptorError, validateIdempotencyKey } from '@/clever_account_interceptor/typescript'

export async function PATCH(req: NextRequest) {
  try {
    const context = await requireAccountContext()
    const idempotencyKey = validateIdempotencyKey(req.headers.get(IDEMPOTENCY_KEY_HEADER))
    const body: unknown = await req.json()
    const readTeam = (key: 'teamId' | 'teamId2' | 'teamId3'): string | null | 'invalid' => {
      const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[key] : undefined
      if (raw !== null && raw !== undefined && typeof raw !== 'string') return 'invalid'
      return typeof raw === 'string' && raw.trim() ? raw.trim() : null
    }
    const parsed = [readTeam('teamId'), readTeam('teamId2'), readTeam('teamId3')]
    if (parsed.includes('invalid')) {
      return NextResponse.json({ ok: false, code: 'invalid_team_id' }, { status: 422 })
    }
    // 최대 3개 — 중복 제거 후 앞당긴다 (팀2 없이 팀3만 있는 상태 방지). 팀1이 우선순위 최상.
    const compact = [...new Set(parsed.filter((t): t is string => !!t))]
    const [teamId, teamId2, teamId3] = [compact[0] ?? null, compact[1] ?? null, compact[2] ?? null]
    const action = 'warp.account.team.update'
    const result = await executeAccountAction(prisma, {
      context,
      idempotencyKey,
      action,
      requestFingerprint: accountActionFingerprint(action, compact.join(',')),
      execute: transaction => transaction.user.update({
        where: { id: context.subject },
        data: { teamId, teamId2, teamId3 },
      }),
    })
    return NextResponse.json(
      { ok: true, replayed: result.replayed },
      { headers: { 'X-Correlation-ID': context.correlationId } },
    )
  } catch (error) {
    if (error instanceof AccountBoundaryError) {
      return NextResponse.json({ ok: false, code: error.code }, { status: error.status })
    }
    if (error instanceof AccountActionConflictError) {
      return NextResponse.json({ ok: false, code: error.code }, { status: 409 })
    }
    if (error instanceof InterceptorError) {
      return NextResponse.json({ ok: false, code: error.code }, { status: 422 })
    }
    return NextResponse.json({ ok: false, code: 'account_action_failed' }, { status: 500 })
  }
}
