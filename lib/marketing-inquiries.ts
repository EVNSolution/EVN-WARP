import { createHash } from 'node:crypto'

import type { PrismaClient } from '@/app/generated/prisma/client'
import { safeKeyEqual } from '@/lib/external-lookup/config'
import { digitsOnly } from '@/lib/external-lookup/match'
import { customerWrite, resolveCustomerId, type CustomerDb } from '@/lib/customer-alias'
import { normalizeCustomerMobile } from '@/lib/customer-mobile'
import pipelineChecklists from '@/data/pipeline-checklists.json'

export const MARKETING_LEAD_POLICY = 'customer-lead-v1'
const REGISTRATION_MARKER = `marketing:${MARKETING_LEAD_POLICY}`
const ASSIGNEE = '최도준'
// Confirmed against the production product manager; resolve its current active ID, never guess by substring.
const PRODUCT = { code: 'STEGO K1', name: 'PV5 오픈배드냉탑 (구변)', active: true }

const MAX_BODY_BYTES = 16 * 1024
const MIN_KEY_LENGTH = 32
const SOURCE = 'mleverage-admin'
const COMPANY_SCOPE_ID = '55f9a8bb-73f9-4316-bcd7-7dcdce0bdcc3'
const HOMEPAGE_SCOPE_ID = '5c7a6115-a0a9-4e8d-bf65-efce52195fa4'
const LANDING_SOURCE = 'evn-landing'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^(\d{2}):(\d{2})$/
const LANDING_TIME = /^(\d{2}):(\d{2}):(\d{2})$/
const NO_STORE = { 'Cache-Control': 'no-store' }

export type MarketingInquiry = {
  source: string
  companyScopeId: string
  homepageScopeId: string
  sourceId: string
  inquiryDate: string
  inquiryTime: string
  sourceStatus: string
  name: string
  phone: string
  rejectExistingCustomer?: true
  registrationPolicy?: typeof MARKETING_LEAD_POLICY
  landing?: { kind: 'consultation' | 'subsidy'; region: string | null; consentVersion: string; consentedAt: string }
}

type MarketingInquiryCheck = {
  source: string
  companyScopeId: string
  homepageScopeId: string
  items: Array<{ sourceId: string; phone: string }>
  registrationPolicy?: typeof MARKETING_LEAD_POLICY
}

type Receipt = {
  ok: true
  customerId: string
  activityId: string
  created: boolean
  duplicate: boolean
  registration?: { policy: typeof MARKETING_LEAD_POLICY; state: 'complete' | 'customer_only'; leadId: string | null; registeredAt: string }
}

class AmbiguousPhoneError extends Error {}
class PhoneExistsError extends Error {}
class LeadMappingError extends Error {}

function error(code: 'unauthorized' | 'not_configured' | 'bad_payload' | 'ambiguous_phone' | 'phone_exists' | 'temporarily_unavailable' | 'lead_mapping_unavailable', status: number) {
  return Response.json({ error: code }, { status, headers: NO_STORE })
}

export function readApiKey(env: Readonly<Record<string, string | undefined>>) {
  const key = env.WARP_MARKETING_API_KEY ?? ''
  return key.length >= MIN_KEY_LENGTH && !/\s/u.test(key) ? key : null
}

function authenticate(request: Request, env: Readonly<Record<string, string | undefined>>) {
  const apiKey = readApiKey(env)
  if (!apiKey) return error('not_configured', 503)
  const provided = request.headers.get('x-api-key') ?? ''
  return provided && safeKeyEqual(apiKey, provided) ? null : error('unauthorized', 401)
}

// Preserve legacy contact submissions while canonicalizing valid Korean mobiles like the CRM guard.
function normalizeMarketingPhone(value: string | null | undefined): string | null {
  const digits = digitsOnly(value)
  const mobile = digits.startsWith('0082') ? '+82' + digits.slice(4) : digits.startsWith('82') ? '+82' + digits.slice(2) : digits
  const phone = normalizeCustomerMobile(value) ?? normalizeCustomerMobile(mobile) ?? digits
  return /^\d{9,15}$/.test(phone) ? phone : null
}

