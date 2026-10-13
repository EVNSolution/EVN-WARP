import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { isAdminRole } from '@/lib/permissions'

/** 활동 댓글 삭제 — 본인 댓글 또는 관리자만. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const { commentId } = await params
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const comment = await prisma.activityComment.findUnique({ where: { id: commentId }, select: { userId: true } })
  if (!comment) return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 })
  if (comment.userId !== me.id && !isAdminRole(me.role)) {
    return NextResponse.json({ error: '본인 댓글만 삭제할 수 있습니다.' }, { status: 403 })
  }
  await prisma.activityComment.delete({ where: { id: commentId } })
  return NextResponse.json({ ok: true })
}
