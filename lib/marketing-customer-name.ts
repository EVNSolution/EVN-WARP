import { createHash, createHmac } from 'node:crypto'

import type { PrismaClient } from '@/app/generated/prisma/client'
import { customerWrite, resolveCustomerId, type CustomerDb } from '@/lib/customer-alias'
import { normalizeCustomerMobile } from '@/lib/customer-mobile'
import { safeKeyEqual } from '@/lib/external-lookup/config'
import { allowedScope, readApiKey, readBoundedBody } from '@/lib/marketing-inquiries'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TOKEN_TTL = 10 * 60_000
const CAPABILITY = 'customer.unknown-name.enrich'
const HEADERS = { 'Cache-Control': 'no-store' }
const customerSelect = { id: true, name: true, phone: true, updatedAt: true } as const
type Customer = { id: string; name: string; phone: string | null; updatedAt: Date }
type Input = {
  action: 'preview' | 'confirm'
  source: string
  companyScopeId: string
  homepageScopeId: string
  sourceId: string
  phone: string
  name: string
  actor: { id: string; name: string }
  previewToken?: string
}
type Preview = { version: 1; binding: string; customerId: string; snapshot: string; issuedAt: number; expiresAt: number }
type ErrorCode = 'invalid_request' | 'unauthorized' | 'not_configured' | 'invalid_preview' | 'stale_preview' | 'temporarily_unavailable'

function failure(error: ErrorCode, status: number) {
  return Response.json({ ok: false, error }, { status, headers: HEADERS })
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value === value.trim() && value.length > 0 && value.length <= max
    && !/[\p{Cc}\p{Cf}]/u.test(value)
}

function unknownName(name: string, phone: string) {
  const trimmed = name.trim()
  return !trimmed || trimmed === '-' || /^(?:신원\s*)?미상(?:\s*\([^()\r\n]*\))?$/u.test(trimmed)
    || normalizeCustomerMobile(trimmed) === phone
}

function parse(value: unknown): Input | null {
  if (!object(value) || !allowedScope(value) || (value.action !== 'preview' && value.action !== 'confirm')) return null
  const fields = ['action', 'source', 'companyScopeId', 'homepageScopeId', 'sourceId', 'phone', 'name', 'actor']
  if (value.action === 'confirm') fields.push('previewToken')
  if (Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field))) return null
  if (typeof value.sourceId !== 'string' || !UUID.test(value.sourceId)
    || !text(value.phone, 40) || !text(value.name, 100)
    || !object(value.actor) || Object.keys(value.actor).sort().join(',') !== 'id,name'
    || !text(value.actor.id, 128) || !text(value.actor.name, 100)
    || (value.action === 'confirm' && !text(value.previewToken, 2048))) return null
  const phone = normalizeCustomerMobile(value.phone)
  if (!phone || unknownName(value.name, phone) || /^[+\d().\s-]+$/u.test(value.name)) return null
  return { ...value, sourceId: value.sourceId.toLowerCase(), phone } as Input
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const snapshot = (customer: Customer) => hash([customer.name, customer.updatedAt.toISOString()])
const binding = (input: Input) => hash([
  CAPABILITY, input.source, input.companyScopeId, input.homepageScopeId, input.sourceId,
  input.phone, input.name, input.actor.id, input.actor.name,
])
const signature = (encoded: string, key: string) => createHmac('sha256', key).update(`${CAPABILITY}:${encoded}`).digest('base64url')

function sign(input: Input, customer: Customer, key: string, now: number) {
  const preview: Preview = {
    version: 1, binding: binding(input), customerId: customer.id, snapshot: snapshot(customer),
    issuedAt: now, expiresAt: now + TOKEN_TTL,
  }
  const encoded = Buffer.from(JSON.stringify(preview)).toString('base64url')
  return `${encoded}.${signature(encoded, key)}`
}

function verify(input: Input, key: string, now: number): Preview | null {
  const parts = input.previewToken!.split('.')
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))
    || !safeKeyEqual(signature(parts[0], key), parts[1])) return null
  try {
    const token = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    if (!object(token) || token.version !== 1 || typeof token.binding !== 'string' || !/^[a-f0-9]{64}$/.test(token.binding)
      || !text(token.customerId, 128) || typeof token.snapshot !== 'string' || !/^[a-f0-9]{64}$/.test(token.snapshot)
      || typeof token.issuedAt !== 'number' || !Number.isSafeInteger(token.issuedAt)
      || typeof token.expiresAt !== 'number' || token.expiresAt !== token.issuedAt + TOKEN_TTL
      || token.issuedAt > now || token.expiresAt <= now) return null
    return token as Preview
  } catch { return null }
}

