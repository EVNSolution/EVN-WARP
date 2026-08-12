import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { holderName, cardNumber, userId, userName } = body

  const data: Record<string, unknown> = {}
  if (holderName !== undefined) data.holderName = holderName.trim()
  if (cardNumber !== undefined) data.cardNumber = cardNumber.trim()
  if (userId     !== undefined) data.userId     = userId   || null
  if (userName   !== undefined) data.userName   = userName || null

  const card = await prisma.corporateCard.update({ where: { id }, data })
  return NextResponse.json(card)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.corporateCard.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
