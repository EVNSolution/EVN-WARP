// 팀 표시 순서 고정 — 목록에 없는 팀은 뒤에 원래 순서대로 붙는다
export const TEAM_ORDER = ['PM팀', '제조운영팀', 'CLEVER팀', '사업개발팀', '마케팅팀', '경영관리팀']

export function teamOrderIndex(name: string): number {
  const i = TEAM_ORDER.indexOf(name)
  return i === -1 ? TEAM_ORDER.length : i
}
