/**
 * 외부 고객조회 매칭·변환 순수 함수.
 *
 * 매칭 키 = 이름 완전일치 + 전화번호 숫자 완전일치.
 * SQLite 에서는 하이픈을 제거한 비교 쿼리를 못 쓰므로, 이름으로 좁힌 뒤 JS 에서
 * 전화번호를 정규화(digitsOnly)해 거른다.
 *
 * ⚠️ 응답 DTO 는 **화이트리스트**다. memo·grade·tags·assignee·매출·화주정보·contactsJson 등
 *    내부 정보는 외부로 내보내지 않는다 — 필드를 더할 때는 유출 여부를 먼저 따질 것.
 */

/** 전화번호 정규화 — 숫자만 남긴다(하이픈·공백·괄호 무관). */
export function digitsOnly(v: string | null | undefined): string {
  return (v ?? '').replace(/\D/g, '')
}

/** 정규화한 전화번호가 완전일치하는 고객만 남긴다. */
export function filterByPhone<T extends { phone: string | null }>(
  customers: readonly T[],
  phoneDigits: string,
): T[] {
  if (!phoneDigits) return []
  return customers.filter(c => digitsOnly(c.phone) === phoneDigits)
}

/** 외부(buildup-ev)로 내보내는 고객 필드 — 이 목록 밖의 값은 절대 싣지 않는다. */
export interface ExternalCustomerDto {
  name: string
  phone: string | null
  email: string | null
  customerSegment: string | null
  birthInfo: string | null
  birthYear: number | null
  regionCity: string | null
  regionDist: string | null
  addressDetail: string | null
  isSoleProprietor: boolean | null
  soleBusinessName: string | null
  soleBusinessNo: string | null
  soleBusinessType: string | null
  companyName: string | null
  businessRegNo: string | null
  companyAddress: string | null
  companyPhone: string | null
  hasVehicle: boolean | null
  vehicleMaker: string | null
  vehicleName: string | null
  vehiclePlateNo: string | null
  vehicleYear: string | null
  truckType1: string | null
  truckType2: string | null
  truckType3: string | null
  truckType4: string | null
}

/** Customer 행 → 외부 DTO. 명시적으로 필드를 골라 담아 초과 필드 유출을 막는다. */
export function toExternalDto(c: ExternalCustomerDto & Record<string, unknown>): ExternalCustomerDto {
  return {
    name: c.name,
    phone: c.phone,
    email: c.email,
    customerSegment: c.customerSegment,
    birthInfo: c.birthInfo,
    birthYear: c.birthYear,
    regionCity: c.regionCity,
    regionDist: c.regionDist,
    addressDetail: c.addressDetail,
    isSoleProprietor: c.isSoleProprietor,
    soleBusinessName: c.soleBusinessName,
    soleBusinessNo: c.soleBusinessNo,
    soleBusinessType: c.soleBusinessType,
    companyName: c.companyName,
    businessRegNo: c.businessRegNo,
    companyAddress: c.companyAddress,
    companyPhone: c.companyPhone,
    hasVehicle: c.hasVehicle,
    vehicleMaker: c.vehicleMaker,
    vehicleName: c.vehicleName,
    vehiclePlateNo: c.vehiclePlateNo,
    vehicleYear: c.vehicleYear,
    truckType1: c.truckType1,
    truckType2: c.truckType2,
    truckType3: c.truckType3,
    truckType4: c.truckType4,
  }
}
