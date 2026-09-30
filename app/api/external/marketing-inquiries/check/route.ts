import { prisma } from '@/lib/db'
import { handleMarketingInquiryCheckRequest } from '@/lib/marketing-inquiries'

export async function POST(request: Request) {
  return handleMarketingInquiryCheckRequest(request, prisma)
}
