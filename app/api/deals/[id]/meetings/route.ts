import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const meetings = await prisma.$queryRaw<any[]>`
    SELECT * FROM LeadMeeting WHERE dealId = ${id} ORDER BY meetingAt DESC
  `
  return NextResponse.json(meetings)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const b = await req.json()
    const newId = randomUUID()
    const meetingAt = b.meetingAt ? new Date(b.meetingAt).toISOString() : new Date().toISOString()
    const isPlan = b.isPlan ? 1 : 0

    await prisma.$executeRaw`
      INSERT INTO LeadMeeting (id, dealId, type, meetingAt, isPlan, content, assignee, filesJson, createdAt, updatedAt)
      VALUES (${newId}, ${id}, ${b.type || '기타'}, ${meetingAt}, ${isPlan},
              ${b.content || null}, ${b.assignee || null}, ${b.filesJson || null},
              ${new Date().toISOString()}, ${new Date().toISOString()})
    `
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM LeadMeeting WHERE id = ${newId}`
    return NextResponse.json(rows[0] ?? {}, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '생성 실패' }, { status: 500 })
  }
}
