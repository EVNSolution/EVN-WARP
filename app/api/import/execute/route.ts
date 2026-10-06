import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { customerWrite, requireCurrentCustomerId, resolveCustomerId } from '@/lib/customer-alias'

export interface ExecuteRow {
  action:          'update' | 'create' | 'link' | 'skip'
  dealId?:         string   // 'update' 시 사용
  linkCustomerId?: string   // 'link' 시 사용
  name:            string
  phone?:          string
  customerSegment: string
  companyName?:    string
  stageCode?:      string
  salesStatus?:    string
  source?:         string
  collectedAt?:    string
  assignee?:       string
  regionCity?:     string
  regionDist?:     string
  purchaseTiming?: string
  memo?:           string
}

export async function POST(req: NextRequest) {
  const rows: ExecuteRow[] = await req.json()

  let created = 0, updated = 0, linked = 0, skipped = 0
  const errors: string[] = []

  for (const row of rows) {
    if (row.action === 'skip') { skipped++; continue }

    const dealFields = {
      name:            row.name.trim(),
      phone:           row.phone           || null,
      customerSegment: row.customerSegment || null,
      companyName:     row.companyName     || null,
      stageCode:       row.stageCode       || '1-1',
      stage:           row.stageCode       || '1-1',
      salesStatus:     row.salesStatus     || '진행중',
      source:          row.source          || null,
      collectedAt:     row.collectedAt     ? new Date(row.collectedAt) : null,
      assignee:        row.assignee        || null,
      regionCity:      row.regionCity      || null,
      regionDist:      row.regionDist      || null,
      purchaseTiming:  row.purchaseTiming  || null,
      memo:            row.memo            || null,
    }

    try {
      if (row.action === 'update' && row.dealId) {
        await prisma.salesDeal.update({
          where: { id: row.dealId },
          data:  dealFields,
        })
        updated++
      } else {
        await customerWrite(prisma, async prisma => {
          let customerId: string

          if (row.action === 'create') {
            const customer = await prisma.customer.create({
              data: {
                name:            row.name.trim(),
                phone:           row.phone           || null,
                customerSegment: row.customerSegment || null,
                source:          row.source          || null,
                companyName:     row.companyName     || null,
                assignee:        row.assignee        || null,
                status:          '잠재고객',
                collectedAt:     row.collectedAt ? new Date(row.collectedAt) : new Date(),
                regionCity:      row.regionCity      || null,
                regionDist:      row.regionDist      || null,
              },
            })
            customerId = customer.id

          } else {
            // link: 기존 고객에 새 딜 연결
            customerId = await resolveCustomerId(prisma, row.linkCustomerId!)
            await requireCurrentCustomerId(prisma, customerId)
          }

          await prisma.salesDeal.create({
            data: { ...dealFields, customerId },
          })
        })
        if (row.action === 'create') created++
        else linked++
      }
    } catch {
      errors.push('고객 연결 또는 저장에 실패했습니다. 현재 고객 정보를 확인해 주세요.')
    }
  }

  return NextResponse.json({ created, updated, linked, skipped, errors })
}
