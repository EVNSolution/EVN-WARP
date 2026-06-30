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
