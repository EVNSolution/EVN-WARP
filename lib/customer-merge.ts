import { createHash } from 'node:crypto'
import type { Customer, PrismaClient } from '@/app/generated/prisma/client'
import { CustomerMergeError, customerWrite, resolveCustomerId, type CustomerDb } from './customer-alias'
import { normalizeCustomerMobile } from './customer-mobile'

export { CustomerMergeError, customerErrorResponse } from './customer-alias'

export async function requireMergeActor(db: CustomerDb, userId: string | undefined) {
  if (!userId) throw new CustomerMergeError(401, '로그인이 필요합니다.')
  const actor = await db.user.findUnique({
    where: { id: userId }, select: { id: true, name: true, role: true, employmentType: true },
  })
  if (!actor || actor.employmentType === '사외' || !['admin', 'ceo'].includes(actor.role)) {
    throw new CustomerMergeError(403, '사내 관리자 또는 대표만 고객 통합을 사용할 수 있습니다.')
  }
  return actor
}

type BusinessKey = Exclude<keyof Customer, 'id' | 'createdAt' | 'updatedAt'>
const LABELS = {
  name: '고객명', phone: '휴대전화', email: '이메일', customerSegment: 'B2B/B2C', customerCategory: '고객 유형',
  status: '고객 상태', grade: '등급', tags: '태그', source: '유입 경로', collectedAt: '수집일', referrer: '추천인',
  leadType: '리드 유형', assignee: '담당자', isAgent: '소개자 여부', memo: '메모', birthYear: '출생연도',
  regionCity: '시도', regionDist: '시군구', gender: '성별', birthInfo: '생년 정보', maritalStatus: '혼인 상태',
  childrenCount: '자녀 수', addressDetail: '상세 주소', isSoleProprietor: '개인사업자 여부', soleBusinessName: '상호',
  soleBusinessNo: '개인사업자 등록번호', soleBusinessType: '개인사업자 업종', b2bCategory: '법인 구분',
  companyName: '회사명', businessRegNo: '사업자 등록번호', contactTitle: '직책', industry: '업종',
  companyAddress: '회사 주소', companyPhone: '회사 전화', employeeCount: '직원 수', mainContactCardUrl: '대표 명함',
  contactsJson: '법인 관계자', hasVehicle: '차량 보유 여부', vehicleMaker: '제작사', vehicleName: '차량명',
  vehiclePlateNo: '차량번호', vehicleYear: '연식', totalMileage: '주행거리', truckType1: '특장 구분 1',
  truckType2: '특장 구분 2', truckType3: '특장 구분 3', truckType4: '특장 구분 4', vehicleCount: '차량 대수',
  vehicleListJson: '차량 목록', documentsJson: '첨부 문서', b2bRevenue1: '1년 전 매출', b2bRevenue2: '2년 전 매출',
  b2bRevenue3: '3년 전 매출', shipperName: '화주명', cargoType: '화물 유형', deliveryCity: '배송 시도',
  deliveryDist: '배송 시군구', deliveryFreq: '배송 빈도', workShift: '근무 시간', monthlyIncome: '월 수익', cargoNote: '화물 메모',
} satisfies Record<BusinessKey, string>
const ARRAY_KEYS = new Set<BusinessKey>(['tags', 'contactsJson', 'vehicleListJson', 'documentsJson'])

function stable(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']'
  if (value !== null && typeof value === 'object') {
    return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => JSON.stringify(key) + ':' + stable(val)).join(',') + '}'
  }
  return JSON.stringify(value)
}
const empty = (v: unknown) => v == null || (typeof v === 'string' && !v.trim())
const unknownName = (name: string) => /^(?:신원\s*)?미상(?:\s*\([^]*\))?$/.test(name.trim())

export function parseCustomerArray(value: string | null, label: string): unknown[] {
  if (value == null || value === '') return []
  try {
    const array: unknown = JSON.parse(value)
    if (Array.isArray(array)) return array
  } catch { /* fail closed; do not replace corrupted metadata with an empty array */ }
  throw new CustomerMergeError(409, `${label} 형식이 올바르지 않습니다. 원본을 확인한 뒤 다시 시도해 주세요.`)
}

