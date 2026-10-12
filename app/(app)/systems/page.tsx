import Link from 'next/link'
import { ArrowUpRight, Filter, ReceiptText, Truck } from 'lucide-react'

/**
 * 사내 시스템 허브 — 회사에서 운영 중인 시스템 3개의 입구.
 * 영업은 WARP 안의 화면으로 이동(도메인 이동 없음), 나머지는 별도 시스템을 새 창으로 연다.
 * 새 시스템이 생기면 카드 하나만 추가하면 된다.
 */
export const dynamic = 'force-dynamic'

function Badge({ external }: { external: boolean }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${external ? 'bg-slate-100 text-slate-500' : 'bg-lime-50 text-lime-700'}`}>
      {external ? <>외부 <ArrowUpRight size={10} /></> : 'WARP 내'}
    </span>
  )
}

function IconBox({ icon: Icon }: { icon: typeof Filter }) {
  return (
    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#111111' }}>
      <Icon size={17} style={{ color: '#C5D42A' }} />
    </div>
  )
}

export default function SystemsPage() {
  return (
    <div className="p-6">
      {/* 헤더 (공통 스타일) */}
      <div className="px-6 py-4 mb-4 rounded-xl" style={{ backgroundColor: '#111111' }}>
        <h1 className="text-xl font-bold text-white">사내 시스템</h1>
        <p className="text-[11px] mt-0.5" style={{ color: '#C5D42A' }}>회사에서 운영 중인 시스템 모음</p>
      </div>

      <div className="max-w-4xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

        {/* 1. 영업 — WARP 내부 화면들로 통합 진입 */}
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-slate-400 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <IconBox icon={Filter} />
            <Badge external={false} />
          </div>
          <div className="mt-3 text-sm font-semibold text-slate-800">영업 시스템</div>
          <div className="mt-1 text-[11px] text-slate-400 leading-relaxed">파이프라인 · 리포트 · 고객 관리를 한 곳에서</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Link href="/funnel" className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition">파이프라인</Link>
            <Link href="/sales-report" className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition">리포트</Link>
            <Link href="/customers" className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition">고객 관리</Link>
          </div>
        </div>

        {/* 2. buildup-ev — 견적 시스템 (외부) */}
        <a href="https://buildup-ev.cleversystem.ai" target="_blank" rel="noopener noreferrer">
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 h-full hover:border-slate-400 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between">
              <IconBox icon={ReceiptText} />
              <Badge external />
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-800">견적 시스템 (buildup)</div>
            <div className="mt-1 text-[11px] text-slate-400 leading-relaxed">차량 견적 작성 · 계약 · 전자서명 — 견적·계약은 WARP와 자동 연동</div>
          </div>
        </a>

        {/* 3. CLEVER_DOM — 차량 운영 대시보드 (외부) */}
        <a href="https://cleversystem.ai/portal/vehicle/dashboard" target="_blank" rel="noopener noreferrer">
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 h-full hover:border-slate-400 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between">
              <IconBox icon={Truck} />
              <Badge external />
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-800">차량 운영 (CLEVER)</div>
            <div className="mt-1 text-[11px] text-slate-400 leading-relaxed">CLEVER 포털 — 차량 대시보드</div>
          </div>
        </a>

      </div>
    </div>
  )
}
