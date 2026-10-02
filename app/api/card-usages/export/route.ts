import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canViewAllCardUsage } from '@/lib/permissions'
import { withActivityTitles } from '@/lib/cardUsageServer'
import { CARD_USAGE_CATEGORIES, receiptList } from '@/lib/cardUsage'

const COL_WIDTHS = [11, 10, 9, 28, 10, 22, 28, 30, 12, 8, 30, 8, 10, 12, 20, 40]

function ymd(v: Date | null) {
  if (!v) return ''
  return new Date(v.getTime() + 9 * 3600_000).toISOString().slice(0, 10)  // KST
}

// 카드/현금 사용내역 엑셀 다운로드 (admin·ceo·경영관리팀) — ?from=&to=&status=
export async function GET(req: NextRequest) {
  const session = await auth()
  const me = session?.user as any
  if (!(await canViewAllCardUsage(me?.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp     = req.nextUrl.searchParams
  const from   = sp.get('from') ?? ''
  const to     = sp.get('to') ?? ''
  const status = sp.get('status') ?? ''

  const rows = await withActivityTitles(await prisma.cardUsage.findMany({
    where: {
      ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  }))

  // Nginx 뒤에서는 nextUrl.origin이 내부 주소일 수 있어 전달된 Host 기준으로 링크를 만든다
  const host   = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto  = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')
  const origin = host ? `${proto}://${host}` : req.nextUrl.origin
  const header = ['일자', '사용자', '결제수단', '사용카드', '해당업무', '사용처', '참석자', '사용내용', '금액', '상태',
    '연계 활동', '영수증', '결재자', '결재일', '반려사유', '영수증 링크']
  const data = rows.map(r => {
    const receipts = receiptList(r.receiptUrl)
    return [
      r.date, r.userName ?? '', r.payMethod, r.cardLabel ?? '', r.category, r.merchant, r.attendees ?? '',
      r.description ?? '', r.amount, r.status, r.activityTitle ?? (r.activityId ? '(삭제된 활동)' : '단독 사용'),
      receipts.length ? `${receipts.length}장` : '', r.approverName ?? '', ymd(r.approvedAt), r.approverNote ?? '',
      receipts.map(u => origin + u).join('\n'),
    ]
  })
  const total = rows.reduce((s, r) => s + r.amount, 0)

  const ws = XLSX.utils.aoa_to_sheet([header, ...data, [], ['합계', '', '', '', '', '', '', '', total]])
  ws['!cols'] = COL_WIDTHS.map(wch => ({ wch }))
  for (let i = 1; i <= data.length + 2; i++) {
    const cell = ws[XLSX.utils.encode_cell({ r: i, c: 8 })]
    if (cell && typeof cell.v === 'number') cell.z = '#,##0'
  }

  // 합계 시트: 해당업무별 / 사용자별 / 카드별
  const sum = (key: (r: typeof rows[number]) => string, order?: readonly string[]) => {
    const m = new Map<string, { total: number; count: number }>()
    for (const r of rows) { const k = key(r); const e = m.get(k) ?? { total: 0, count: 0 }; e.total += r.amount; e.count += 1; m.set(k, e) }
    const keys = order ? order.filter(k => m.has(k)) : [...m.keys()].sort((a, b) => m.get(b)!.total - m.get(a)!.total)
    return keys.map(k => [k, m.get(k)!.count, m.get(k)!.total])
  }
  const summary = XLSX.utils.aoa_to_sheet([
    ['기간', `${from || '전체'} ~ ${to || '전체'}`, status ? `상태: ${status}` : '상태: 전체'],
    [],
    ['해당업무', '건수', '금액'], ...sum(r => r.category, CARD_USAGE_CATEGORIES), ['합계', rows.length, total],
    [],
    ['사용자', '건수', '금액'], ...sum(r => r.userName ?? '(미상)'),
    [],
    ['사용카드', '건수', '금액'], ...sum(r => r.cardLabel ?? r.payMethod),
  ])
  summary['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 14 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '사용내역')
  XLSX.utils.book_append_sheet(wb, summary, '합계')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array

  const name = `카드사용내역_${from || 'all'}_${to || 'all'}.xlsx`
  return new NextResponse(buf as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="card-usage.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  })
}