export function allowedScope(value: Record<string, unknown>) {
  return (value.source === SOURCE && value.companyScopeId === COMPANY_SCOPE_ID && value.homepageScopeId === HOMEPAGE_SCOPE_ID)
    || (value.source === LANDING_SOURCE && value.companyScopeId === 'evnsolution' && value.homepageScopeId === 'pv5')
}

function validLanding(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const data = value as Record<string, unknown>
  return Object.keys(data).sort().join(',') === 'consentVersion,consentedAt,kind,region'
    && ((data.kind === 'consultation' && data.region === null) || (data.kind === 'subsidy' && typeof data.region === 'string' && ['서울', '경기', '인천'].includes(data.region)))
    && typeof data.consentVersion === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(data.consentVersion)
    && typeof data.consentedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(data.consentedAt)
    && Number.isFinite(Date.parse(data.consentedAt)) && new Date(data.consentedAt).toISOString() === data.consentedAt
}

function parseDateTime(date: string, time: string, landing: boolean): Date | null {
  const dateMatch = DATE.exec(date)
  const timeMatch = (landing ? LANDING_TIME : TIME).exec(time)
  if (!dateMatch || !timeMatch) return null
  const [, year, month, day] = dateMatch.map(Number)
  const [, hour, minute, second = 0] = timeMatch.map(Number)
  if (hour > 23 || minute > 59 || second > 59) return null
  const utc = new Date(Date.UTC(year, month - 1, day, hour - 9, minute, second))
  const seoul = new Date(utc.getTime() + 9 * 60 * 60 * 1000)
  return seoul.getUTCFullYear() === year && seoul.getUTCMonth() === month - 1 && seoul.getUTCDate() === day
    ? utc
    : null
}

function parsePayload(value: unknown): { payload: MarketingInquiry; occurredAt: Date } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const expected = ['source', 'companyScopeId', 'homepageScopeId', 'sourceId', 'inquiryDate', 'inquiryTime', 'sourceStatus', 'name', 'phone']
  const hasRejectFlag = Object.hasOwn(record, 'rejectExistingCustomer')
  const hasPolicy = Object.hasOwn(record, 'registrationPolicy')
  const landing = record.source === LANDING_SOURCE
  if (
    Object.keys(record).length !== expected.length + Number(hasRejectFlag) + Number(landing) + Number(hasPolicy) ||
    expected.some(key => typeof record[key] !== 'string') ||
    (hasRejectFlag && record.rejectExistingCustomer !== true) ||
    (hasPolicy && (record.registrationPolicy !== MARKETING_LEAD_POLICY || !hasRejectFlag)) ||
    (landing && (!hasRejectFlag || !validLanding(record.landing))) ||
    (!landing && Object.hasOwn(record, 'landing'))
  ) return null

  const payload = record as MarketingInquiry
  const occurredAt = parseDateTime(payload.inquiryDate, payload.inquiryTime, landing)
  const phoneDigits = normalizeMarketingPhone(payload.phone)
  if (
    !allowedScope(record) ||
    !UUID.test(payload.sourceId) ||
    !occurredAt ||
    payload.sourceStatus.length > 100 ||
    payload.name.length > 100 ||
    payload.phone.length > 40 ||
    !phoneDigits
  ) return null
  return { payload, occurredAt }
}

