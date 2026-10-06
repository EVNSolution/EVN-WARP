/** Domestic mobiles, including legacy 011/016/017/018/019; punctuation other than spaces/hyphens is invalid. */
export function normalizeCustomerMobile(value: string | null | undefined): string | null {
  if (!value) return null
  let phone = value.replace(/[\s-]/g, '')
  if (phone.startsWith('+82')) phone = '0' + phone.slice(3).replace(/^0/, '')
  else if (phone.startsWith('0082')) phone = '0' + phone.slice(4).replace(/^0/, '')
  return /^(?:010\d{8}|01[16789]\d{7,8})$/.test(phone) ? phone : null
}
