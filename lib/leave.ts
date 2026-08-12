/**
 * 근로기준법 기준 연차 발생일수 근사 계산.
 * - 입사 1년 미만: 개근 시 매월 1일 발생 (최대 11일)
 * - 입사 1년 이상: 15일 + 2년마다 1일 가산, 최대 25일
 * 회계연도 구분 없이 "입사일로부터 현재까지 누적 발생" 기준의 근사치이며,
 * 실제 사규(회계연도 기준 등)와 다를 수 있어 실사용 중 조정이 필요할 수 있다.
 */
function monthsBetween(start: Date, end: Date): number {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) months -= 1
  return Math.max(0, months)
}

export function calcAnnualLeaveGranted(hireDate: Date, asOf: Date = new Date()): number {
  const months = monthsBetween(hireDate, asOf)
  const years = Math.floor(months / 12)
  if (years < 1) return Math.min(11, months)
  const granted = 15 + Math.floor((years - 1) / 2)
  return Math.min(25, granted)
}

export function tenureLabel(hireDate: Date, asOf: Date = new Date()): string {
  const months = monthsBetween(hireDate, asOf)
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  return years > 0 ? `${years}년 ${remMonths}개월` : `${remMonths}개월`
}