function parseCheckPayload(value: unknown): MarketingInquiryCheck | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const expected = ['source', 'companyScopeId', 'homepageScopeId', 'items']
  const hasPolicy = Object.hasOwn(record, 'registrationPolicy')
  if (Object.keys(record).length !== expected.length + Number(hasPolicy) || expected.some(key => !(key in record))
    || (hasPolicy && record.registrationPolicy !== MARKETING_LEAD_POLICY)) return null
  if (
    !allowedScope(record) ||
    !Array.isArray(record.items) ||
    record.items.length < 1 ||
    record.items.length > 50
  ) return null

  const sourceIds = new Set<string>()
  for (const item of record.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const row = item as Record<string, unknown>
    if (
      Object.keys(row).length !== 2 ||
      typeof row.sourceId !== 'string' ||
      typeof row.phone !== 'string' ||
      row.phone.length > 40 ||
      !UUID.test(row.sourceId)
    ) return null
    const sourceId = row.sourceId.toLowerCase()
    const phoneDigits = normalizeMarketingPhone(row.phone)
    if (sourceIds.has(sourceId) || !phoneDigits) return null
    sourceIds.add(sourceId)
  }
  return record as MarketingInquiryCheck
}

export function marketingInquiryActivityId(payload: Pick<MarketingInquiry, 'source' | 'companyScopeId' | 'homepageScopeId' | 'sourceId'>) {
  return `${payload.source === LANDING_SOURCE ? 'evn_landing' : 'mleverage'}_${createHash('sha256')
    .update([payload.source, payload.companyScopeId, payload.homepageScopeId, payload.sourceId.toLowerCase()].join(':'))
    .digest('hex')}`
}

export function marketingInquiryLeadId(activityId: string) { return `lead_${activityId}` }

export function marketingRegistrationMemo(at: Date) {
  return `${new Date(at.getTime() + 9 * 60 * 60_000).toISOString().slice(0, 10)} SNS 유입`
}

function activityContent(payload: MarketingInquiry) {
  return [
    payload.source === LANDING_SOURCE ? 'EV&Marketing 새 홈페이지 문의' : 'mleverage-admin 문의',
    `문의일자: ${payload.inquiryDate}`,
    `문의시간: ${payload.inquiryTime}`,
    `상담상태: ${payload.sourceStatus}`,
    `성함: ${payload.name}`,
    `연락처: ${payload.phone}`,
    `원본 문의 ID: ${payload.sourceId}`,
    ...(payload.landing ? [
      `상담 종류: ${payload.landing.kind === 'subsidy' ? '보조금 상담' : '구매 상담'}`,
      `지역: ${payload.landing.region ?? '미선택'}`,
      `개인정보 동의 버전: ${payload.landing.consentVersion}`,
      `개인정보 동의 시각: ${payload.landing.consentedAt}`,
    ] : []),
  ].join('\n')
}

function databaseErrorCode(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  return /^P\d{4}$/.test(code) ? code : 'unknown'
}

export async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  const body = new Uint8Array(MAX_BODY_BYTES)
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (size + value.byteLength > MAX_BODY_BYTES) {
        await reader.cancel()
        return null
      }
      body.set(value, size)
      size += value.byteLength
    }
  } catch {
    await reader.cancel().catch(() => {})
    return null
  }
  return body.subarray(0, size)
}

async function replayReceipt(transaction: CustomerDb, activity: { id: string; customerId: string; result: string | null; createdAt: Date }, policy?: typeof MARKETING_LEAD_POLICY): Promise<Receipt> {
  const customerId = await resolveCustomerId(transaction, activity.customerId)
  if (!await transaction.customer.findUnique({ where: { id: customerId }, select: { id: true } })) {
    throw new Error('Receipt customer unavailable')
  }
  const receipt: Receipt = { ok: true, customerId, activityId: activity.id, created: false, duplicate: true }
  if (policy) {
    const lead = activity.result === REGISTRATION_MARKER ? await transaction.salesDeal.findUnique({
      where: { id: marketingInquiryLeadId(activity.id) }, select: { id: true, customerId: true },
    }) : null
    // Retained legacy receipts and deleted/unlinked leads require review, never retroactive creation.
    const complete = lead?.customerId === customerId
    receipt.registration = { policy, state: complete ? 'complete' : 'customer_only', leadId: complete ? lead!.id : null,
      registeredAt: activity.createdAt.toISOString() }
  }
  return receipt
}