async function matches(db: Pick<CustomerDb, 'customer'>, phone: string) {
  const customers = await db.customer.findMany({ select: customerSelect, where: { phone: { not: null } } })
  return customers.filter(customer => normalizeCustomerMobile(customer.phone) === phone)
}

function customerDto(customer: Customer, phone: string) {
  return { id: customer.id, name: customer.name, phone }
}

async function preview(db: PrismaClient, input: Input, key: string, now: number) {
  return db.$transaction(async tx => {
    const customers = await matches(tx, input.phone)
    if (customers.length !== 1) return { ok: true, status: customers.length ? 'ambiguous' : 'not_found', proposedName: input.name }
    const customer = customers[0]
    if (await resolveCustomerId(tx, customer.id) !== customer.id) {
      return { ok: true, status: 'ambiguous', proposedName: input.name }
    }
    const status = customer.name.trim() === input.name ? 'same_name' : unknownName(customer.name, input.phone) ? 'ready' : 'already_named'
    return {
      ok: true, status, customer: customerDto(customer, input.phone), proposedName: input.name,
      ...(status === 'ready' ? { previewToken: sign(input, customer, key, now) } : {}),
    }
  })
}

async function confirm(db: PrismaClient, input: Input, token: Preview, now: Date) {
  return customerWrite(db, async tx => {
    if (token.expiresAt <= Date.now()) return failure('invalid_preview', 400)
    const customers = await matches(tx, input.phone)
    const customer = customers[0]
    if (customers.length !== 1 || customer.id !== token.customerId
      || await resolveCustomerId(tx, token.customerId) !== token.customerId) return failure('stale_preview', 409)
    const auditId = `marketing_name_${hash(input.previewToken)}`
    const prior = await tx.customerActivity.findUnique({ where: { id: auditId } })
    if (prior) {
      let receipt: Record<string, unknown> | null = null
      try { const parsed: unknown = JSON.parse(prior.result ?? ''); if (object(parsed)) receipt = parsed } catch {}
      if (prior.customerId !== customer.id || receipt?.capability !== CAPABILITY || receipt.binding !== token.binding
        || receipt.afterName !== input.name || receipt.updatedAt !== customer.updatedAt.toISOString()
        || customer.name !== input.name) return failure('stale_preview', 409)
      return Response.json({ ok: true, status: 'unchanged', customer: customerDto(customer, input.phone), proposedName: input.name, auditId }, { headers: HEADERS })
    }
    if (snapshot(customer) !== token.snapshot || !unknownName(customer.name, input.phone)) return failure('stale_preview', 409)
    if (token.expiresAt <= Date.now()) return failure('invalid_preview', 400)
    const updated = await tx.customer.update({ where: { id: customer.id }, data: { name: input.name }, select: customerSelect })
    await tx.customerActivity.create({ data: {
      id: auditId, customerId: customer.id, type: '기타', date: now, createdAt: now, assignee: input.actor.name,
      content: [
        'EV&Marketing 고객 이름 보완 (사용자 확인)',
        `변경 전 이름: ${customer.name || '(공란)'}`, `변경 후 이름: ${input.name}`,
        `출처: ${input.source} / ${input.companyScopeId} / ${input.homepageScopeId}`,
        `원본 문의 ID: ${input.sourceId}`, `요청자: ${input.actor.name} (${input.actor.id})`, `변경 시각: ${now.toISOString()}`,
      ].join('\n'),
      result: JSON.stringify({ capability: CAPABILITY, binding: token.binding, beforeName: customer.name,
        afterName: input.name, updatedAt: updated.updatedAt.toISOString() }),
    } })
    return Response.json({ ok: true, status: 'updated', customer: customerDto(updated, input.phone), proposedName: input.name, auditId }, { headers: HEADERS })
  })
}

export async function handleMarketingCustomerNameRequest(
  request: Request, db: PrismaClient, env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const key = readApiKey(env)
  if (!key) return failure('not_configured', 503)
  const supplied = request.headers.get('x-api-key') ?? ''
  if (!supplied || !safeKeyEqual(key, supplied)) return failure('unauthorized', 401)
  const bytes = await readBoundedBody(request)
  if (!bytes) return failure('invalid_request', 400)
  let input: Input | null
  try { input = parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))) } catch { return failure('invalid_request', 400) }
  if (!input) return failure('invalid_request', 400)
  const now = new Date()
  const token = input.action === 'confirm' ? verify(input, key, now.getTime()) : null
  if (input.action === 'confirm' && !token) return failure('invalid_preview', 400)
  if (token && token.binding !== binding(input)) return failure('stale_preview', 409)
  try {
    return token ? await confirm(db, input, token, now)
      : Response.json(await preview(db, input, key, now.getTime()), { headers: HEADERS })
  } catch {
    return failure('temporarily_unavailable', 503)
  }
}
