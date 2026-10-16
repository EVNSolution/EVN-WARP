import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { canViewAllLeads } from '@/lib/permissions'
import { CustomerMergeError, customerErrorResponse, customerWrite, requireCurrentCustomerId } from '@/lib/customer-alias'
import { prepareSalesProcessWrite, parseChecks } from '@/lib/sales-process-write'
import { readSalesProcess } from '@/lib/sales-process'
import { fetchLinkedQuotes, fetchLinkedQuote } from '@/lib/buildup-import/quotes-client'
import { quotePreview } from '@/lib/buildup-import/quotes'
import { BuildupImportError } from '@/lib/buildup-import/client'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads')
async function context(id: string) {
  const session = await auth()
  if (!session?.user?.id || !session.user.name) throw new CustomerMergeError(401, '로그인이 필요합니다.')
  const actor = { id:session.user.id, name:session.user.name }
  const admin = await canViewAllLeads(actor.id)
  const deal = await prisma.salesDeal.findUnique({where:{id},include:{customer:{select:{customerSegment:true}}}})
  if (!deal) throw new CustomerMergeError(404, '리드를 찾을 수 없습니다.')
  if (!admin && deal.assignee !== actor.name) throw new CustomerMergeError(403, '담당 리드만 조회·변경할 수 있습니다.')
  if ((deal.customer?.customerSegment ?? deal.customerSegment) === 'B2B' || deal.stageCode !== '1-3')
    throw new CustomerMergeError(409, 'B2C 성숙리드에서 견적서를 선택해 주세요.')
  if (!deal.customerId) throw new CustomerMergeError(409, '먼저 이 리드를 WARP 고객과 연결해 주세요.')
  await requireCurrentCustomerId(prisma, deal.customerId)
  return {deal,actor,admin,customerId:deal.customerId}
}
function errorResponse(e: unknown) {
  if (e instanceof BuildupImportError) return NextResponse.json({error:e.message},{status:e.status === 409 ? 409 : 502})
  return customerErrorResponse(e)
}
export async function GET(req: NextRequest, {params}: {params:Promise<{id:string}>}) {
  try {
    const {id} = await params, {customerId} = await context(id)
    const raw = req.nextUrl.searchParams.get('quoteId')
    if (raw === null) return NextResponse.json(await fetchLinkedQuotes(customerId), {headers:{'Cache-Control':'no-store'}})
    const quoteId = Number(raw)
    if (!Number.isSafeInteger(quoteId) || quoteId <= 0) throw new CustomerMergeError(400, '견적서를 선택해 주세요.')
    return NextResponse.json(quotePreview(await fetchLinkedQuote(customerId, quoteId)), {headers:{'Cache-Control':'no-store'}})
  } catch(e) { return errorResponse(e) }
}
export async function POST(req: NextRequest, {params}: {params:Promise<{id:string}>}) {
  let writtenPath: string | undefined
  try {
    const {id} = await params, ctx = await context(id)
    const origin = new URL(process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? req.url).origin
    if (req.headers.get('origin') !== origin || req.headers.get('sec-fetch-site') === 'cross-site')
      throw new CustomerMergeError(403, '현재 화면에서 다시 요청해 주세요.')
    const body = await req.json()
    if (!Number.isSafeInteger(body.quoteId) || body.quoteId <= 0 || typeof body.version !== 'string' ||
      !/^[a-f0-9]{64}$/.test(body.version) || body.revision !== ctx.deal.salesProcessRevision)
      throw new CustomerMergeError(409, '화면 또는 견적이 변경되었습니다. 새로고침 후 다시 선택해 주세요.')
    const q = await fetchLinkedQuote(ctx.customerId, body.quoteId)
    if (q.version !== body.version) throw new CustomerMergeError(409, '미리보기 이후 견적 수치가 변경되었습니다. 다시 조회해 주세요.')
    const storedName = `${randomUUID()}.pdf`, dir = path.join(UPLOADS_DIR, 'deals', id)
    await mkdir(dir, {recursive:true})
    writtenPath = path.join(dir, storedName)
    await writeFile(writtenPath, Buffer.from(q.pdfBase64, 'base64'), {flag:'wx'})
    const result = await customerWrite(prisma, async tx => {
      const current = await tx.salesDeal.findUniqueOrThrow({where:{id}})
      await requireCurrentCustomerId(tx, ctx.customerId)
      if (current.customerId !== ctx.customerId || current.stageCode !== '1-3' || current.salesProcessRevision !== body.revision)
        throw new CustomerMergeError(409, '리드 또는 고객 연결이 변경되었습니다. 다시 조회해 주세요.')
      const document = await tx.dealDocument.create({data:{dealId:id,stageCode:'1-3',docKey:'final_quotation',
        docLabel:'BuildUP EV 최종 견적서',fileName:`BuildUP_EV_${q.quoteNo ?? q.quoteId}.pdf`,storedName,
        filePath:`/api/uploads/deals/${id}/${storedName}`,fileSize:Buffer.byteLength(q.pdfBase64,'base64'),mimeType:'application/pdf'}})
      const process = readSalesProcess(current.salesProcessJson)
      // Importing a quote does not establish customer agreement or advance the lead.
      process.finalQuote = {date:'',model:q.model,spec:q.spec,amountWon:q.amountWon,grossAmountWon:q.grossAmountWon,documentId:document.id}
      const checks = {...parseChecks(current.checklistJson),'1-3-confirmed':false}
      const update = await prepareSalesProcessWrite(tx,id,{salesProcess:process,checklistJson:JSON.stringify(checks),
        salesProcessRevision:body.revision,salesProcessReason:body.reason},ctx.actor,ctx.admin,
        {quoteId:q.quoteId,quoteNo:q.quoteNo,version:q.version,pdfSha256:q.pdfSha256,updatedAt:q.updatedAt,frozen:q.frozen})
      const saved = await tx.salesDeal.update({where:{id},data:{...update.data,checklistJson:JSON.stringify(checks)}})
      return {document,salesProcess:readSalesProcess(saved.salesProcessJson),revision:saved.salesProcessRevision,checks}
    })
    writtenPath = undefined
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}})
  } catch(e) {
    if (writtenPath) await unlink(writtenPath).catch(()=>{})
    return errorResponse(e)
  }
}
