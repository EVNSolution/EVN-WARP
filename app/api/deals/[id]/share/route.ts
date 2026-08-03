import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/createNotification'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id: dealId } = await params
  const body = await req.json()
  const mode: string = body.mode
  const teamId: string | undefined = body.teamId
  const userName: string | undefined = body.userName

  const deal = await prisma.salesDeal.findUnique({ where: { id: dealId }, select: { id: true, name: true } })
  if (!deal) return NextResponse.json({ error: '리드를 찾을 수 없습니다' }, { status: 404 })

  const link      = `/funnel/${dealId}`
  const sharedBy  = me.name ?? '알 수 없음'
  let targetTeam: string | null = null
  let targetUser: string | null = null
  let recipients: { id: string }[] = []

  if (mode === 'team') {
    if (!teamId) return NextResponse.json({ error: '팀을 선택해주세요' }, { status: 400 })
    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) return NextResponse.json({ error: '팀을 찾을 수 없습니다' }, { status: 400 })
    targetTeam = team.name
    recipients = await prisma.user.findMany({ where: { teamId }, select: { id: true } })
  } else if (mode === 'user') {
    if (!userName) return NextResponse.json({ error: '담당자를 선택해주세요' }, { status: 400 })
    const user = await prisma.user.findFirst({ where: { name: userName } })
    if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 400 })
    targetUser = user.name
    recipients = [{ id: user.id }]
  } else {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 })
  }

  const shareId = crypto.randomUUID()
  await prisma.$executeRaw`
    INSERT INTO "DealShare" (id, "dealId", "sharedBy", "targetTeam", "targetUser", "createdAt")
    VALUES (${shareId}, ${dealId}, ${sharedBy}, ${targetTeam}, ${targetUser}, datetime('now'))
  `

  const message = `${deal.name} 리드가 ${sharedBy}님으로부터 공유되었습니다`
  await Promise.all(
    recipients.map(r => createNotification({ userId: r.id, type: 'lead_share', message, link }))
  )

  return NextResponse.json({
    id: shareId, dealId, sharedBy, targetTeam, targetUser, createdAt: new Date().toISOString(),
  })
}
