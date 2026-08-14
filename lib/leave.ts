/**
 * 회사 기준(회계연도 = 1/1~12/31) 연차 발생일수 계산.
 * - 입사 연도(회계연도 도중 입사): 입사월부터 그해 12월까지 개근 시 매월 1일 비례 발생, 최대 11일
 * - 입사 다음 회계연도(1/1)부터: 15일을 일괄 부여, 이후 2년마다 1일씩 가산, 최대 25일
 *   (가산 기준 "연차"는 입사연도 기준 몇 번째 회계연도인지로 계산 — 예: 2024년 입사 시
 *    2025년=15일, 2026년=15일, 2027년=16일...)
 */
function monthsBetween(start: Date, end: Date): number {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) months -= 1
  return Math.max(0, months)
}

export function calcAnnualLeaveGranted(hireDate: Date, asOf: Date = new Date()): number {
  const hireYear = hireDate.getFullYear()
  const fiscalYear = asOf.getFullYear()

  // 입사 연도: 입사월부터 그해 말까지 개근 비례 (최대 11일)
  if (fiscalYear <= hireYear) {
    const months = monthsBetween(hireDate, asOf)
    return Math.min(11, months)
  }

  // 입사 다음 회계연도부터: 몇 번째 회계연도인지로 가산 연차 계산
  const nthFiscalYear = fiscalYear - hireYear
  const granted = 15 + Math.floor((nthFiscalYear - 1) / 2)
  return Math.min(25, granted)
}

export function tenureLabel(hireDate: Date, asOf: Date = new Date()): string {
  const months = monthsBetween(hireDate, asOf)
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  return years > 0 ? `${years}년 ${remMonths}개월` : `${remMonths}개월`
}
