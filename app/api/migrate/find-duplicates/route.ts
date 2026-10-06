import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { customerErrorResponse, findCustomerDuplicates } from '@/lib/customer-merge'

export async function GET() {
  try {
    const session = await auth()
    return Response.json(await findCustomerDuplicates(prisma, session?.user?.id), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return customerErrorResponse(error) }
}
