import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const deleted = await prisma.strategyTask.deleteMany({})
  console.log('삭제 완료:', deleted.count, '건')
  const remaining = await prisma.strategyTask.count()
  console.log('남은 과제:', remaining, '건')
}

main().finally(() => process.exit(0))