export type MergeField = {
  key: BusinessKey; label: string; keepValue: unknown; removeValue: unknown; resultValue: unknown
  mode: 'same' | 'fill' | 'automatic' | 'conflict'; requiresChoice: boolean
}

export function customerMergeFields(keep: Customer, remove: Customer): MergeField[] {
  return (Object.keys(LABELS) as BusinessKey[]).map(key => {
    const a = keep[key], b = remove[key]
    let resultValue: unknown = a
    let mode: MergeField['mode'] = 'same'
    if (ARRAY_KEYS.has(key)) {
      const left = parseCustomerArray(a as string | null, LABELS[key])
      const right = parseCustomerArray(b as string | null, LABELS[key])
      const union = [...left]
      const seen = new Set(left.map(stable))
      for (const item of right) if (!seen.has(stable(item))) { seen.add(stable(item)); union.push(item) }
      if (key === 'contactsJson') {
        const ids = new Set<string>()
        for (let index = 0; index < union.length; index++) {
          const item = union[index]
          if (!item || typeof item !== 'object' || Array.isArray(item)) continue
          const contact = item as Record<string, unknown>
          if (typeof contact.id !== 'string') continue
          let id = contact.id
          if (ids.has(id)) {
            const suffix = createHash('sha256').update(stable({ contact, source: remove.id })).digest('hex').slice(0, 16)
            id = `${contact.id}-merge-${suffix}`
            while (ids.has(id)) id += '-2'
            union[index] = { ...contact, id }
          }
          ids.add(id)
        }
      }
      if (stable(union) !== stable(left)) {
        mode = left.length ? 'automatic' : 'fill'
        resultValue = JSON.stringify(union)
      }
    } else if (stable(a) === stable(b) || empty(b)) {
      // Retain the exact stored value, including false and zero.
    } else if (empty(a)) {
      resultValue = b; mode = 'fill'
    } else if (key === 'phone') {
      mode = 'automatic' // equality of normalized mobile was checked before this function
    } else if (key === 'name' && unknownName(keep.name) !== unknownName(remove.name)) {
      resultValue = unknownName(keep.name) ? b : a; mode = 'automatic'
    } else if (key === 'memo' || key === 'cargoNote') {
      resultValue = `[유지 고객: ${keep.name} / ${keep.id}]\n${a}\n\n[통합 고객: ${remove.name} / ${remove.id}]\n${b}`
      mode = 'automatic'
    } else {
      resultValue = null; mode = 'conflict'
    }
    return { key, label: LABELS[key], keepValue: a, removeValue: b, resultValue, mode, requiresChoice: mode === 'conflict' }
  })
}

function validIds(keepId: unknown, removeId: unknown): asserts keepId is string {
  if (typeof keepId !== 'string' || typeof removeId !== 'string' || !keepId || !removeId
    || keepId.length > 128 || removeId.length > 128 || keepId === removeId) {
    throw new CustomerMergeError(400, '서로 다른 두 고객을 선택해 주세요.')
  }
}

async function snapshot(db: CustomerDb, keepId: string, removeId: string) {
  const keep = await db.customer.findUnique({ where: { id: keepId } })
  const remove = await db.customer.findUnique({ where: { id: removeId } })
  if (!keep || !remove) throw new CustomerMergeError(409, '고객 정보가 변경되었습니다. 미리보기를 다시 확인해 주세요.')
  const mobile = normalizeCustomerMobile(keep.phone)
  if (!mobile || mobile !== normalizeCustomerMobile(remove.phone)) {
    throw new CustomerMergeError(409, '같은 유효한 휴대전화 번호의 고객만 통합할 수 있습니다.')
  }
  const where = { customerId: { in: [keepId, removeId] } }
  const orderBy = { id: 'asc' as const }
  const leads = await db.salesDeal.findMany({ where, orderBy, include: {
    meetings: { orderBy }, stageHistory: { orderBy }, documents: { orderBy }, shares: { orderBy },
  } })
  const activities = await db.customerActivity.findMany({ where, orderBy })
  const agents = await db.agent.findMany({ where, orderBy })
  const events = await db.buildupEvent.findMany({ where: { warpCustomerId: { in: [keepId, removeId] } }, orderBy })
  const aliases = await db.customerMerge.findMany({
    where: { targetId: { in: [keepId, removeId] } }, orderBy: { sourceId: 'asc' },
    select: { sourceId: true, targetId: true },
  })
  return { keep, remove, leads, activities, agents, events, aliases }
}
type Snapshot = Awaited<ReturnType<typeof snapshot>>
const tokenFor = (state: Snapshot, actorId: string) => 'v1.' + createHash('sha256').update(stable({ actorId, state })).digest('hex')

