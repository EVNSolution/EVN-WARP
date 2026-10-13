import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { notifyActivityComment } from '@/lib/notify-companions'

/**
 * 활동 댓글 — 활동 하나에 대한 대화 이력. 로그인한 구성원 누구나(동반자 포함) 쓸 수 있고
 * 파일을 함께 첨부할 수 있다. 새 댓글이 달리면 작성자·동반자(댓글 쓴 본인 제외)에게 알림.
 */

const ALLOWED_EXTS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.doc', '.docx', '.xls', '.xlsx', '.hwp', '.ppt', '.pptx', '.txt', '.zip',
])

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!(session?.user as any)?.id) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const comments = await prisma.activityComment.findMany({
    where: { activityId: id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(comments.map(c => ({
    id: c.id, userId: c.userId, userName: c.userName, content: c.content,
    files: c.filesJson ? (JSON.parse(c.filesJson) as string[]) : [],
    createdAt: c.createdAt.toISOString(),
  })))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const activity = await prisma.workActivity.findUnique({
    where: { id },
    select: { id: true, title: true, date: true, userId: true, companions: true },
  })
  if (!activity) return NextResponse.json({ error: '활동을 찾을 수 없습니다.' }, { status: 404 })

  const formData = await req.formData()
  const content = String(formData.get('content') ?? '').trim()
  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (!content && files.length === 0) {
    return NextResponse.json({ error: '내용이나 파일 중 하나는 있어야 합니다.' }, { status: 400 })
  }

  // 파일 저장 — 활동 첨부와 같은 로컬 업로드 방식
  const urls: string[] = []
  if (files.length > 0) {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'activity-comments', id)
    await mkdir(uploadDir, { recursive: true })
    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase() || ''
      if (!ALLOWED_EXTS.has(ext)) {
        return NextResponse.json({ error: `지원하지 않는 파일 형식: ${ext || file.name}` }, { status: 400 })
      }
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')}`
      await writeFile(path.join(uploadDir, safeName), Buffer.from(await file.arrayBuffer()))
      urls.push(`/uploads/activity-comments/${id}/${encodeURIComponent(safeName)}`)
    }
  }

  const comment = await prisma.activityComment.create({
    data: {
      activityId: id,
      userId: me.id,
      userName: me.name ?? '이름 없음',
      content: content || '(파일 첨부)',
      filesJson: urls.length ? JSON.stringify(urls) : null,
    },
  })

  // 알림 — 활동 작성자 + 동반자(댓글 쓴 본인 제외). 실패해도 댓글 등록은 유지
  void notifyActivityComment({
    activityId: id, title: activity.title, date: activity.date,
    ownerId: activity.userId, companions: activity.companions,
    commenterId: me.id, commenterName: me.name ?? '동료',
  })

  return NextResponse.json({
    id: comment.id, userId: comment.userId, userName: comment.userName, content: comment.content,
    files: urls, createdAt: comment.createdAt.toISOString(),
  }, { status: 201 })
}
