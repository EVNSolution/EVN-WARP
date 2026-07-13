import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const meetings = await prisma.leadMeeting.findMany({
    where: { dealId: id },
    orderBy: { meetingAt: 'desc' },
  })
  return NextResponse.json(meetings)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const b = await req.json()
    const meeting = await prisma.leadMeeting.create({
      data: {
        dealId:     id,
        type:       b.type       || '기타',
        meetingAt:  b.meetingAt  ? new Date(b.meetingAt) : new Date(),
        duration:   b.duration   ?? null,
        content:          b.content          || null,
        result:           b.result           || null,
        nextAction:       b.nextAction       || null,
        assignee:         b.assignee         || null,
        filesJson:        b.filesJson        || null,
        expenseTransport: b.expenseTransport ? Number(b.expenseTransport) : null,
        expenseAccomm:    b.expenseAccomm    ? Number(b.expenseAccomm)    : null,
        expenseMeal:      b.expenseMeal      ? Number(b.expenseMeal)      : null,
        expenseOther:     b.expenseOther     ? Number(b.expenseOther)     : null,
        expenseNote:      b.expenseNote      || null,
      },
    })
    return NextResponse.json(meeting, { status: 201 })
  } catch {
    return NextResponse.json({ error: '생성 실패' }, { status: 500 })
  }
}
