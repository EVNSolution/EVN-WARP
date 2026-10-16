import { CustomerMergeError, type CustomerDb } from './customer-alias'
import { getStageCode } from './pipeline'
import { emptySalesProcess, readSalesProcess, transitionError, quoteError, validDate, koreaToday, type SalesProcessData, isGateComplete } from './sales-process'

function fail(message: string): never { throw new CustomerMergeError(400, message) }
export function parseProcessInput(input: unknown): SalesProcessData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('영업 절차 입력을 확인해 주세요.')
  const p = input as SalesProcessData, blank = emptySalesProcess()
  if (!['신규 문의','상담 대기','부재중 대기'].includes(p.inquiryStatus)) fail('상담 대기 상태를 확인해 주세요.')
  for (const field of ['finalQuote','deposit'] as const) {
    const part = p[field]
    if (!part || typeof part !== 'object' || Array.isArray(part)) fail('견적·입금 기록을 확인해 주세요.')
    for (const [key, value] of Object.entries(blank[field])) {
      const v = (part as unknown as Record<string, unknown>)[key]
      if (typeof value === 'string' && (typeof v !== 'string' || v.length > 500)) fail('입력값은 500자 이내로 입력해 주세요.')
    }
    if (part.amountWon !== null && (!Number.isSafeInteger(part.amountWon) || part.amountWon < 0)) fail('금액은 원 단위의 0 이상 정수로 입력해 주세요.')
    if (part.date && (!validDate(part.date) || part.date > koreaToday())) fail('실제 확인 날짜를 입력해 주세요. 미래 날짜는 사용할 수 없습니다.')
  }
  if (typeof p.callbackAt !== 'string' || p.callbackAt.length > 30 || (p.callbackAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(p.callbackAt))) fail('재연락 일시를 확인해 주세요.')
  if (!['unpaid','paid','refunded','cancelled'].includes(p.deposit.status) || typeof p.deposit.reviewPending !== 'boolean') fail('계약금 상태를 확인해 주세요.')
  if (p.deposit.time && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(p.deposit.time)) fail('입금시각을 확인해 주세요.')
  // Whitelist fields: clients cannot append actor, history, or arbitrary payloads.
  // Accept an older open screen's status, but save the current two-choice value.
  return { inquiryStatus: p.inquiryStatus === '신규 문의' ? '상담 대기' : p.inquiryStatus, callbackAt: p.callbackAt,
    finalQuote: { date:p.finalQuote.date, model:p.finalQuote.model.trim(), spec:p.finalQuote.spec.trim(), amountWon:p.finalQuote.amountWon, documentId:p.finalQuote.documentId },
    deposit: { status:p.deposit.status, date:p.deposit.date, time:p.deposit.time, model:p.deposit.model.trim(), spec:p.deposit.spec.trim(), amountWon:p.deposit.amountWon, documentId:p.deposit.documentId, reviewPending:p.deposit.reviewPending } }
}
export function parseChecks(value: unknown): Record<string, boolean | string> {
  try {
    const p = value ? JSON.parse(String(value)) : {}
    if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).length > 500 ||
      Object.entries(p).some(([k,v]) => k.length > 150 || (typeof v !== 'boolean' && typeof v !== 'string'))) fail('체크 기록 형식을 확인해 주세요.')
    return p
  } catch { return fail('체크 기록 형식을 확인해 주세요.') }
}

