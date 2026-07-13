import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await req.json()
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(b.name      !== undefined && { name:      b.name.trim()                        }),
        ...(b.code      !== undefined && { code:      b.code?.trim()      || null          }),
        ...(b.category  !== undefined && { category:  b.category          || null          }),
        ...(b.year      !== undefined && { year:      b.year ? Number(b.year) : null       }),
        ...(b.basePrice !== undefined && { basePrice: b.basePrice ? Number(b.basePrice) : null }),
        ...(b.costPrice !== undefined && { costPrice: b.costPrice ? Number(b.costPrice) : null }),
        ...(b.active    !== undefined && { active:    b.active                              }),
        ...(b.memo      !== undefined && { memo:      b.memo?.trim()      || null          }),
      },
    })
    return NextResponse.json(product)
  } catch {
    return NextResponse.json({ error: '수정 실패' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.product.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
  }
}
