/**
 * 숫자만 추출해 한국 전화번호 형식으로 변환
 * 010-1234-5678 / 02-1234-5678 / 0XX-123-4567
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''

  if (digits.startsWith('02')) {
    if (digits.length <= 2)  return digits
    if (digits.length <= 5)  return `${digits.slice(0, 2)}-${digits.slice(2)}`
    if (digits.length <= 9)  return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
    return                          `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  if (digits.length <= 3)  return digits
  if (digits.length <= 6)  return `${digits.slice(0, 3)}-${digits.slice(3)}`
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return                          `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

/**
 * 차량번호 끝자리(4자리 숫자) 앞에 띄어쓰기가 있는지 확인.
 * 4자리로 끝나지 않는 값(빈 값, 형식 다름 등)은 검사하지 않고 통과시킨다.
 */
export function hasPlateSpacing(value: string): boolean {
  const trimmed = value.trim()
  const m = trimmed.match(/^(.*?)(\d{4})$/)
  if (!m) return true
  const prefix = m[1]
  return prefix.length === 0 || prefix.endsWith(' ')
}

/** 차량번호에서 끝 4자리 숫자만 추출 (구분 형태와 무관하게 동작) */
export function plateLast4(value: string): string {
  return value.replace(/\D/g, '').slice(-4)
}
