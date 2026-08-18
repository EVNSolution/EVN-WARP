import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  BuildupImportError,
  fetchBuildupCustomers,
  isBuildupConfigured,
  linkBuildupCustomers,
} from '@/lib/buildup-import/client'
import { classifyCustomer, toWarpCreateData, type WarpMatchTarget } from '@/lib/buildup-import/classify'

/**
 * buildup-ev 고객 역방향 수집 (#7) — 고객관리 「buildup에서 불러오기」 팝업 API.
 * 세션 인증은 proxy.ts 가 강제한다 (이 경로는 /api/external 이 아니라 로그인 필수).
 *
 * GET  — buildup 고객을 가져와 신규/중복의심/이미연결로 분류해 준다 (조회만, 변경 없음)
 * POST — 승인 결과 반영: 신규 생성 또는 기존 고객에 연결 + buildup 에 연결 write-back
 */

const WARP_MATCH_SELECT = {
  id: true, name: true, companyName: true, phone: true, companyPhone: true,
  birthInfo: true, soleBusinessNo: true, businessRegNo: true,
} as const

function errorResponse(e: unknown) {
  if (e instanceof BuildupImportError) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
  throw e
}

export async function GET() {
  if (!isBuildupConfigured()) {
    return NextResponse.json({ error: 'buildup 연동이 설정되지 않았습니다 (BUILDUP_API_BASE_URL)' }, { status: 503 })
  }
  try {
    const [buildupCustomers, warpCustomers] = await Promise.all([
      fetchBuildupCustomers(),
      prisma.customer.findMany({ select: WARP_MATCH_SELECT }) as Promise<WarpMatchTarget[]>,
    ])
    const items = buildupCustomers.map(b => ({ customer: b, classification: classifyCustomer(b, warpCustomers) }))
    const counts = {
      new: items.filter(i => i.classification.kind === 'new').length,
      suspect: items.filter(i => i.classification.kind === 'suspect').length,
      linked: items.filter(i => i.classification.kind === 'linked').length,
    }
    return NextResponse.json({ items, counts })
  } catch (e) {
    return errorResponse(e)
  }
}

interface Decision {
  buildupId: number
  action: 'create' | 'link'
  /** action=link 일 때 연결할 WARP 고객 id */
  warpCustomerId?: string
}

export async function POST(req: NextRequest) {
  if (!isBuildupConfigured()) {
    return NextResponse.json({ error: 'buildup 연동이 설정되지 않았습니다' }, { status: 503 })
  }
  const decisions = ((await req.json().catch(() => null)) as { decisions?: unknown } | null)?.decisions
  const valid = Array.isArray(decisions) && decisions.length > 0 && decisions.length <= 500
    && decisions.every((d): d is Decision =>
      typeof d === 'object' && d !== null
      && Number.isInteger((d as Decision).buildupId)
      && ((d as Decision).action === 'create'
        || ((d as Decision).action === 'link' && typeof (d as Decision).warpCustomerId === 'string')))
  if (!valid) {
    return NextResponse.json({ error: 'decisions 배열이 필요합니다' }, { status: 400 })
  }

  try {
    // 클라이언트가 보낸 데이터를 믿지 않는다 — buildup 에서 원본을 다시 받아 생성한다
    const buildupCustomers = await fetchBuildupCustomers()
    const byId = new Map(buildupCustomers.map(b => [b.id, b]))

    const links: { id: number; warp_customer_id: string }[] = []
    let created = 0
    let linked = 0
    const skipped: number[] = []

    for (const d of decisions) {
      const b = byId.get(d.buildupId)
      // 그 사이 buildup 에서 지워졌거나 이미 연결됐으면 건너뛴다(중복 등록 방지)
      if (!b || b.warp_customer_id) { skipped.push(d.buildupId); continue }

      if (d.action === 'create') {
        const customer = await prisma.customer.create({
          data: toWarpCreateData(b) as Parameters<typeof prisma.customer.create>[0]['data'],
          select: { id: true },
        })
        links.push({ id: b.id, warp_customer_id: customer.id })
        created++
      } else {
        const exists = await prisma.customer.findUnique({ where: { id: d.warpCustomerId! }, select: { id: true } })
        if (!exists) { skipped.push(d.buildupId); continue }
        links.push({ id: b.id, warp_customer_id: exists.id })
        linked++
      }
    }

    const writeBack = await linkBuildupCustomers(links)
    console.info(`[buildup-import] 생성 ${created} · 연결 ${linked} · 건너뜀 ${skipped.length} · write-back ${writeBack}`)
    return NextResponse.json({ created, linked, skipped, writeBack })
  } catch (e) {
    return errorResponse(e)
  }
}
