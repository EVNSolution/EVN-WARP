const NUMERIC_SUBTYPES = new Set(['금액', '인원수', '건수', '대수', '비율'])

export type KpiItemLike = {
  id?: string
  type: string
  subType: string | null
  label: string
  target: string
  targetNum: number | null
  unit: string | null
}

// 동일 라벨+단위의 KPI를 그룹핑 — 수치형은 targetNum 합산, 비수치형은 값 나열
export function aggregateKpiItems(items: KpiItemLike[]): KpiItemLike[] {
  const groups = new Map<string, KpiItemLike[]>()
  for (const item of items) {
    const key = `${item.label}::${item.unit ?? ''}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }

  return [...groups.values()].map(group => {
    const first = group[0]
    const isNumeric = first.type === '정량' && first.subType != null && NUMERIC_SUBTYPES.has(first.subType)
    if (isNumeric) {
      const sum = group.reduce((s, i) => s + (i.targetNum ?? 0), 0)
      return { ...first, targetNum: sum, target: sum.toLocaleString('ko-KR') }
    }
    const distinctTargets = [...new Set(group.map(i => i.target).filter(Boolean))]
    return { ...first, targetNum: null, target: distinctTargets.join(' / ') }
  })
}

export function aggregateDateRange(items: { startDate: Date | null; endDate: Date | null }[]): {
  startDate: Date | null
  endDate: Date | null
} {
  const starts = items.map(i => i.startDate).filter((d): d is Date => d != null)
  const ends = items.map(i => i.endDate).filter((d): d is Date => d != null)
  return {
    startDate: starts.length ? new Date(Math.min(...starts.map(d => d.getTime()))) : null,
    endDate: ends.length ? new Date(Math.max(...ends.map(d => d.getTime()))) : null,
  }
}
