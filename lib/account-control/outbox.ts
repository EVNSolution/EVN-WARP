import { createHash } from 'node:crypto'

import type { Prisma, PrismaClient } from '@/app/generated/prisma/client'
import type { AccountContext } from '@/clever_account_interceptor/typescript'
import { validateIdempotencyKey } from '@/clever_account_interceptor/typescript'

import { WARP_ACCOUNT_AUTHORITY } from './config'

const ACTION_PATTERN = /^[a-z0-9](?:[a-z0-9._:-]{0,63})$/

export class AccountActionConflictError extends Error {
  readonly code = 'account_action_idempotency_conflict'

  constructor() {
    super('account_action_idempotency_conflict')
    this.name = 'AccountActionConflictError'
  }
}

export function accountActionFingerprint(action: string, stableInput: string): string {
  return createHash('sha256').update(action).update('\0').update(stableInput).digest('hex')
}

type ExecuteAccountActionInput<T> = {
  context: AccountContext
  idempotencyKey: string
  action: string
  requestFingerprint: string
  execute: (transaction: Prisma.TransactionClient) => Promise<T>
}

type ExecuteAccountActionResult<T> = Readonly<{
  replayed: boolean
  value?: T
}>

function assertExistingMatches(
  existing: { accountAuthority: string; accountSubject: string; action: string; requestFingerprint: string },
  input: ExecuteAccountActionInput<unknown>,
) {
  if (
    existing.accountAuthority !== input.context.authority
    || existing.accountSubject !== input.context.subject
    || existing.action !== input.action
    || existing.requestFingerprint !== input.requestFingerprint
  ) {
    throw new AccountActionConflictError()
  }
}

export async function executeAccountAction<T>(
  prisma: PrismaClient,
  input: ExecuteAccountActionInput<T>,
): Promise<ExecuteAccountActionResult<T>> {
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey)
  if (input.context.authority !== WARP_ACCOUNT_AUTHORITY || !ACTION_PATTERN.test(input.action)) {
    throw new AccountActionConflictError()
  }
  if (!/^[a-f0-9]{64}$/.test(input.requestFingerprint)) {
    throw new AccountActionConflictError()
  }

  try {
    return await prisma.$transaction(async transaction => {
      const existing = await transaction.accountEvidenceOutbox.findUnique({ where: { idempotencyKey } })
      if (existing) {
        assertExistingMatches(existing, input)
        return { replayed: true }
      }

      const value = await input.execute(transaction)
      const occurredAt = new Date()
      await transaction.accountEvidenceOutbox.create({
        data: {
          idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          accountAuthority: input.context.authority,
          accountSubject: input.context.subject,
          correlationId: input.context.correlationId,
          action: input.action,
          occurredAt,
          nextAttemptAt: occurredAt,
        },
      })
      return { replayed: false, value }
    })
  } catch (error) {
    if ((error as { code?: string })?.code !== 'P2002') throw error
    const existing = await prisma.accountEvidenceOutbox.findUnique({ where: { idempotencyKey } })
    if (!existing) throw error
    assertExistingMatches(existing, input)
    return { replayed: true }
  }
}
