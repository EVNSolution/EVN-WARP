import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const count = await prisma.strategyTask.count()
  const teams = await prisma.team.findMany({ select: { name: true } })
  console.log('남은 전략과제:', count, '건')
  console.log('팀 목록:', teams.map(t => t.name).join(', '))
}

main().finally(() => process.exit(0))
