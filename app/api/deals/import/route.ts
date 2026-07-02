import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const HEADER_MAP: Record<string, string> = {
  'ID': 'id',
  '고객명': 'name',
  '전화번호': 'phone',
  '고객유형': 'customerSegment',
  '회사명': 'companyName',
  '담당자직함': 'contactTitle',
  '사업자번호': 'businessRegNo',
  '업종분류': 'b2bCategory',
  '업태': 'industry',
  '회사전화': 'companyPhone',
  '회사주소': 'companyAddress',
  '단계코드': 'stageCode',
  '영업상태': 'salesStatus',
  '유입경로': 'source',
  '수집일': 'collectedAt',
  '영업담당자': 'assignee',
  '지역_시': 'regionCity',
  '지역_구': 'regionDist',
  '구매시점': 'purchaseTiming',
  '메모': 'memo',
}

const VALID_STAGE_CODES = new Set([
  '1-1','1-2','1-3','2-1','2-2','2-3','3-1','3-2','3-3','4-1','4-2','이탈','완료'
])

export async function POST(req: NextRequest) {
  const rows: Record<string, unknown>[] = await req.json()
  let created = 0
  let updated = 0
  const errors: { row: number; msg: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rowNum = i + 2 // 헤더 행 포함 1-indexed

    // 한글 헤더 → 필드명 변환
    const rec: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      const field = HEADER_MAP[k] ?? k
      rec[field] = String(v ?? '').trim()
    }

    // 이름: B2B는 회사명 대체 허용
    const nameVal = rec.name
      || (rec.customerSegment === 'B2B' ? rec.companyName : '')
      || ''
    if (!nameVal) {
      errors.push({ row: rowNum, msg: '고객명(또는 B2B 회사명)이 없습니다.' })
      continue
    }

    // 단계코드 검증
    const stageCode = rec.stageCode || '1-1'
    if (!VALID_STAGE_CODES.has(stageCode)) {
      errors.push({ row: rowNum, msg: `단계코드 '${stageCode}'가 유효하지 않습니다.` })
      continue
    }

    const dealData = {
      name:            nameVal,
      phone:           rec.phone           || null,
      customerSegment: rec.customerSegment || 'B2C',
      companyName:     rec.companyName     || null,
      contactTitle:    rec.contactTitle    || null,
      businessRegNo:   rec.businessRegNo   || null,
      b2bCategory:     rec.b2bCategory     || null,
      industry:        rec.industry        || null,
      companyPhone:    rec.companyPhone    || null,
      companyAddress:  rec.companyAddress  || null,
      stageCode,
      stage:           stageCode,
      salesStatus:     rec.salesStatus     || '진행중',
      source:          rec.source          || null,
      collectedAt:     rec.collectedAt     ? new Date(rec.collectedAt) : null,
      assignee:        rec.assignee        || null,
      regionCity:      rec.regionCity      || null,
      regionDist:      rec.regionDist      || null,
      purchaseTiming:  rec.purchaseTiming  || null,
      memo:            rec.memo            || null,
    }

    try {
      if (rec.id) {
        // 기존 딜 수정
        const exists = await prisma.salesDeal.findUnique({ where: { id: rec.id } })
        if (!exists) {
          errors.push({ row: rowNum, msg: `ID '${rec.id}'를 찾을 수 없습니다.` })
          continue
        }
        await prisma.salesDeal.update({ where: { id: rec.id }, data: dealData })
        updated++
      } else {
        // 신규 딜 생성 — 전화번호로 기존 고객 연결
        const phone = rec.phone?.trim() || null
        let customer = phone
          ? await prisma.customer.findFirst({ where: { phone } })
          : null

        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              name:            nameVal,
              phone,
              customerSegment: rec.customerSegment  || 'B2C',
              companyName:     rec.companyName      || null,
              assignee:        rec.assignee         || null,
              source:          rec.source           || null,
              regionCity:      rec.regionCity       || null,
              regionDist:      rec.regionDist       || null,
              b2bCategory:     rec.b2bCategory      || null,
              businessRegNo:   rec.businessRegNo    || null,
              contactTitle:    rec.contactTitle     || null,
              industry:        rec.industry         || null,
              companyAddress:  rec.companyAddress   || null,
              companyPhone:    rec.companyPhone     || null,
            },
          })
        }

        await prisma.salesDeal.create({
          data: { ...dealData, customerId: customer.id },
        })
        created++
      }
    } catch {
      errors.push({ row: rowNum, msg: '저장 중 오류가 발생했습니다.' })
    }
  }

  return NextResponse.json({ created, updated, errors })
}