function preview(state: Snapshot, actorId: string) {
  return {
    keep: { id: state.keep.id, name: state.keep.name }, remove: { id: state.remove.id, name: state.remove.name },
    previewToken: tokenFor(state, actorId), fields: customerMergeFields(state.keep, state.remove),
    counts: {
      leads: state.leads.filter(row => row.customerId === state.remove.id).length,
      activities: state.activities.filter(row => row.customerId === state.remove.id).length,
      agents: state.agents.filter(row => row.customerId === state.remove.id).length,
      events: state.events.filter(row => row.warpCustomerId === state.remove.id).length,
    },
    warnings: ['리드는 각각 유지되며 고객 연결만 변경됩니다. 단계·가격·상담·활동 이력은 보존됩니다.',
      '양쪽 고객 원본과 선택 결과는 관리자용 감사 기록에 보존됩니다. 첨부 파일 경로는 변경하지 않습니다.',
      '서로 다른 배열 항목은 모두 보존하며, 충돌하는 관계자 ID는 새 ID로 구분합니다. 관계자·첨부 목록을 확인해 주세요.'],
  }
}

export async function previewCustomerMerge(db: PrismaClient, actorId: string | undefined, keepId: string, removeId: string) {
  return customerWrite(db, async tx => {
    const actor = await requireMergeActor(tx, actorId)
    validIds(keepId, removeId)
    return preview(await snapshot(tx, keepId, removeId), actor.id)
  })
}

type ConfirmBody = { keepId: string; removeId: string; previewToken: string; choices: Record<string, 'keep' | 'remove'>; confirmed: true }
function confirmBody(body: unknown): ConfirmBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CustomerMergeError(400, '요청 내용을 확인해 주세요.')
  const b = body as Record<string, unknown>
  validIds(b.keepId, b.removeId)
  if (typeof b.previewToken !== 'string' || !/^v1\.[a-f0-9]{64}$/.test(b.previewToken)) {
    throw new CustomerMergeError(409, '미리보기가 유효하지 않습니다. 다시 확인해 주세요.')
  }
  if (b.confirmed !== true || !b.choices || typeof b.choices !== 'object' || Array.isArray(b.choices)
    || Object.keys(b).some(key => !['keepId', 'removeId', 'previewToken', 'choices', 'confirmed'].includes(key))
    || Object.entries(b.choices).some(([key, value]) => !Object.hasOwn(LABELS, key) || (value !== 'keep' && value !== 'remove'))) {
    throw new CustomerMergeError(400, '필드 선택과 통합 확인이 필요합니다.')
  }
  return b as ConfirmBody
}