async function appendInquiry(prisma: PrismaClient, payload: MarketingInquiry, occurredAt: Date): Promise<Receipt> {
  const activityId = marketingInquiryActivityId(payload)
  // Share the merge writer reservation: never read a receipt or candidate before acquiring it.
  return customerWrite(prisma, async transaction => {
    const duplicate = await transaction.customerActivity.findUnique({
      where: { id: activityId },
      select: { id: true, customerId: true, result: true, createdAt: true },
    })
    if (duplicate) return replayReceipt(transaction, duplicate, payload.registrationPolicy)

    const phone = normalizeMarketingPhone(payload.phone)
    // ponytail: scans primary phones; add a normalized column/index if volume makes this slow.
    // Merges delete the source Customer; archived aliases are not separate candidates.
    const candidates = await transaction.customer.findMany({
      where: { phone: { not: null } },
      select: { id: true, phone: true },
    })
    const matches = candidates.filter(customer => normalizeMarketingPhone(customer.phone) === phone)
    if (matches.length > 1) throw new AmbiguousPhoneError()
    if (payload.rejectExistingCustomer && matches.length) throw new PhoneExistsError()
    if (payload.registrationPolicy) {
      const leads = await transaction.salesDeal.findMany({ where: { phone: { not: null } }, select: { phone: true } })
      if (leads.some(lead => normalizeMarketingPhone(lead.phone) === phone)) throw new PhoneExistsError()
    }

    let productId: string | undefined
    if (payload.registrationPolicy) {
      const products = await transaction.product.findMany({ where: PRODUCT, select: { id: true } })
      const assignees = await transaction.user.findMany({ where: { name: ASSIGNEE }, select: { id: true } })
      if (products.length !== 1 || assignees.length !== 1 || !pipelineChecklists['1-1'].length) throw new LeadMappingError()
      productId = products[0].id
    }
    // Created only in the successful writer transaction; retries read this retained time.
    const registeredAt = new Date()

    const customerId = matches[0]?.id ?? (await transaction.customer.create({
      data: {
        name: payload.name.trim(),
        phone: payload.phone,
        customerSegment: 'B2C',
        status: '잠재고객',
        source: payload.registrationPolicy ? '온라인' : payload.source,
        collectedAt: occurredAt,
      },
      select: { id: true },
    })).id

    await transaction.customerActivity.create({
      data: {
        id: activityId,
        customerId,
        type: '이벤트',
        date: occurredAt,
        content: activityContent(payload),
        ...(payload.registrationPolicy ? { result: REGISTRATION_MARKER, createdAt: registeredAt } : {}),
      },
      select: { id: true },
    })
    if (payload.registrationPolicy) {
      const leadId = marketingInquiryLeadId(activityId)
      await transaction.salesDeal.create({ data: {
        id: leadId, customerId, productId, name: payload.name.trim(), phone: payload.phone,
        customerSegment: 'B2C', source: '온라인', assignee: ASSIGNEE,
        collectedAt: occurredAt, memo: marketingRegistrationMemo(registeredAt),
        stage: '리드', stageCode: '1-1', salesStatus: '진행중', createdAt: registeredAt,
        checklistJson: JSON.stringify(Object.fromEntries(pipelineChecklists['1-1'].map(item => [item.key, true]))),
      } })
      // The existing UI uses productId for the selected model and stageCode for the pipeline.
      // Keep both stage transitions in the same transaction; logging failure must roll back everything.
      await transaction.stageHistory.create({ data: { dealId: leadId, fromStageCode: null, toStageCode: '1-1', changedBy: 'EV&Marketing', changedAt: registeredAt } })
      await transaction.salesDeal.update({ where: { id: leadId }, data: { stageCode: '1-2', stageChangedAt: registeredAt } })
      await transaction.stageHistory.create({ data: { dealId: leadId, fromStageCode: '1-1', toStageCode: '1-2', changedBy: 'EV&Marketing', changedAt: registeredAt } })
      return { ok: true, customerId, activityId, created: true, duplicate: false,
        registration: { policy: MARKETING_LEAD_POLICY, state: 'complete', leadId, registeredAt: registeredAt.toISOString() } }
    }
    // A new activity on an existing customer is neither a new customer nor a replay.
    return { ok: true, customerId, activityId, created: matches.length === 0, duplicate: false }
  })
}

