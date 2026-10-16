import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { deleteProcessAuditRequest } from '@/lib/sales-process-audit'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; auditId: string }> }) {
  const session = await auth()
  const { id, auditId } = await params
  return deleteProcessAuditRequest(req, prisma, session?.user?.id, id, auditId)
}
