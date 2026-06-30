import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const ceoTeam = await prisma.team.upsert({
    where: { id: 'team-ceo' },
    update: {},
    create: { id: 'team-ceo', name: '경영진' },
  })
  console.log('팀 준비:', ceoTeam.name)

  const startDate = new Date('2026-01-01')
  const endDate   = new Date('2026-12-31')

  const taskA = await prisma.strategyTask.upsert({
    where: { code: 'A' },
    update: {},
    create: {
      code: 'A', teamSeq: 1, subSeq: null,
      strategy: 'A', title: '확장과 성장',
      teamId: 'team-ceo', owner: 'CEO',
      startDate, endDate,
      status: '진행중', confirmed: true,
    },
  })
  console.log('전략과제 A:', taskA.title, `(${taskA.id})`)

  const taskB = await prisma.strategyTask.upsert({
    where: { code: 'B' },
    update: {},
    create: {
      code: 'B', teamSeq: 2, subSeq: null,
      strategy: 'B', title: 'AI 기반 조직운영',
      teamId: 'team-ceo', owner: 'CEO',
      startDate, endDate,
      status: '진행중', confirmed: true,
    },
  })
  console.log('전략과제 B:', taskB.title, `(${taskB.id})`)
}

main().finally(() => process.exit(0))
