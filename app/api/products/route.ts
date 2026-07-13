import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(products)
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.name?.trim()) return NextResponse.json({ error: '제품명은 필수입니다' }, { status: 400 })
    const product = await prisma.product.create({
      data: {
        name:      b.name.trim(),
        code:      b.code?.trim()     || null,
        category:  b.category         || null,
        year:      b.year     ? Number(b.year)      : null,
        basePrice: b.basePrice ? Number(b.basePrice) : null,
        costPrice: b.costPrice ? Number(b.costPrice) : null,
        memo:      b.memo?.trim()     || null,
      },
    })
    return NextResponse.json(product)
  } catch {
    return NextResponse.json({ error: '생성 실패' }, { status: 500 })
  }
}
