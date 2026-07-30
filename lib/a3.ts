export const STATUS_STYLE: Record<string, string> = {
  '진행중': 'bg-blue-100 text-blue-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-gray-100 text-gray-500',
  '지연':   'bg-red-100 text-red-600',
}

export function dDay(endDate: Date) {
  const diff = Math.ceil((endDate.getTime() - Date.now()) / 86400000)
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, cls: 'text-red-500' }
  if (diff === 0) return { label: 'D-day', cls: 'text-orange-500' }
  return { label: `D-${diff}`, cls: 'text-slate-400' }
}
