import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { customerWrite, customerErrorResponse, CustomerMergeError, requireCurrentCustomerId } from '@/lib/customer-alias'
import { parseCustomerArray } from '@/lib/customer-merge'
import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'node:crypto'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads')
type Contact = { id: string; cardUrl: string | null }

async function saveCard(id: string, contactId: string | null, url: string | null) {
  return customerWrite(prisma, async tx => {
    await requireCurrentCustomerId(tx, id)
    const customer = await tx.customer.findUniqueOrThrow({ where: { id } })
    if (contactId) {
      const contacts = parseCustomerArray(customer.contactsJson, '법인 관계자') as Contact[]
      if (contacts.filter(c => c?.id === contactId).length !== 1) {
        throw new CustomerMergeError(409, '관계자 정보가 중복되거나 변경되었습니다. 목록을 먼저 확인해 주세요.')
      }
      await tx.customer.update({ where: { id }, data: {
        contactsJson: JSON.stringify(contacts.map(c => c?.id === contactId ? { ...c, cardUrl: url } : c)),
      } })
    } else {
      await tx.customer.update({ where: { id }, data: { mainContactCardUrl: url } })
    }
    // Preserve previous files, including paths referenced by archived customer snapshots.
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await requireCurrentCustomerId(prisma, id)
    const form = await req.formData()
    const file = form.get('file') as File | null
    const contactId = form.get('contactId') as string | null
    if (!file) return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 })
    const uploadDir = path.join(UPLOADS_DIR, 'customers', id, 'contacts')
    await fs.mkdir(uploadDir, { recursive: true })
    const safeName = `${randomUUID()}_${file.name.replace(/[^\w.\-]/g, '_')}`
    await fs.writeFile(path.join(uploadDir, safeName), Buffer.from(await file.arrayBuffer()))
    const url = `/api/uploads/customers/${id}/contacts/${safeName}`
    await saveCard(id, contactId, url)
    return NextResponse.json({ url })
  } catch (error) { return customerErrorResponse(error) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await saveCard(id, req.nextUrl.searchParams.get('contactId'), null)
    return NextResponse.json({ ok: true })
  } catch (error) { return customerErrorResponse(error) }
}
