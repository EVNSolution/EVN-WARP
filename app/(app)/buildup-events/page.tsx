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
        견적 시스템(buildup)에서 온 견적서 작성·계약 체결 알림입니다.
        내용을 확인해 파이프라인 딜에 직접 기입한 뒤 「확인 완료」를 눌러 주세요 — 자동으로 기입되지 않습니다.
      </p>
      <BuildupEventsClient events={events} />
    </div>
  )
}
