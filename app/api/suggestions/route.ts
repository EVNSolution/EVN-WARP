import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!(session?.user as any)?.id) return NextResponse.json([], { status: 401 })

  const suggestions = await prisma.suggestion.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(suggestions)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const me = session?.user as any
  if (!me?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, title, content, images, files } = body
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 })
  }

  const suggestion = await prisma.suggestion.create({
    data: {
      userId:     me.id,
      userName:   me.name ?? '이름 없음',
      type:       ['제안', '버그', '질문'].includes(type) ? type : '제안',
      title:      title.trim(),
      content:    content.trim(),
      imagesJson: Array.isArray(images) && images.length > 0 ? JSON.stringify(images) : null,
      filesJson:  Array.isArray(files)  && files.length  > 0 ? JSON.stringify(files)  : null,
    },
  })
  return NextResponse.json(suggestion, { status: 201 })
}
