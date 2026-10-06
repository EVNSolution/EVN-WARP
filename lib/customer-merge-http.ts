import type { PrismaClient } from '@/app/generated/prisma/client'
import { confirmCustomerMerge, customerErrorResponse, CustomerMergeError, previewCustomerMerge, requireMergeActor } from './customer-merge'

const headers = { 'Cache-Control': 'no-store' }
const MAX_BODY_BYTES = 16 * 1024

async function boundedJson(req: Request): Promise<unknown> {
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new CustomerMergeError(415, 'JSON 형식으로 요청해 주세요.')
  }
  if (Number(req.headers.get('content-length')) > MAX_BODY_BYTES) {
    throw new CustomerMergeError(413, '요청 내용이 너무 큽니다.')
  }
  const reader = req.body?.getReader()
  if (!reader) throw new CustomerMergeError(400, '요청 내용이 필요합니다.')
  const bytes = new Uint8Array(MAX_BODY_BYTES)
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (size + value.byteLength > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new CustomerMergeError(413, '요청 내용이 너무 큽니다.')
      }
      bytes.set(value, size); size += value.byteLength
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size)))
  } catch (error) {
    if (error instanceof CustomerMergeError) throw error
    throw new CustomerMergeError(400, 'JSON 요청 내용을 확인해 주세요.')
  } finally { reader.releaseLock() }
}

type OriginEnvironment = Readonly<Record<string, string | undefined>>

function publicOrigin(req: Request, env: OriginEnvironment) {
  const configured = env.AUTH_URL ?? env.NEXTAUTH_URL
  if (configured === undefined) return new URL(req.url).origin
  try {
    const url = new URL(configured)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error()
    return url.origin
  } catch { throw new CustomerMergeError(503, '서비스 공개 주소 설정을 확인해 주세요.') }
}

export async function handleCustomerMergeRequest(
  req: Request, db: PrismaClient, actorId: string | undefined, env: OriginEnvironment = process.env,
) {
  try {
    await requireMergeActor(db, actorId)
    if (req.method === 'GET') {
      const query = new URL(req.url).searchParams
      return Response.json(await previewCustomerMerge(db, actorId, query.get('keepId') ?? '', query.get('removeId') ?? ''), { headers })
    }
    if (req.method !== 'POST') throw new CustomerMergeError(405, '지원하지 않는 요청 방식입니다.')
    // Session cookies alone are insufficient: reject cross-site and origin-less write requests.
    if (req.headers.get('origin') !== publicOrigin(req, env) || req.headers.get('sec-fetch-site') === 'cross-site') {
      throw new CustomerMergeError(403, '현재 화면에서 미리보기를 확인한 뒤 요청해 주세요.')
    }
    return Response.json(await confirmCustomerMerge(db, actorId, await boundedJson(req)), { headers })
  } catch (error) { return customerErrorResponse(error) }
}
