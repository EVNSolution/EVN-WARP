import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function maskCardNumber(num: string): string {
  const digits = num.replace(/\D/g, '')
  if (digits.length <= 4) return num
  return `•••• ${digits.slice(-4)}`
}

// 전 직원이 비용 입력 시 법인카드 선택용으로 호출 — 카드번호는 뒤 4자리만 노출
export async function GET() {
  const cards = await prisma.corporateCard.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(cards.map(c => ({
    id: c.id, holderName: c.holderName, cardNumberMasked: maskCardNumber(c.cardNumber),
    userId: c.userId, userName: c.userName,
  })))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { holderName, cardNumber, userId, userName } = body
  if (!holderName?.trim() || !cardNumber?.trim()) {
    return NextResponse.json({ error: '카드상 이름과 카드번호는 필수입니다.' }, { status: 400 })
  }
  const card = await prisma.corporateCard.create({
    data: {
      holderName: holderName.trim(),
      cardNumber: cardNumber.trim(),
      userId:     userId   || null,
      userName:   userName || null,
    },
  })
  return NextResponse.json(card, { status: 201 })
}
