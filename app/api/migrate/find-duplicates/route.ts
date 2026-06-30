import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export type DupGroup = {
  phone:     string | null
  name:      string
  customers: {
    id:          string
    name:        string
    phone:       string | null
    status:      string
    leadCount:   number
    createdAt:   string
  }[]
}

export async function GET() {
  const all = await prisma.customer.findMany({
    include: { leads: { select: { id: true, stageCode: true, salesStatus: true } } },
    orderBy: { createdAt: 'asc' },
  })

  /* 전화번호 기준으로 그루핑 (null 제외) */
  const byPhone = new Map<string, typeof all>()
  const noPhone: typeof all = []

  for (const c of all) {
    const key = c.phone?.replace(/\D/g, '') // 숫자만 추출해서 비교
    if (key && key.length >= 9) {
      const group = byPhone.get(key) ?? []
      group.push(c)
      byPhone.set(key, group)
    } else {
      noPhone.push(c)
    }
  }

  /* 같은 전화번호가 2개 이상 → 중복 */
  const dupGroups: DupGroup[] = []
  for (const [, group] of byPhone) {
    if (group.length < 2) continue
    dupGroups.push({
      phone: group[0].phone,
      name:  group[0].name,
      customers: group.map(c => ({
        id:        c.id,
        name:      c.name,
        phone:     c.phone,
        status:    c.status ?? '잠재고객',
        leadCount: c.leads.length,
        createdAt: c.createdAt.toISOString(),
      })),
    })
  }

  /* 이름 기준 추가 중복 체크 (전화번호 없는 경우) */
  const byName = new Map<string, typeof noPhone>()
  for (const c of noPhone) {
    const key = c.name.trim()
    const group = byName.get(key) ?? []
    group.push(c)
    byName.set(key, group)
  }
  for (const [, group] of byName) {
    if (group.length < 2) continue
    dupGroups.push({
      phone: null,
      name:  group[0].name,
      customers: group.map(c => ({
        id:        c.id,
        name:      c.name,
        phone:     c.phone,
        status:    c.status ?? '잠재고객',
        leadCount: c.leads.length,
        createdAt: c.createdAt.toISOString(),
      })),
    })
  }

  return NextResponse.json({
    total:      all.length,
    dupCount:   dupGroups.reduce((s, g) => s + g.customers.length - 1, 0), // 제거 대상 수
    groupCount: dupGroups.length,
    groups:     dupGroups,
  })
}
