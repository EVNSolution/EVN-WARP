import Link from 'next/link'
import { ArrowUpRight, Building2, Filter, ReceiptText, Truck } from 'lucide-react'

/**
 * 연동 시스템 허브 — 회사·고객사 시스템들의 입구.
 * 「사내」 영업은 WARP 안의 화면으로 이동(도메인 이동 없음), 나머지는 각자 로그인을 가진
 * 별도 시스템을 새 창으로 연다 (링크가 보여도 해당 시스템 계정이 없으면 로그인에서 막힌다).
 * 새 시스템이 생기면 목록에 한 줄만 추가하면 된다.
 */
export const dynamic = 'force-dynamic'

// 고객사별 시스템 — url 이 비어 있으면 「주소 등록 예정」으로 표시된다
const CUSTOMER_SYSTEMS: Array<{ name: string; url: string | null }> = [
  { name: '토마토노', url: 'https://admin.shopify.com/store/7hrud1-xq/apps/clever-k-food-1/app/orders' },
  { name: 'DSV', url: 'https://dsv.cleversystem.ai/control' },
  { name: '휴먼로지스', url: null },
  { name: '화인로지스', url: 'https://cleversystem.ai/company/hwain/settlement?one_tab=upload' },
  { name: '천하운수', url: null },
  { name: 'SH로지스', url: null },
  { name: 'Core Express', url: null },
  { name: '바로고', url: null },
]

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
        <h1 className="text-xl font-bold text-white">연동 시스템</h1>
        <p className="text-[11px] mt-0.5" style={{ color: '#C5D42A' }}>회사·고객사 시스템 모음 — 외부 시스템은 각자의 로그인 권한으로 접속됩니다</p>
      </div>

      <div className="max-w-4xl space-y-6">
      <section>
      <h2 className="text-xs font-semibold text-slate-500 mb-2">사내</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

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
      </section>

      {/* 고객사 시스템 — 서브도메인으로 구분된 고객사별 화면 */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 mb-2">고객사 시스템</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {CUSTOMER_SYSTEMS.map(c => c.url ? (
            <a key={c.name} href={c.url} target="_blank" rel="noopener noreferrer">
              <div className="bg-white border border-slate-200 rounded-xl px-3 py-3 h-full text-center hover:border-slate-400 hover:shadow-sm transition-all">
                <Building2 size={15} className="mx-auto text-slate-400" />
                <div className="mt-1.5 text-xs font-semibold text-slate-700">{c.name}</div>
                <div className="mt-0.5 text-[10px] text-slate-400 flex items-center justify-center gap-0.5">열기 <ArrowUpRight size={9} /></div>
              </div>
            </a>
          ) : (
            <div key={c.name} className="bg-slate-50 border border-dashed border-slate-200 rounded-xl px-3 py-3 text-center">
              <Building2 size={15} className="mx-auto text-slate-300" />
              <div className="mt-1.5 text-xs font-semibold text-slate-400">{c.name}</div>
              <div className="mt-0.5 text-[10px] text-slate-300">주소 등록 예정</div>
            </div>
          ))}
        </div>
      </section>
      </div>
    </div>
  )
}
