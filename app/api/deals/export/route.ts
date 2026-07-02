import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

const COLS = [
  { h: 'ID',        k: 'id' },
  { h: '고객명',    k: 'name' },
  { h: '전화번호',  k: 'phone' },
  { h: '고객유형',  k: 'customerSegment' },
  { h: '회사명',    k: 'companyName' },
  { h: '담당자직함', k: 'contactTitle' },
  { h: '사업자번호', k: 'businessRegNo' },
  { h: '업종분류',  k: 'b2bCategory' },
  { h: '업태',      k: 'industry' },
  { h: '회사전화',  k: 'companyPhone' },
  { h: '회사주소',  k: 'companyAddress' },
  { h: '단계코드',  k: 'stageCode' },
  { h: '영업상태',  k: 'salesStatus' },
  { h: '유입경로',  k: 'source' },
  { h: '수집일',    k: 'collectedAt' },
  { h: '영업담당자', k: 'assignee' },
  { h: '지역_시',   k: 'regionCity' },
  { h: '지역_구',   k: 'regionDist' },
  { h: '구매시점',  k: 'purchaseTiming' },
  { h: '메모',      k: 'memo' },
]

const COL_WIDTHS = [36, 14, 14, 8, 20, 12, 16, 10, 12, 14, 28, 8, 8, 12, 12, 12, 10, 10, 12, 36]

export async function GET() {
  const deals = await prisma.salesDeal.findMany({ orderBy: { createdAt: 'asc' } })

  const headers = COLS.map(c => c.h)
  const dataRows = deals.map(d => {
    const a = d as Record<string, unknown>
    return COLS.map(c => {
      if (c.k === 'collectedAt') {
        const v = a[c.k]
        return v instanceof Date ? v.toISOString().split('T')[0] : (v ?? '')
      }
      return a[c.k] ?? ''
    })
  })

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
  ws['!cols'] = COL_WIDTHS.map(w => ({ wch: w }))

  // 안내 시트
  const guide = XLSX.utils.aoa_to_sheet([
    ['필드', '허용값'],
    ['고객유형', 'B2C  /  B2B'],
    ['단계코드', '1-1  1-2  1-3  2-1  2-2  2-3  3-1  3-2  3-3  4-1  4-2  이탈  완료'],
    ['영업상태', '진행중  /  완료  /  이탈'],
    ['', ''],
    ['※ ID가 있는 행은 기존 딜을 수정합니다.'],
    ['※ ID가 없는 행은 신규 딜을 생성합니다.'],
    ['※ B2B인 경우 고객명이 없으면 회사명을 사용합니다.'],
  ])
  guide['!cols'] = [{ wch: 14 }, { wch: 60 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '리드목록')
  XLSX.utils.book_append_sheet(wb, guide, '안내')

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array

  const today = new Date().toISOString().split('T')[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextResponse(buf as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="leads_${today}.xlsx"`,
    },
  })
}
