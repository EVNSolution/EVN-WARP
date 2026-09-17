import { createHash } from 'node:crypto'

import type { PrismaClient } from '@/app/generated/prisma/client'
import { safeKeyEqual } from '@/lib/external-lookup/config'
import { digitsOnly } from '@/lib/external-lookup/match'
import { unknownCustomerName } from '@/lib/format'

const MAX_BODY_BYTES = 16 * 1024
const MIN_KEY_LENGTH = 32
const SOURCE = 'mleverage-admin'
const COMPANY_SCOPE_ID = '55f9a8bb-73f9-4316-bcd7-7dcdce0bdcc3'
const HOMEPAGE_SCOPE_ID = '5c7a6115-a0a9-4e8d-bf65-efce52195fa4'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^(\d{2}):(\d{2})$/
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
}

type Receipt = {
  ok: true
  customerId: string
  activityId: string
  created: boolean
  duplicate: boolean
}

class AmbiguousPhoneError extends Error {}

function error(code: 'unauthorized' | 'not_configured' | 'bad_payload' | 'ambiguous_phone' | 'temporarily_unavailable', status: number) {
  return Response.json({ error: code }, { status, headers: NO_STORE })
}

function readApiKey(env: Readonly<Record<string, string | undefined>>) {
  const key = env.WARP_MARKETING_API_KEY ?? ''
  return key.length >= MIN_KEY_LENGTH && !/\s/u.test(key) ? key : null
}

function parseDateTime(date: string, time: string): Date | null {
  const dateMatch = DATE.exec(date)
  const timeMatch = TIME.exec(time)
  if (!dateMatch || !timeMatch) return null
  const [, year, month, day] = dateMatch.map(Number)
  const [, hour, minute] = timeMatch.map(Number)
  if (hour > 23 || minute > 59) return null
  const utc = new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0))
  const seoul = new Date(utc.getTime() + 9 * 60 * 60 * 1000)
  return seoul.getUTCFullYear() === year && seoul.getUTCMonth() === month - 1 && seoul.getUTCDate() === day
    ? utc
    : null
}

function parsePayload(value: unknown): { payload: MarketingInquiry; occurredAt: Date } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  const expected = ['source', 'companyScopeId', 'homepageScopeId', 'sourceId', 'inquiryDate', 'inquiryTime', 'sourceStatus', 'name', 'phone']
  if (keys.length !== expected.length || expected.some(key => typeof record[key] !== 'string')) return null

  const payload = record as MarketingInquiry
  const occurredAt = parseDateTime(payload.inquiryDate, payload.inquiryTime)
  const phoneDigits = digitsOnly(payload.phone)
  if (
    payload.source !== SOURCE ||
    payload.companyScopeId !== COMPANY_SCOPE_ID ||
    payload.homepageScopeId !== HOMEPAGE_SCOPE_ID ||
    !UUID.test(payload.sourceId) ||
    !occurredAt ||
    payload.sourceStatus.length > 100 ||
    payload.name.length > 100 ||
    payload.phone.length > 40 ||
    phoneDigits.length < 9 ||
    phoneDigits.length > 15
  ) return null
  return { payload, occurredAt }
}

export function marketingInquiryActivityId(payload: MarketingInquiry) {
  return `mleverage_${createHash('sha256')
    .update([payload.source, payload.companyScopeId, payload.homepageScopeId, payload.sourceId.toLowerCase()].join(':'))
    .digest('hex')}`
}

function activityContent(payload: MarketingInquiry) {
  return [
    'mleverage-admin 문의',
    `문의일자: ${payload.inquiryDate}`,
    `문의시간: ${payload.inquiryTime}`,
    `상담상태: ${payload.sourceStatus}`,
    `성함: ${payload.name}`,
    `연락처: ${payload.phone}`,
    `원본 문의 ID: ${payload.sourceId}`,
  ].join('\n')
}

function databaseErrorCode(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  return /^P\d{4}$/.test(code) ? code : 'unknown'
}

function retryable(error: unknown) {
  const code = databaseErrorCode(error)
  const message = error instanceof Error ? error.message : ''
  return code === 'P2002' || code === 'P2034' || code === 'P1008' || /SQLITE_BUSY|database is locked/i.test(message)
}

async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
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

async function appendInquiry(prisma: PrismaClient, payload: MarketingInquiry, occurredAt: Date): Promise<Receipt> {
  const activityId = marketingInquiryActivityId(payload)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await prisma.$transaction(async transaction => {
        // Reserve the SQLite writer before reading; deferred read-to-write upgrades can deadlock across clients.
        // Retry asynchronously instead of blocking the Node event loop while another client holds the writer.
        await transaction.$executeRaw`PRAGMA busy_timeout = 0`
        await transaction.$executeRaw`UPDATE "CustomerActivity" SET "id" = "id" WHERE 0`
        const duplicate = await transaction.customerActivity.findUnique({
          where: { id: activityId },
          select: { id: true, customerId: true },
        })
        if (duplicate) {
          return { ok: true, customerId: duplicate.customerId, activityId: duplicate.id, created: false, duplicate: true }
        }

        const phoneDigits = digitsOnly(payload.phone)
        // ponytail: scans primary phones because SQLite cannot apply the shared JS normalizer; add a normalized column if volume makes this slow.
        const candidates = await transaction.customer.findMany({
          where: { phone: { not: null } },
          select: { id: true, phone: true },
        })
        const matches = candidates.filter(customer => digitsOnly(customer.phone) === phoneDigits)
        if (matches.length > 1) throw new AmbiguousPhoneError()

        const customerId = matches[0]?.id ?? (await transaction.customer.create({
          data: {
            name: payload.name.trim() || unknownCustomerName({ phone: payload.phone }),
            phone: payload.phone,
            customerSegment: 'B2C',
            status: '잠재고객',
            source: SOURCE,
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
          },
          select: { id: true },
        })
        return { ok: true, customerId, activityId, created: true, duplicate: false }
      })
    } catch (error) {
      if (error instanceof AmbiguousPhoneError) throw error
      if (!retryable(error) || attempt === 3) throw error
      await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)))
    }
  }
  throw new Error('unreachable')
}

export async function handleMarketingInquiryRequest(
  request: Request,
  prisma: PrismaClient,
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const apiKey = readApiKey(env)
  if (!apiKey) return error('not_configured', 503)
  const provided = request.headers.get('x-api-key') ?? ''
  if (!provided || !safeKeyEqual(apiKey, provided)) return error('unauthorized', 401)

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
    if (caught instanceof AmbiguousPhoneError) return error('ambiguous_phone', 409)
    console.error('marketing_inquiry_failed', { code: databaseErrorCode(caught), retryable: retryable(caught) })
    return error('temporarily_unavailable', 503)
  }
}
