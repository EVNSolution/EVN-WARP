import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const cards = await prisma.corporateCard.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(cards)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { holderName, cardNumber } = body
  if (!holderName?.trim() || !cardNumber?.trim()) {
    return NextResponse.json({ error: '카드상 이름과 카드번호는 필수입니다.' }, { status: 400 })
  }
  const card = await prisma.corporateCard.create({
    data: { holderName: holderName.trim(), cardNumber: cardNumber.trim() },
  })
  return NextResponse.json(card, { status: 201 })
}
