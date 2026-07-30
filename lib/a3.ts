export const STATUS_STYLE: Record<string, string> = {
  '진행중': 'bg-blue-100 text-blue-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-gray-100 text-gray-500',
  '지연':   'bg-red-100 text-red-600',
}

export function dDay(endDate: Date | null | undefined) {
  if (!endDate) return null
  const diff = Math.ceil((endDate.getTime() - Date.now()) / 86400000)
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, cls: 'text-red-500' }
  if (diff === 0) return { label: 'D-day', cls: 'text-orange-500' }
  return { label: `D-${diff}`, cls: 'text-slate-400' }
}

// 전사과제(최상위) 제목 — 하드코딩된 A/B 라벨 대신 실제 조상 레코드의 title을 사용
export function rootAncestorTitle(task: {
  title: string
  parent?: { title: string; parent?: { title: string } | null } | null
}): string {
  return task.parent?.parent?.title ?? task.parent?.title ?? task.title
}

/* 전략(전사과제) 코드 해시 기반 고정 색상 — A3SubTaskGroups.tsx의 TEAM_PALETTE 패턴과 동일 */
const STRAT_PALETTE = [
  { light: 'bg-indigo-100 text-indigo-700', bold: 'bg-indigo-600 text-white', hex: '#6366f1', hexLight: 'EEF2FF', container: 'bg-indigo-50/50 border-indigo-200', border: 'border-indigo-200', leftBar: 'border-l-indigo-500', hoverParent: 'hover:bg-indigo-50' },
  { light: 'bg-emerald-100 text-emerald-700', bold: 'bg-emerald-600 text-white', hex: '#059669', hexLight: 'ECFDF5', container: 'bg-emerald-50/50 border-emerald-200', border: 'border-emerald-200', leftBar: 'border-l-emerald-500', hoverParent: 'hover:bg-emerald-50' },
  { light: 'bg-amber-100 text-amber-700', bold: 'bg-amber-600 text-white', hex: '#d97706', hexLight: 'FFFBEB', container: 'bg-amber-50/50 border-amber-200', border: 'border-amber-200', leftBar: 'border-l-amber-500', hoverParent: 'hover:bg-amber-50' },
  { light: 'bg-rose-100 text-rose-700', bold: 'bg-rose-600 text-white', hex: '#e11d48', hexLight: 'FFF1F2', container: 'bg-rose-50/50 border-rose-200', border: 'border-rose-200', leftBar: 'border-l-rose-500', hoverParent: 'hover:bg-rose-50' },
  { light: 'bg-sky-100 text-sky-700', bold: 'bg-sky-600 text-white', hex: '#0284c7', hexLight: 'F0F9FF', container: 'bg-sky-50/50 border-sky-200', border: 'border-sky-200', leftBar: 'border-l-sky-500', hoverParent: 'hover:bg-sky-50' },
  { light: 'bg-violet-100 text-violet-700', bold: 'bg-violet-600 text-white', hex: '#7c3aed', hexLight: 'F5F3FF', container: 'bg-violet-50/50 border-violet-200', border: 'border-violet-200', leftBar: 'border-l-violet-500', hoverParent: 'hover:bg-violet-50' },
]

export function stratColor(strategy: string | null | undefined) {
  const key = strategy || '?'
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return STRAT_PALETTE[hash % STRAT_PALETTE.length]
}
