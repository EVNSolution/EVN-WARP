import { prisma } from '@/lib/db'
import { handleMarketingCustomerNameRequest } from '@/lib/marketing-customer-name'

export async function POST(request: Request) {
  return handleMarketingCustomerNameRequest(request, prisma)
}
