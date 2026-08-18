import path from 'path'
import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

type DatabaseEnvironment = {
  DATABASE_URL?: string
  NODE_ENV?: string
}

export function resolveDatabaseUrl(env: DatabaseEnvironment = process.env) {
  const configured = env.DATABASE_URL?.trim()
  if (configured) return configured
  if (env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL must be set in production')
  }
  return `file:${path.resolve(process.cwd(), 'dev.db')}`
}

export function createPrisma(databaseUrl?: string) {
  const adapter = new PrismaLibSql({ url: databaseUrl ?? resolveDatabaseUrl() })
  const client = new PrismaClient({ adapter })
  // 배포 시 마이그레이션 스크립트와 동시에 쓰기가 몰릴 때 SQLITE_BUSY로 즉시 실패하지 않고 잠깐 재시도하도록 대기시간을 둔다
  client.$executeRawUnsafe('PRAGMA busy_timeout = 5000').catch(() => {})
  return client
}

export const prisma = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
