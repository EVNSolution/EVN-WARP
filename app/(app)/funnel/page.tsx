import { prisma } from '@/lib/db'
import { getStageCode, PIPELINE } from '@/lib/pipeline'
import PipelineView, { type PipelineDeal } from '@/components/PipelineView'
import ProcessGuideButton from '@/components/ProcessGuideButton'
import ExcelImportExport from '@/components/ExcelImportExport'

export default async function FunnelPage() {
  const currentMonth = new Date().getMonth() + 1
  const currentYear  = new Date().getFullYear()

  const [rows, products] = await Promise.all([
    prisma.salesDeal.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.product.findMany({ select: { id: true, name: true, code: true } }),
  ])
  const productMap = new Map(products.map(p => [p.id, p.code ?? p.name]))

  const deals: PipelineDeal[] = rows.map(d => {
    const a = d as any
    // stageCode: 저장된 값 우선, 없으면 구 stage 매핑
    const stageCode   = a.stageCode ?? getStageCode(d.stage)
    const salesStatus = a.salesStatus ?? (d.stage === '이탈' ? '이탈' : d.stage === '출고 완료' ? '완료' : '진행중')

    return {
      id:               d.id,
      stageCode,
      salesStatus,
      name:             d.name,
      phone:            d.phone,
      source:           d.source,
      collectedAt:      d.collectedAt?.toISOString() ?? null,
      assignee:         d.assignee,
      memo:             d.memo,
      checklistJson:    a.checklistJson    ?? null,
      customerSegment:  a.customerSegment  ?? null,
      // CRM 필드
      email:            a.email            ?? null,
      gender:           a.gender           ?? null,
      maritalStatus:    a.maritalStatus    ?? null,
      childrenCount:    a.childrenCount    ?? null,
      companyName:      a.companyName      ?? null,
      cargoType:        a.cargoType        ?? null,
      deliveryRegion:   a.deliveryRegion   ?? null,
      purchaseTiming:   d.purchaseTiming   ?? null,
      productName:      a.productId ? (productMap.get(a.productId) ?? null) : null,
    }
  })

  // 영업퍼널 연동 KPI에서 이번 달 목표 읽기 (raw SQL로 linkedToFunnel 처리)
  type LinkedKpiRow = { id: string; label: string; unit: string | null }
  let linkedKpi: { label: string; unit: string | null } | null = null
  let salesTarget: number | null = null
  try {
    const rows = await prisma.$queryRaw<LinkedKpiRow[]>`
      SELECT id, label, unit FROM "CompanyKpi" WHERE "linkedToFunnel" = 1 LIMIT 1
    `
    if (rows.length > 0) {
      linkedKpi = { label: rows[0].label, unit: rows[0].unit }
      const entryRows = await prisma.$queryRaw<{ target: number | null }[]>`
        SELECT target FROM "CompanyKpiEntry"
        WHERE "companyKpiId" = ${rows[0].id}
          AND year = ${currentYear}
          AND month = ${currentMonth}
        LIMIT 1
      `
      salesTarget = entryRows[0]?.target ?? null
    }
  } catch {
    // linkedToFunnel 컬럼이 없는 환경에서도 페이지가 열리도록 폴백
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* ── 상단 헤더 ── */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ background: '#111111' }}>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">STEGO K1 영업 파이프라인</h1>
          <p className="text-[11px] mt-0.5" style={{ color: '#C5D42A' }}>
            4단계 · 11 프로세스 통합 관리
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <ExcelImportExport />
          <ProcessGuideButton />
        </div>
      </div>

      {/* ── 색상 범례 ── */}
      <div className="flex items-center gap-5 px-6 py-1.5 bg-white border-b border-slate-100 text-[11px] text-slate-500 shrink-0">
        <span className="font-semibold text-slate-600">단계 상태:</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>정상 (목표 달성)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"/>주의 (목표 50%↑)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>위험 (목표 50%↓)</span>
        <span className="ml-auto text-slate-400">좌측 단계 클릭 → 해당 리드 필터 | 리드 클릭 → 체크리스트 상세</span>
      </div>

      {/* ── 본문: PipelineView ── */}
      <PipelineView
        deals={deals}
        salesTarget={salesTarget}
        linkedKpiLabel={linkedKpi ? `${linkedKpi.label}${linkedKpi.unit ? ` (${linkedKpi.unit})` : ''}` : null}
      />
    </div>
  )
}
