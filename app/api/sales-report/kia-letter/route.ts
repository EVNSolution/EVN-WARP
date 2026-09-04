import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!(session?.user as any)?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const deals = await prisma.salesDeal.findMany({
    where: {
      stageCode: '2-1',
      salesStatus: { not: '이탈' },
    },
    select: {
      name: true,
      phone: true,
      vehicleModel: true,
      purchaseMethod: true,
      contractedAt: true,
      capitalCheckedAt: true,
      bodyType: true,
    },
    orderBy: { stageChangedAt: 'desc' },
  })

  return NextResponse.json(deals)
}
