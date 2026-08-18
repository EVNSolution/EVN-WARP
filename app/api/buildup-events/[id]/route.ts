import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'

/**
 * buildup 이벤트 확인 처리 (#27) — 담당자가 내용을 보고 파이프라인에 기입한 뒤 누른다.
 * 세션 인증은 proxy.ts 가 강제하고, 누가 확인했는지 세션에서 기록한다.
 */
export async function PATCH(_req: NextRequest, ctx: RouteContext<'/api/buildup-events/[id]'>) {
  const { id } = await ctx.params
  const session = await auth()
  const by = (session?.user?.name ?? session?.user?.email) || null
  if (!by) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const updated = await prisma.buildupEvent.update({
      where: { id },
      data: { status: 'confirmed', confirmedBy: by, confirmedAt: new Date() },
      select: { id: true, status: true },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
}
