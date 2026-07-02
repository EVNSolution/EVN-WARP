'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp } from 'lucide-react'
import CompanyKpiBoard from './CompanyKpiBoard'

interface KpiEntry { id?: string; year: number; month: number; target: number | null; actual: number | null; memo: string | null }
interface KpiItem {
  id: string; year: number; label: string; unit: string | null
  category: string; index: number; annualTarget: number | null
  linkedToFunnel?: boolean
  entries: KpiEntry[]
}

export default function KpiInputModal({ kpis, year, buttonClassName }: { kpis: KpiItem[]; year: number; buttonClassName?: string }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleClose() {
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={buttonClassName ?? 'flex items-center gap-1.5 text-xs font-medium text-lime-700 border border-lime-500/50 px-3 py-1.5 rounded-lg hover:bg-lime-50 transition-colors'}>
        <TrendingUp size={12} /> KPI 관리
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* 배경 오버레이 */}
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

          {/* 슬라이드 패널 (오른쪽에서) */}
          <div className="relative ml-auto w-full bg-white h-full overflow-y-auto shadow-2xl"
            style={{ maxWidth: '1100px' }}>
            <CompanyKpiBoard kpis={kpis} year={year} onClose={handleClose} />
          </div>
        </div>
      )}
    </>
  )
}
