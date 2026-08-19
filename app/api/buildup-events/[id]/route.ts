import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { fetchQuoteDocument, isBuildupConfigured } from '@/lib/buildup-import/client'
import { buildAttachmentFileName } from '@/lib/buildup-import/events'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads')

/** 파이프라인 1-3(성숙리드) 서류 슬롯 — data/pipeline-documents.json 의 key 와 일치해야 한다. */
const DOC_STAGE = '1-3'
const DOC_QUOTE = { key: 'quotation', label: '견적서' }
const DOC_CONTRACT = { key: 'special_contract', label: '특장계약서' }

/**
 * buildup 이벤트 확인 처리 (#27).
 *
 * body.dealId 가 있으면 — buildup 에서 문서를 받아와 그 딜의 1-3 서류함에 첨부한 뒤 완료:
 *   · 견적 이벤트 → 그 시점 견적서 PDF (1차)
 *   · 계약 이벤트 → 서명본/서면 스캔본 + 고정된 최종 견적서 (최종 갱신)
 *   이전 파일은 지우지 않는다 — 최신 파일이 현재본, 과거본은 이력이다.
 * dealId 없으면 — 첨부 없이 확인만 (내용을 보고 기입만 한 경우).
 */
export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/buildup-events/[id]'>) {
  const { id } = await ctx.params
  const session = await auth()
  const by = (session?.user?.name ?? session?.user?.email) || null
  if (!by) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const dealId = ((await req.json().catch(() => null)) as { dealId?: unknown } | null)?.dealId

  const event = await prisma.buildupEvent.findUnique({ where: { id } })
  if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const attached: string[] = []
  if (typeof dealId === 'string' && dealId) {
    if (!isBuildupConfigured()) {
      return NextResponse.json({ error: 'buildup 연동이 설정되지 않았습니다' }, { status: 503 })
    }
    const deal = await prisma.salesDeal.findUnique({ where: { id: dealId }, select: { id: true, customerId: true } })
    if (!deal) return NextResponse.json({ error: '딜을 찾을 수 없습니다' }, { status: 404 })
    // 연결된 고객이 확인된 이벤트라면 다른 고객의 딜에 잘못 첨부되는 것을 막는다
    if (event.warpCustomerId && deal.customerId !== event.warpCustomerId) {
      return NextResponse.json({ error: '이벤트 고객과 다른 고객의 딜입니다' }, { status: 409 })
    }

    try {
      // 계약 이벤트는 서명본이 본체 — 견적서(고정본)도 함께 최신으로 얹는다
      const docs = event.type === 'contract_completed'
        ? [
          { kind: 'contract-pdf' as const, slot: DOC_CONTRACT },
          { kind: 'quote-pdf' as const, slot: DOC_QUOTE },
        ]
        : [{ kind: 'quote-pdf' as const, slot: DOC_QUOTE }]

      const dir = path.join(UPLOADS_DIR, 'deals', deal.id)
      await mkdir(dir, { recursive: true })

      for (const d of docs) {
        const doc = await fetchQuoteDocument(event.buildupQuoteId, d.kind)
        if (!doc) continue // 아직 없는 문서(예: 계약 전 서명본)는 건너뛴다
        const ext = path.extname(doc.filename) || '.pdf'
        const storedName = `${randomUUID()}${ext}`
        // 표시용 파일명은 「연월일_고객이름_서류명」 — 같은 슬롯에 수정본이 쌓이면 _v2, _v3…
        const version = await prisma.dealDocument.count({
          where: { dealId: deal.id, docKey: d.slot.key },
        }) + 1
        const displayName = buildAttachmentFileName({
          date: new Date(),
          customerName: event.customerName,
          label: d.slot.label,
          version,
          ext,
        })
        await writeFile(path.join(dir, storedName), doc.buffer)
        await prisma.dealDocument.create({
          data: {
            dealId: deal.id,
            stageCode: DOC_STAGE,
            docKey: d.slot.key,
            docLabel: d.slot.label,
            fileName: displayName,
            storedName,
            filePath: `/api/uploads/deals/${deal.id}/${storedName}`,
            fileSize: doc.buffer.length,
            mimeType: doc.contentType,
          },
        })
        attached.push(`${d.slot.label}(${displayName})`)
      }
    } catch (e) {
      // 문서를 못 받으면 확인 완료로 넘기지 않는다 — 첨부가 목적인 승인이었다
      const msg = e instanceof Error ? e.message : 'buildup 문서 수신 실패'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  }

  const updated = await prisma.buildupEvent.update({
    where: { id },
    data: { status: 'confirmed', confirmedBy: by, confirmedAt: new Date() },
    select: { id: true, status: true },
  })
  console.info(`[buildup-events] ${event.eventKey} 확인 — by=${by} 첨부=[${attached.join(',')}]`)
  return NextResponse.json({ ...updated, attached })
}
