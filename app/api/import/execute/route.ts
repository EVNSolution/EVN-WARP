import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export interface ExecuteRow {
  action:          'create' | 'link' | 'skip'
  linkCustomerId?: string
  /* 고객 필드 */
  name:            string
  phone?:          string
  customerSegment: 'B2C' | 'B2B'
  customerSource?: string
  companyName?:    string
  /* 리드 필드 */
  leadSource?:     string
  assignee?:       string
  memo?:           string
}

export async function POST(req: NextRequest) {
  const rows: ExecuteRow[] = await req.json()

  let created = 0, linked = 0, skipped = 0
  const errors: string[] = []

  for (const row of rows) {
    if (row.action === 'skip') { skipped++; continue }

    try {
      let customerId: string

      if (row.action === 'create') {
        const customer = await prisma.customer.create({
          data: {
            name:            row.name.trim(),
            phone:           row.phone           || null,
            customerSegment: row.customerSegment || null,
            source:          row.customerSource  || null,
            companyName:     row.companyName     || null,
            status:          '잠재고객',
            collectedAt:     new Date(),
          },
        })
        customerId = customer.id
        created++
      } else {
        // link: use existing customer
        customerId = row.linkCustomerId!
        linked++
      }

      /* 리드(SalesDeal) 생성 */
      await prisma.salesDeal.create({
        data: {
          customerId,
          name:            row.name.trim(),
          phone:           row.phone            || null,
          customerSegment: row.customerSegment  || null,
          companyName:     row.companyName      || null,
          source:          row.leadSource       || null,
          assignee:        row.assignee         || null,
          memo:            row.memo             || null,
          stageCode:       '1-1',
          salesStatus:     '진행중',
          collectedAt:     new Date(),
        },
      })
    } catch (e) {
      errors.push(`${row.name}: ${(e as Error).message}`)
    }
  }

  return NextResponse.json({ created, linked, skipped, errors })
}
