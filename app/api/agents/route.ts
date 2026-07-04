import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/agents?q=검색어  —  Agent + 임직원 + isAgent 고객 통합 검색
export async function GET(req: NextRequest) {
  try {
    const q  = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    const ql = q.toLowerCase()

    // 1. 기존 Agent 레코드 (try-catch 분리)
    let existingAgents: any[] = []
    try {
      existingAgents = await prisma.agent.findMany({
        where: q ? {
          OR: [
            { name:    { contains: q } },
            { phone:   { contains: q } },
            { company: { contains: q } },
          ],
        } : undefined,
        include: {
          user:     { select: { id: true, name: true, team: { select: { name: true } } } },
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { name: 'asc' },
      })
    } catch (e: any) {
      console.error('[agents GET] agent.findMany error:', e?.message)
    }

    const agentsMapped = existingAgents.map((a: any) => ({
      ...a,
      _count: { deals: 0 },
    }))

    const regUserIds = new Set(existingAgents.map((a: any) => a.userId).filter(Boolean) as string[])
    const regCustIds = new Set(existingAgents.map((a: any) => a.customerId).filter(Boolean) as string[])

    // 2. 임직원(User) — Agent 미등록 인원
    let unregUsers: any[] = []
    try {
      const allUsers = await prisma.user.findMany({
        select: { id: true, name: true, email: true, team: { select: { name: true } } },
        orderBy: { name: 'asc' },
      })
      unregUsers = allUsers
        .filter((u: any) => !regUserIds.has(u.id))
        .filter((u: any) => !ql || u.name.toLowerCase().includes(ql) || u.email.toLowerCase().includes(ql))
    } catch (e: any) {
      console.error('[agents GET] user.findMany error:', e?.message)
    }

    // 3. isAgent 고객 — Agent 미등록 인원 (raw: libSQL Boolean)
    let unregCusts: any[] = []
    try {
      type CRow = { id: string; name: string; phone: string | null; companyName: string | null }
      const allIsAgentCusts = await prisma.$queryRaw<CRow[]>`
        SELECT id, name, phone, companyName FROM "Customer" WHERE isAgent = 1
      `
      unregCusts = allIsAgentCusts
        .filter((c: any) => !regCustIds.has(c.id))
        .filter((c: any) => !ql || c.name.toLowerCase().includes(ql) || (c.phone ?? '').includes(q))
    } catch (e: any) {
      console.error('[agents GET] isAgent $queryRaw error:', e?.message)
    }

    // 통합 결과
    const userCandidates = unregUsers.map((u: any) => ({
      id:          `user_${u.id}`,
      _sourceType: 'user',
      _sourceId:   u.id,
      name:        u.name,
      phone:       null,
      email:       u.email,
      company:     null,
      type:        '내부',
      user:        { name: u.name, team: u.team },
      customer:    null,
      _count:      { deals: 0 },
    }))

    const custCandidates = unregCusts.map((c: any) => ({
      id:          `cust_${c.id}`,
      _sourceType: 'customer',
      _sourceId:   c.id,
      name:        c.name,
      phone:       c.phone,
      email:       null,
      company:     c.companyName,
      type:        '외부',
      user:        null,
      customer:    { name: c.name, phone: c.phone },
      _count:      { deals: 0 },
    }))

    const result = [...agentsMapped, ...userCandidates, ...custCandidates]
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[agents GET] 전체 에러:', e?.message)
    return NextResponse.json({ error: e?.message ?? '조회 실패' }, { status: 500 })
  }
}

// POST /api/agents  —  소개자 신규 등록
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, email, company, type, memo, userId, customerId } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: '이름은 필수입니다.' }, { status: 400 })
    }

    // 이미 등록된 Agent 여부 확인 (raw SQL: libSQL 어댑터 호환)
    if (userId) {
      type ARow = { id: string; name: string; type: string }
      const rows = await prisma.$queryRaw<ARow[]>`SELECT id, name, type FROM "Agent" WHERE userId = ${userId} LIMIT 1`
      if (rows.length > 0) {
        return NextResponse.json({ error: '이미 등록된 내부 소개자입니다.', agent: rows[0] }, { status: 409 })
      }
    }
    if (customerId) {
      type ARow = { id: string; name: string; type: string }
      const rows = await prisma.$queryRaw<ARow[]>`SELECT id, name, type FROM "Agent" WHERE customerId = ${customerId} LIMIT 1`
      if (rows.length > 0) {
        return NextResponse.json({ error: '이미 등록된 외부 소개자입니다.', agent: rows[0] }, { status: 409 })
      }
    }

    // libSQL 어댑터 호환: ORM create 대신 raw SQL INSERT 사용
    const id  = crypto.randomUUID()
    const now = new Date().toISOString()
    const agentType = type || '외부'
    await prisma.$executeRaw`
      INSERT INTO "Agent" (id, name, phone, email, company, type, memo, userId, customerId, createdAt, updatedAt)
      VALUES (
        ${id}, ${name.trim()}, ${phone || null}, ${email || null},
        ${company || null}, ${agentType}, ${memo || null},
        ${userId || null}, ${customerId || null}, ${now}, ${now}
      )
    `

    // 외부 고객을 Agent로 등록한 경우 Customer.isAgent = 1 업데이트
    if (customerId) {
      await prisma.$executeRaw`UPDATE "Customer" SET "isAgent" = 1 WHERE id = ${customerId}`
    }

    return NextResponse.json({ id, name: name.trim(), type: agentType }, { status: 201 })
  } catch (e: any) {
    console.error('[agents POST] 에러:', e?.message)
    return NextResponse.json({ error: e?.message ?? '등록 실패' }, { status: 500 })
  }
}
