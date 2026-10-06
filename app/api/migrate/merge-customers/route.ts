import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { handleCustomerMergeRequest } from '@/lib/customer-merge-http'
import { customerErrorResponse } from '@/lib/customer-alias'

async function handle(req: Request) {
  try {
    const session = await auth()
    return await handleCustomerMergeRequest(req, prisma, session?.user?.id)
  } catch (error) { return customerErrorResponse(error) }
}

export const GET = handle
export const POST = handle
