import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

function fmt(n: number | null | undefined) {
  if (n == null) return ''
  return Math.round(n).toLocaleString('ko-KR')
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [trip, expenses] = await Promise.all([
    prisma.tripReport.findUnique({ where: { id } }),
    prisma.tripExpense.findMany({
      where: { tripReportId: id },
      orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
  ])
  if (!trip) return NextResponse.json({ error: '없음' }, { status: 404 })

  const wb = XLSX.utils.book_new()

  // ── Sheet 1: 출장보고서 ──────────────────────────────────────────
  const totalKrw = expenses.reduce((s, e) => s + (e.amountKrw ?? 0), 0)
  const ws1Data: (string | number)[][] = [
    [],
    ['출 장 보 고 서'],
    [],
    ['출장자', '', trip.userName],
    [],
    ['소  속', '', trip.teamName ?? '이브이앤솔루션㈜'],
    [],
    ['출장목적', '', trip.purpose],
    [],
    [' 출 장 지', '', trip.destination],
    [],
    ['출장기간', '', `${trip.startDate} ~ ${trip.endDate}`],
    [],
    ['출장경비 (KRW)', '', totalKrw],
    [],
    ['출장내용', '', trip.result ?? trip.schedule ?? ''],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    ['비고', '', '항공표/호텔비용 등 법인카드 사용분 포함'],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data)
  ws1['!cols'] = [{ wch: 14 }, { wch: 2 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, ws1, '출장보고서')

  // ── Sheet 2: 출장비용명세 ────────────────────────────────────────
  // 통화별 그룹 파악
  const foreignCurrencies = [...new Set(expenses.filter(e => e.currency !== 'KRW').map(e => e.currency))]
  const isMultiCurrency = foreignCurrencies.length > 0

  const header1 = ['출장비 비용명세']
  const header3 = ['No.', '일자', '구분', '세부정보',
    ...(isMultiCurrency ? ['사용 금액 (외화)', '통화', '환율', '원화 금액'] : ['사용 금액 (KRW)']),
    '비고']

  const rows: (string | number | null)[][] = [
    header1,
    [],
    header3,
  ]

  let no = 1
  for (const e of expenses) {
    const row: (string | number | null)[] = [
      no++,
      e.date,
      e.category,
      e.detail ?? '',
      ...(isMultiCurrency
        ? [
            e.currency !== 'KRW' ? (e.amountForeign ?? '') : '',
            e.currency !== 'KRW' ? e.currency : '',
            e.currency !== 'KRW' ? (e.exchangeRate ?? '') : '',
            e.amountKrw,
          ]
        : [e.amountKrw]),
      e.memo ?? '',
    ]
    rows.push(row)
  }

  // 합계 행
  const sumRow: (string | number | null)[] = [
    '', '합계', '', '',
    ...(isMultiCurrency ? ['', '', '', totalKrw] : [totalKrw]),
    '',
  ]
  rows.push(sumRow)
  rows.push([])

  // 환율 정보
  if (isMultiCurrency) {
    const rateEntries = expenses
      .filter(e => e.currency !== 'KRW' && e.exchangeRate)
      .reduce<Record<string, number>>((acc, e) => {
        if (!acc[e.currency!]) acc[e.currency!] = e.exchangeRate!
        return acc
      }, {})
    for (const [cur, rate] of Object.entries(rateEntries)) {
      rows.push(['', `* 환율 (${trip.startDate} 기준): 1 ${cur} = ${rate.toLocaleString('ko-KR')} KRW`])
    }
  }

  const ws2 = XLSX.utils.aoa_to_sheet(rows)
  ws2['!cols'] = [
    { wch: 5 }, { wch: 12 }, { wch: 10 }, { wch: 20 },
    ...(isMultiCurrency ? [{ wch: 14 }, { wch: 6 }, { wch: 10 }, { wch: 14 }] : [{ wch: 16 }]),
    { wch: 20 },
  ]
  XLSX.utils.book_append_sheet(wb, ws2, '출장비용명세')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = encodeURIComponent(`출장보고서_${trip.userName}_${trip.startDate}.xlsx`)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
    },
  })
}
