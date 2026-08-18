import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { canManageUsers } from '@/lib/permissions'
import { createNotification } from '@/lib/createNotification'

export async function GET() {
  const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(announcements)
}

export async function POST(req: NextRequest) {
  const [body, session] = await Promise.all([req.json(), auth()])
  const me = session?.user as any
  if (!(await canManageUsers(me?.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { title, content, targetScope, targetTeams } = body
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: '제목과 내용은 필수입니다.' }, { status: 400 })
  }
  const scope = targetScope === '팀' ? '팀' : '전체'

  const announcement = await prisma.announcement.create({
    data: {
      title:   title.trim(),
      content: content.trim(),
      authorName: me?.name ?? '관리자',
      targetScope: scope,
      targetTeamsJson: scope === '팀' && Array.isArray(targetTeams) && targetTeams.length > 0
        ? JSON.stringify(targetTeams) : null,
    },
  })

  // 대상자에게 알림 발송
  const recipients = await prisma.user.findMany({
    where: {
      employmentType: '사내',
      ...(scope === '팀' && Array.isArray(targetTeams) && targetTeams.length > 0
        ? { team: { name: { in: targetTeams } } }
        : {}),
    },
    select: { id: true },
  })
  await Promise.all(recipients.map(u => createNotification({
    userId:  u.id,
    type:    'announcement',
    message: `[공지] ${announcement.title}`,
    link:    '/notices',
  })))

  return NextResponse.json(announcement, { status: 201 })
}