export async function handleMarketingInquiryRequest(
  request: Request,
  prisma: PrismaClient,
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const authenticationError = authenticate(request, env)
  if (authenticationError) return authenticationError

  const bytes = await readBoundedBody(request)
  if (!bytes) return error('bad_payload', 400)

  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    return error('bad_payload', 400)
  }
  const validated = parsePayload(parsed)
  if (!validated) return error('bad_payload', 400)

  try {
    return Response.json(await appendInquiry(prisma, validated.payload, validated.occurredAt), { headers: NO_STORE })
  } catch (caught) {
    if (caught instanceof PhoneExistsError) return error('phone_exists', 409)
    if (caught instanceof AmbiguousPhoneError) return error('ambiguous_phone', 409)
    if (caught instanceof LeadMappingError) return error('lead_mapping_unavailable', 503)
    console.error('marketing_inquiry_failed', { code: databaseErrorCode(caught) })
    return error('temporarily_unavailable', 503)
  }
}

export async function handleMarketingInquiryCheckRequest(
  request: Request,
  prisma: PrismaClient,
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const authenticationError = authenticate(request, env)
  if (authenticationError) return authenticationError

  const bytes = await readBoundedBody(request)
  if (!bytes) return error('bad_payload', 400)

  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    return error('bad_payload', 400)
  }
  const payload = parseCheckPayload(parsed)
  if (!payload) return error('bad_payload', 400)

  try {
    // One read-only snapshot keeps receipt IDs, alias resolution and phone matches coherent across merges.
    const results = await prisma.$transaction(async transaction => {
      const activityIds = payload.items.map(item => marketingInquiryActivityId({ ...payload, sourceId: item.sourceId }))
      const activities = await transaction.customerActivity.findMany({
        where: { id: { in: activityIds } },
        select: { id: true, customerId: true, result: true, createdAt: true },
      })
      const customers = await transaction.customer.findMany({
        where: { phone: { not: null } },
        select: { phone: true },
      })
      const activityById = new Map(activities.map(activity => [activity.id, activity]))
      const phones = new Set(customers.map(customer => normalizeMarketingPhone(customer.phone)))
      if (payload.registrationPolicy) {
        // A legacy lead can have no Customer link; it still blocks another registration.
        const leads = await transaction.salesDeal.findMany({ where: { phone: { not: null } }, select: { phone: true } })
        for (const lead of leads) phones.add(normalizeMarketingPhone(lead.phone))
      }
      return Promise.all(payload.items.map(async item => {
        const activityId = marketingInquiryActivityId({ ...payload, sourceId: item.sourceId })
        const activity = activityById.get(activityId)
        if (activity) {
          return {
            sourceId: item.sourceId.toLowerCase(),
            exists: true,
            receipt: await replayReceipt(transaction, activity, payload.registrationPolicy),
          }
        }
        return { sourceId: item.sourceId.toLowerCase(), exists: phones.has(normalizeMarketingPhone(item.phone)) }
      }))
    })
    return Response.json({ ok: true, results }, { headers: NO_STORE })
  } catch (caught) {
    console.error('marketing_inquiry_check_failed', { code: databaseErrorCode(caught) })
    return error('temporarily_unavailable', 503)
  }
}
