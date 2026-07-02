import { prisma } from '@/lib/db'
import { getStageCode, PIPELINE } from '@/lib/pipeline'
import PipelineView, { type PipelineDeal } from '@/components/PipelineView'
import ProcessGuideButton from '@/components/ProcessGuideButton'
import ExcelImportExport from '@/components/ExcelImportExport'

export default async function FunnelPage() {
  const currentMonth = new Date().getMonth() + 1
  const currentYear  = new Date().getFullYear()

  const rows = await prisma.salesDeal.findMany({ orderBy: { createdAt: 'asc' } })

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
    }
  })

  // 영업퍼널 연동 KPI에서 이번 달 목표 읽기
  let linkedKpi: { label: string; unit: string | null; entries: { target: number | null }[] } | null = null
  let salesTarget: number | null = null
  try {
    linkedKpi = await prisma.companyKpi.findFirst({
      where: { linkedToFunnel: true },
      select: {
        label: true,
        unit: true,
        entries: {
          where: { year: currentYear, month: currentMonth },
          select: { target: true },
          take: 1,
        },
      },
    })
    salesTarget = linkedKpi?.entries[0]?.target ?? null
  } catch {
    // linkedToFunnel 컬럼이 없는 환경(서버 재시작 전)에서도 페이지가 열리도록 폴백
  }

  // 요약 통계
  const activeDeals  = deals.filter(d => d.salesStatus === '진행중')
  const lostDeals    = deals.filter(d => d.salesStatus === '이탈')
  const doneDeals    = deals.filter(d => d.salesStatus === '완료')
  const contractCount = deals.filter(d => ['2-1','2-2','2-3','3-1','3-2','3-3','4-1'].includes(d.stageCode)).length

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
        <div className="flex items-center gap-5 text-xs">
          <ExcelImportExport />
          <ProcessGuideButton />
          <div className="text-center">
            <div className="text-white/50 text-[10px]">전체 리드</div>
            <div className="text-white font-bold text-base">{deals.length}</div>
          </div>
          <div className="text-center">
            <div className="text-white/50 text-[10px]">진행중</div>
            <div className="text-blue-400 font-bold text-base">{activeDeals.length}</div>
          </div>
          <div className="text-center">
            <div className="text-white/50 text-[10px]">계약 이후</div>
            <div className="font-bold text-base" style={{ color: '#C5D42A' }}>{contractCount}</div>
          </div>
          <div className="text-center">
            <div className="text-white/50 text-[10px]">출고 완료</div>
            <div className="text-green-400 font-bold text-base">{doneDeals.length}</div>
          </div>
          <div className="text-center">
            <div className="text-white/50 text-[10px]">이탈</div>
            <div className="text-slate-500 font-bold text-base">{lostDeals.length}</div>
          </div>
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
