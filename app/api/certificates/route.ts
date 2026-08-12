import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

export async function POST(req: NextRequest) {
  const [body, session] = await Promise.all([req.json(), auth()])
  const me = session?.user as any
  if (!me?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { certType, purpose, extra } = body
  // 사직서·경력증명서는 추후 지원 예정
  if (!['재직증명서'].includes(certType)) {
    return NextResponse.json({ error: 'certType이 올바르지 않습니다.' }, { status: 400 })
  }

  const record = await prisma.certificateIssue.create({
    data: {
      userId:   me.id,
      userName: me.name ?? '이름 없음',
      certType,
      purpose:  purpose || null,
      extra:    extra ? JSON.stringify(extra) : null,
    },
  })
  return NextResponse.json(record, { status: 201 })
}
