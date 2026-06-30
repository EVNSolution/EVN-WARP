import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export interface CheckRow {
  index: number
  name: string
  phone: string | null
}

export interface CheckResult {
  index: number
  status: 'new' | 'duplicate' | 'similar'
  matchedId:    string | null
  matchedName:  string | null
  matchedPhone: string | null
}

export async function POST(req: NextRequest) {
  const rows: CheckRow[] = await req.json()

  const results: CheckResult[] = await Promise.all(
    rows.map(async (row) => {
      const phone   = row.phone?.replace(/\D/g, '') ?? null
      const nameTrim = row.name.trim()

      // 1. 전화번호 정확 일치
      if (phone) {
        const phoneHyphen = phone.length === 11
          ? `${phone.slice(0,3)}-${phone.slice(3,7)}-${phone.slice(7)}`
          : phone.length === 10
          ? `${phone.slice(0,3)}-${phone.slice(3,6)}-${phone.slice(6)}`
          : phone
        const match = await prisma.customer.findFirst({
          where: { OR: [{ phone: { contains: phone } }, { phone: phoneHyphen }] },
          select: { id: true, name: true, phone: true },
        })
        if (match) {
          return { index: row.index, status: 'duplicate', matchedId: match.id, matchedName: match.name, matchedPhone: match.phone }
        }
      }

      // 2. 이름 정확 일치 (전화번호 없거나 불일치)
      const nameMatch = await prisma.customer.findFirst({
        where: { name: nameTrim },
        select: { id: true, name: true, phone: true },
      })
      if (nameMatch) {
        return { index: row.index, status: 'similar', matchedId: nameMatch.id, matchedName: nameMatch.name, matchedPhone: nameMatch.phone }
      }

      return { index: row.index, status: 'new', matchedId: null, matchedName: null, matchedPhone: null }
    })
  )

  return NextResponse.json(results)
}
