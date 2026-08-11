import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/createNotification'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const me = session?.user as any
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { status, replyContent, replyImages } = body

  const suggestion = await prisma.suggestion.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(replyContent !== undefined && {
        replyContent:    replyContent || null,
        replyImagesJson: replyContent && Array.isArray(replyImages) && replyImages.length > 0
          ? JSON.stringify(replyImages) : null,
        repliedByName:   replyContent ? (me.name ?? '관리자') : null,
        repliedAt:       replyContent ? new Date() : null,
        status:          replyContent ? '답변완료' : status,
      }),
    },
  })

  if (replyContent) {
    await createNotification({
      userId:  suggestion.userId,
      type:    'suggestion_reply',
      message: `"${suggestion.title}"에 답변이 등록되었습니다`,
      link:    '/suggestions',
    })
  }

  return NextResponse.json(suggestion)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const me = session?.user as any
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.suggestion.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
