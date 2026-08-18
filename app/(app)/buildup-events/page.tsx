import { prisma } from '@/lib/db'
import BuildupEventsClient, { type EventRow } from './BuildupEventsClient'

/**
 * buildup 딜 이벤트 수신함 (#27).
 * 견적작성·계약체결 알림을 확인하고, 파이프라인에 직접 기입한 뒤 완료 처리하는 화면.
 * 자동 기입은 없다 — 이 화면의 존재 이유가 「사람이 확인한다」이다.
 */
export const dynamic = 'force-dynamic'

export default async function BuildupEventsPage() {
  const rows = await prisma.buildupEvent.findMany({
    orderBy: [{ status: 'desc' }, { createdAt: 'desc' }], // pending 먼저, 최신순
    take: 200,
  })

  // 연결된 고객들의 딜 — 승인 시 "어느 딜의 서류함에 첨부할지" 고르게 한다
  const customerIds = [...new Set(rows.map(r => r.warpCustomerId).filter((v): v is string => !!v))]
  const deals = customerIds.length
    ? await prisma.salesDeal.findMany({
      where: { customerId: { in: customerIds } },
      select: { id: true, name: true, stageCode: true, stage: true, customerId: true, salesStatus: true },
      orderBy: { createdAt: 'desc' },
    })
    : []
  const dealsByCustomer: Record<string, { id: string; label: string }[]> = {}
  for (const d of deals) {
    if (!d.customerId) continue
    ;(dealsByCustomer[d.customerId] ??= []).push({
      id: d.id,
      label: `${d.name} · ${d.stageCode ?? d.stage}${d.salesStatus && d.salesStatus !== '진행중' ? ` (${d.salesStatus})` : ''}`,
    })
  }

  const events: EventRow[] = rows.map(r => ({
    id: r.id,
    type: r.type,
    quoteNo: r.quoteNo,
    buildupQuoteId: r.buildupQuoteId,
    customerName: r.customerName,
    warpCustomerId: r.warpCustomerId,
    payloadJson: r.payloadJson,
    status: r.status,
    confirmedBy: r.confirmedBy,
    createdAt: r.createdAt.toISOString(),
  }))

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-lg font-bold text-slate-800">buildup 이벤트 수신함</h1>
      <p className="text-xs text-slate-400 mt-1 mb-5">
        견적 시스템(buildup)에서 온 견적서 작성·수정·계약 체결 알림입니다.
        딜을 선택해 승인하면 <b>견적서·계약서 파일이 그 딜의 성숙리드(1-3) 서류함에 첨부</b>됩니다.
        같은 견적이 수정되면 다시 대기로 돌아옵니다 — 재승인 시 최신 파일로 갱신됩니다.
      </p>
      <BuildupEventsClient events={events} dealsByCustomer={dealsByCustomer} />
    </div>
  )
}
