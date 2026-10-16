import type { PrismaClient } from '@/app/generated/prisma/client'
import { customerWrite, CustomerMergeError, customerErrorResponse, type CustomerDb } from './customer-alias'

export async function processAuditAdmin(db: CustomerDb, userId: string | undefined) {
  if (!userId) return null
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true } })
  return user && (user.role === 'admin' || user.role === 'ceo') ? user : null
}

export async function deleteProcessAuditRequest(
  req: Request, db: PrismaClient, userId: string | undefined, dealId: string, auditId: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  try {
    if (!userId) throw new CustomerMergeError(401, '로그인이 필요합니다.')
    if (req.method !== 'DELETE') throw new CustomerMergeError(405, '지원하지 않는 요청 방식입니다.')
    const origin = new URL(env.AUTH_URL ?? env.NEXTAUTH_URL ?? req.url).origin
    if (req.headers.get('origin') !== origin || req.headers.get('sec-fetch-site') === 'cross-site') {
      throw new CustomerMergeError(403, '현재 화면에서 다시 요청해 주세요.')
    }
    await customerWrite(db, async tx => {
      // Read the current role inside the write transaction; viewing all leads is not deletion permission.
      const actor = await processAuditAdmin(tx, userId)
      if (!actor) throw new CustomerMergeError(403, '관리자만 변경 기록을 삭제할 수 있습니다.')
      const entry = await tx.salesProcessAudit.findFirst({ where: { id: auditId, dealId }, select: { id: true } })
      const deal = await tx.salesDeal.findUnique({ where: { id: dealId }, select: { id: true } })
      if (!entry || !deal) throw new CustomerMergeError(404, '변경 기록을 찾을 수 없습니다.')
      // Keep the immutable source and its evidence links. A tombstone removes only its display.
      if (!await tx.salesProcessAuditDeletion.findUnique({ where: { auditId } })) {
        await tx.salesProcessAuditDeletion.create({ data: { auditId, actorId: actor.id, actorName: actor.name } })
      }
    })
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return customerErrorResponse(error) }
}
