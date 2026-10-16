'use client'

import type { InquiryStatus } from '@/lib/sales-process'

const COLORS: Record<InquiryStatus, string> = {
  '상담 대기': 'bg-blue-50 text-blue-700',
  '부재중 대기': 'bg-amber-50 text-amber-800',
  '첫 상담 완료': 'bg-emerald-50 text-emerald-700',
}

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${COLORS[status]}`}>{status}</span>
}

export function InquiryStatusFilter({ value, onChange }: { value: InquiryStatus | ''; onChange: (value: InquiryStatus | '') => void }) {
  return <fieldset className="min-w-0">
    <legend className="mb-1.5 text-xs font-semibold text-slate-600">미성숙 문의 상태</legend>
    <div className="flex flex-wrap gap-1.5">
      {(['', '상담 대기', '부재중 대기', '첫 상담 완료'] as const).map(status =>
        <button key={status} type="button" aria-pressed={value === status} onClick={() => onChange(status)}
          className={`min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold ${value === status ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>
          {status || '전체'}
        </button>)}
    </div>
  </fieldset>
}
