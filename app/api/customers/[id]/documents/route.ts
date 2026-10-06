import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { customerWrite, customerErrorResponse, CustomerMergeError, requireCurrentCustomerId } from '@/lib/customer-alias'
import { parseCustomerArray } from '@/lib/customer-merge'
import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'node:crypto'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads')
type DocMeta = { type: string; name: string; path: string; size: number; uploadedAt: string }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await requireCurrentCustomerId(prisma, id)
    const form = await req.formData()
    const file = form.get('file') as File | null
    const docType = form.get('type') as string | null
    if (!file || !docType) return NextResponse.json({ error: '파일과 문서 유형이 필요합니다.' }, { status: 400 })
    const uploadDir = path.join(UPLOADS_DIR, 'customers', id)
    await fs.mkdir(uploadDir, { recursive: true })
    const safeName = `${randomUUID()}_${file.name.replace(/[^\w.\-]/g, '_')}`
    await fs.writeFile(path.join(uploadDir, safeName), Buffer.from(await file.arrayBuffer()))
    const doc: DocMeta = { type: docType, name: file.name, path: `/api/uploads/customers/${id}/${safeName}`,
      size: file.size, uploadedAt: new Date().toISOString() }
    return await customerWrite(prisma, async tx => {
      // Re-read after upload; another writer may have merged the customer or appended metadata.
      await requireCurrentCustomerId(tx, id)
      const customer = await tx.customer.findUniqueOrThrow({ where: { id } })
      const docs = parseCustomerArray(customer.documentsJson, '첨부 문서')
      const updated = [...docs, doc]
      await tx.customer.update({ where: { id }, data: { documentsJson: JSON.stringify(updated) } })
      return NextResponse.json({ doc, docs: updated })
    })
  } catch (error) { return customerErrorResponse(error) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const docType = req.nextUrl.searchParams.get('type')
    if (!docType) return NextResponse.json({ error: '문서 유형이 필요합니다.' }, { status: 400 })
    return await customerWrite(prisma, async tx => {
      await requireCurrentCustomerId(tx, id)
      const customer = await tx.customer.findUniqueOrThrow({ where: { id } })
      const docs = parseCustomerArray(customer.documentsJson, '첨부 문서') as DocMeta[]
      if (docs.filter(d => d?.type === docType).length > 1) {
        throw new CustomerMergeError(409, '같은 유형의 문서가 여러 개입니다. 개별 문서를 확인해 주세요.')
      }
      await tx.customer.update({ where: { id }, data: { documentsJson: JSON.stringify(docs.filter(d => d?.type !== docType)) } })
      // Physical files may be referenced by immutable merge snapshots; retain their original paths.
      return NextResponse.json({ ok: true })
    })
  } catch (error) { return customerErrorResponse(error) }
}
