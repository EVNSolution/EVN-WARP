import 'server-only'
import { prisma } from './db'
import { depositQueue } from './sales-process'

export async function readDepositQueue() {
  const deals = await prisma.salesDeal.findMany({
    where:{stageCode:{in:['2-1','2-2','2-3','3-1','3-2','3-3']}},
    select:{id:true,name:true,assignee:true,stageCode:true,salesStatus:true,deliveredAt:true,
      customerSegment:true,customer:{select:{customerSegment:true}},salesProcessJson:true},
  })
  return {deals,positions:depositQueue(deals)}
}
export function auditSummary(before: string, after: string): string {
  try {
    const a=JSON.parse(before), b=JSON.parse(after), changes:string[]=[]
    if(a.stage!==b.stage) changes.push(`단계 ${a.stage} → ${b.stage}`)
    for(const [field,label] of [['finalQuote','최종 견적'],['deposit','계약금']] as const){
      const old=a.process[field], next=b.process[field]
      for(const [key,title] of [['date','날짜'],['time','시각'],['amountWon','금액(원)'],['model','모델'],['spec','주요 사양'],['status','입금 상태']] as const){
        if(old[key]!==next[key]) changes.push(`${label} ${title}: ${old[key] || '미확인'} → ${next[key] || '미확인'}`)
      }
      if(old.documentId!==next.documentId) changes.push(`${label} 증빙 변경`)
      if(old.reviewPending!==next.reviewPending) changes.push(next.reviewPending?'순번 재검토 필요':'순번 검토 완료')
    }
    return changes.join(' · ') || '상담 상태 또는 체크 기록 변경'
  }catch{return '영업 절차 기록'}
}