export async function prepareSalesProcessWrite(tx: CustomerDb, id: string, b: Record<string, unknown>, actor: {id:string;name:string}, isAdmin:boolean) {
  const current = await tx.salesDeal.findUnique({ where:{id}, include:{ customer:{select:{customerSegment:true}} } })
  if (!current) throw new CustomerMergeError(404, '리드를 찾을 수 없습니다.')
  if (!isAdmin && current.assignee !== actor.name) throw new CustomerMergeError(403, '담당 리드만 수정할 수 있습니다.')
  const segment = current.customer?.customerSegment ?? current.customerSegment
  const from = current.stageCode ?? getStageCode(current.stage)
  if (b.stageCode !== undefined && (typeof b.stageCode !== 'string' || !b.stageCode)) fail('유효한 영업 단계를 선택해 주세요.')
  const to = typeof b.stageCode === 'string' ? b.stageCode : from
  const previous = readSalesProcess(current.salesProcessJson)
  const process = b.salesProcess === undefined ? previous : parseProcessInput(b.salesProcess)
  const checks = parseChecks(b.checklistJson === undefined ? current.checklistJson : b.checklistJson)
  if (segment === 'B2B') {
    if (b.salesProcess !== undefined) fail('B2B는 기존 절차를 사용합니다.')
    return { current, data: {} }
  }
  if (b.stage !== undefined && b.stage !== current.stage && b.stageCode === undefined) fail('단계 코드를 함께 확인해 주세요.')
  if (b.customerSegment === 'B2B' && to !== from) fail('고객 유형과 단계는 동시에 변경할 수 없습니다.')
  const changed = JSON.stringify(process) !== JSON.stringify(previous)
  const protectedChange = changed || to !== from || (b.checklistJson !== undefined && b.checklistJson !== current.checklistJson)
  if (protectedChange && b.salesProcessRevision !== current.salesProcessRevision)
    throw new CustomerMergeError(409, '다른 변경이 있거나 이전 화면입니다. 새로고침 후 다시 확인해 주세요.')
  const reason = typeof b.salesProcessReason === 'string' ? b.salesProcessReason.trim().slice(0,1000) : ''
  if (changed) {
    const hadQuote = Object.values(previous.finalQuote).some(v => v !== '' && v !== null)
    const hadDeposit = previous.deposit.status !== 'unpaid' || previous.deposit.amountWon !== null || !!(previous.deposit.date || previous.deposit.time || previous.deposit.model || previous.deposit.spec || previous.deposit.documentId)
    if (((hadQuote && JSON.stringify(process.finalQuote) !== JSON.stringify(previous.finalQuote)) ||
      (hadDeposit && JSON.stringify(process.deposit) !== JSON.stringify(previous.deposit))) && !reason) fail('견적·입금 기록 수정 사유를 남겨 주세요.')
    const oldDeposit = previous.deposit, newDeposit = process.deposit
    const oldFacts = {...oldDeposit,reviewPending:false}
    const newFacts = {...newDeposit,reviewPending:false}
    if (oldDeposit.status !== 'unpaid' && JSON.stringify(oldFacts) !== JSON.stringify(newFacts)) newDeposit.reviewPending = true
    if (oldDeposit.reviewPending && !newDeposit.reviewPending && !reason) fail('순번 검토 결과를 수정 사유에 남겨 주세요.')
    for (const [docId, allowed] of [[process.finalQuote.documentId, ['quotation','initial_quotation','final_quotation']], [process.deposit.documentId,['evn_deposit_slip']]] as const) {
      if (!docId) continue
      const doc = await tx.dealDocument.findFirst({ where:{id:docId,dealId:id},select:{docKey:true} })
      if (!doc || !(allowed as readonly string[]).includes(doc.docKey)) fail('이 리드에 저장된 견적서 또는 EV& 계약금 송금 증빙을 선택해 주세요.')
    }
  }
  const priorChecks = parseChecks(current.checklistJson)
  if (isGateComplete(checks['1-3-confirmed']) && (!isGateComplete(priorChecks['1-3-confirmed']) || changed)) {
    const error = quoteError(process); if (error) fail(error)
  }
  const error = transitionError(segment, from, to, checks, process)
  if (error) fail(error)
  if (!protectedChange) return {current, data:{}}
  await tx.salesProcessAudit.create({data:{id:crypto.randomUUID(),dealId:id,actorId:actor.id,actorName:actor.name,
    reason: reason || '영업 절차 확인',
    beforeJson:JSON.stringify({stage:from,process:previous,checks:priorChecks}),
    afterJson:JSON.stringify({stage:to,process,checks}),
  }})
  return {current,data:{salesProcessJson:JSON.stringify(process),salesProcessRevision:{increment:1}}}
}
