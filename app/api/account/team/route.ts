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
    const rawTeamId = typeof body === 'object' && body !== null ? (body as { teamId?: unknown }).teamId : undefined
    if (rawTeamId !== null && rawTeamId !== undefined && typeof rawTeamId !== 'string') {
      return NextResponse.json({ ok: false, code: 'invalid_team_id' }, { status: 422 })
    }
    const teamId = typeof rawTeamId === 'string' && rawTeamId.trim() ? rawTeamId.trim() : null
    const action = 'warp.account.team.update'
    const result = await executeAccountAction(prisma, {
      context,
      idempotencyKey,
      action,
      requestFingerprint: accountActionFingerprint(action, teamId ?? ''),
      execute: transaction => transaction.user.update({
        where: { id: context.subject },
        data: { teamId },
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