export async function confirmCustomerMerge(db: PrismaClient, actorId: string | undefined, body: unknown) {
  return customerWrite(db, async tx => {
    const actor = await requireMergeActor(tx, actorId)
    const b = confirmBody(body)
    const old = await tx.customerMerge.findUnique({ where: { sourceId: b.removeId } })
    if (old) {
      if (old.targetId !== b.keepId || old.actorId !== actor.id || old.previewToken !== b.previewToken || old.choicesJson !== stable(b.choices)) {
        throw new CustomerMergeError(409, '이미 통합된 고객입니다. 고객 목록을 다시 확인해 주세요.')
      }
      return { ok: true, message: '고객 통합이 완료되었습니다.', customerId: await resolveCustomerId(tx, old.targetId) }
    }
    const state = await snapshot(tx, b.keepId, b.removeId)
    if (b.previewToken !== tokenFor(state, actor.id)) throw new CustomerMergeError(409, '미리보기 이후 정보가 변경되었습니다. 다시 확인해 주세요.')
    const fields = customerMergeFields(state.keep, state.remove)
    if (fields.some(field => field.requiresChoice && !Object.hasOwn(b.choices, field.key))
      || Object.keys(b.choices).some(key => !fields.some(field => field.key === key && field.requiresChoice))) {
      throw new CustomerMergeError(400, '충돌하는 모든 필드에서 유지할 값을 선택해 주세요.')
    }
    const data = Object.fromEntries(fields.map(field => [field.key, field.requiresChoice
      ? (b.choices[field.key] === 'keep' ? field.keepValue : field.removeValue) : field.resultValue]))
    // Archive BOTH original scalar records and complete related state before any mutation.
    await tx.customerMerge.create({ data: {
      sourceId: b.removeId, targetId: b.keepId, actorId: actor.id, actorName: actor.name,
      previewToken: b.previewToken, choicesJson: stable(b.choices), snapshotJson: stable(state),
    } })
    await tx.customer.update({ where: { id: b.keepId }, data })
    // Raw FK-only updates intentionally preserve deal/agent updatedAt and every business field.
    await tx.$executeRaw`UPDATE "SalesDeal" SET "customerId" = ${b.keepId} WHERE "customerId" = ${b.removeId}`
    await tx.$executeRaw`UPDATE "CustomerActivity" SET "customerId" = ${b.keepId} WHERE "customerId" = ${b.removeId}`
    await tx.$executeRaw`UPDATE "Agent" SET "customerId" = ${b.keepId} WHERE "customerId" = ${b.removeId}`
    await tx.$executeRaw`UPDATE "BuildupEvent" SET "warpCustomerId" = ${b.keepId} WHERE "warpCustomerId" = ${b.removeId}`
    await tx.customer.delete({ where: { id: b.removeId } })
    return { ok: true, message: '고객 통합이 완료되었습니다.', customerId: b.keepId }
  })
}

export async function findCustomerDuplicates(db: PrismaClient, actorId: string | undefined) {
  return db.$transaction(async tx => {
    await requireMergeActor(tx, actorId)
    const customers = await tx.customer.findMany({
      select: { id: true, name: true, phone: true, status: true, createdAt: true, _count: { select: { leads: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    const leads = await tx.salesDeal.findMany({
      select: { id: true, name: true, phone: true, customerId: true, stageCode: true, stage: true, salesStatus: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    function grouped<T extends { phone: string | null }>(rows: T[]) {
      const result = new Map<string, T[]>()
      for (const row of rows) {
        const phone = normalizeCustomerMobile(row.phone)
        if (phone) result.set(phone, [...(result.get(phone) ?? []), row])
      }
      return result
    }
    const groups = [...grouped(customers)].filter(([, rows]) => rows.length > 1).map(([phone, rows]) => ({
      phone, name: rows[0].name, customers: rows.map(({ _count, ...row }) => ({ ...row, leadCount: _count.leads })),
    }))
    const byId = new Map(customers.map(row => [row.id, row]))
    const leadGroups = [...grouped(leads)].filter(([phone, rows]) => rows.length > 1 || rows.some(row =>
      row.customerId && normalizeCustomerMobile(byId.get(row.customerId)?.phone) !== phone)).map(([phone, rows]) => ({
      phone, name: rows[0].name, informational: true, classification: 'repeated_leads' as const,
      crossCustomer: new Set(rows.map(row => row.customerId).filter(Boolean)).size > 1,
      associationMismatch: rows.some(row => row.customerId && normalizeCustomerMobile(byId.get(row.customerId)?.phone) !== phone),
      leads: rows,
    }))
    return { total: customers.length, dupCount: groups.reduce((sum, group) => sum + group.customers.length - 1, 0),
      groupCount: groups.length, groups, leadTotal: leads.length, leadGroupCount: leadGroups.length,
      leadDupCount: leadGroups.reduce((sum, group) => sum + Math.max(0, group.leads.length - 1), 0), leadGroups }
  })
}
