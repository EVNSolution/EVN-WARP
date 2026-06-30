import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST() {
  const { count } = await prisma.salesDeal.deleteMany({})
  return NextResponse.json({ ok: true, deleted: count })
}
