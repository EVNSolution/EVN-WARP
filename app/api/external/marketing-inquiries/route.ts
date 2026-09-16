import { prisma } from '@/lib/db'
import { handleMarketingInquiryRequest } from '@/lib/marketing-inquiries'

export async function POST(request: Request) {
  return handleMarketingInquiryRequest(request, prisma)
}
