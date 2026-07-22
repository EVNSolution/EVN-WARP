import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const { mid } = await params
  await prisma.leadMeeting.delete({ where: { id: mid } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const { mid } = await params
  const b = await req.json()
  const meetingAt = b.meetingAt ? new Date(b.meetingAt).toISOString() : new Date().toISOString()
  const duration  = b.duration  != null && b.duration !== '' ? Number(b.duration)  : null

  await prisma.$executeRaw`
    UPDATE LeadMeeting SET
      type       = ${b.type || '기타'},
      meetingAt  = ${meetingAt},
      duration   = ${duration},
      content    = ${b.content    || null},
      result     = ${b.result     || null},
      nextAction = ${b.nextAction || null},
      assignee   = ${b.assignee   || null},
      isPlan     = ${b.isPlan ? 1 : 0}
    WHERE id = ${mid}
  `

  const rows = await prisma.$queryRaw<any[]>`SELECT * FROM LeadMeeting WHERE id = ${mid}`
  return NextResponse.json(rows[0] ?? {})
}
