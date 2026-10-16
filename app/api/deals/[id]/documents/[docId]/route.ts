import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canViewAllLeads } from '@/lib/permissions'
import { customerWrite, customerErrorResponse, CustomerMergeError } from '@/lib/customer-alias'
import { readSalesProcess } from '@/lib/sales-process'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads')

// DELETE /api/deals/[id]/documents/[docId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params

  const session=await auth()
  if (!session?.user?.id) return NextResponse.json({error:'로그인이 필요합니다.'},{status:401})
  const isAdmin=await canViewAllLeads(session.user.id)
  let doc
  try {
    doc=await customerWrite(prisma,async tx=>{
      const deal=await tx.salesDeal.findUnique({where:{id},select:{assignee:true,salesProcessJson:true}})
      if(!deal) throw new CustomerMergeError(404,'리드를 찾을 수 없습니다.')
      if(!isAdmin && deal.assignee!==session.user!.name) throw new CustomerMergeError(403,'담당 리드만 수정할 수 있습니다.')
      const doc=await tx.dealDocument.findUnique({where:{id:docId}})
      if(!doc || doc.dealId!==id) throw new CustomerMergeError(404,'문서를 찾을 수 없습니다.')
      const process=readSalesProcess(deal.salesProcessJson)
      const used=await tx.salesProcessAudit.findFirst({where:{dealId:id,OR:[{beforeJson:{contains:docId}},{afterJson:{contains:docId}}]},select:{id:true}})
      if(used || [process.finalQuote.documentId,process.deposit.documentId].includes(docId))
        throw new CustomerMergeError(409,'견적 확정·계약금 확인 이력의 증빙은 보존해야 합니다. 수정 자료를 새로 업로드해 주세요.')
      await tx.dealDocument.delete({where:{id:docId}})
      return doc
    })
  }catch(error){return customerErrorResponse(error)}

  // 신규 경로(/api/uploads/...)는 UPLOADS_DIR 기준, 구 경로(/uploads/...)는 public/ 기준으로 해석
  const relPath = doc.filePath.startsWith('/api/uploads/')
    ? doc.filePath.slice('/api/uploads/'.length)
    : null
  const absPath = relPath
    ? path.join(/* turbopackIgnore: true */ UPLOADS_DIR, relPath)
    : path.join(process.cwd(), 'public', doc.filePath)
  if (existsSync(absPath)) {
    await unlink(absPath).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
