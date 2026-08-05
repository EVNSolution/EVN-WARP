/**
 * 타임존 표기가 없는 로컬 날짜/시간 문자열(예: "2026-08-01T18:00:00")을
 * 한국 시간(KST, UTC+9)으로 해석해 Date로 변환한다.
 * 서버(EC2)의 기본 타임존이 UTC이므로 new Date()에 그대로 넘기면 시간이 어긋난다.
 */
export function toKstDate(value: string): Date {
  const hasOffset = /[Zz]|[+-]\d{2}:\d{2}$/.test(value)
  return new Date(hasOffset ? value : `${value}+09:00`)
}
