/**
 * 사용자 계정 생성 스크립트
 * 사용법: npx tsx scripts/create-user.ts <이름> <이메일> <비밀번호> [admin|user]
 * 예시:   npx tsx scripts/create-user.ts "홍길동" "hong@evnsolution.com" "pass1234"
 *         npx tsx scripts/create-user.ts "관리자" "admin@evnsolution.com" "adminpass" admin
 */

import 'dotenv/config'
import bcrypt from 'bcryptjs'
import path from 'path'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const [, , name, email, password, role = 'user'] = process.argv

if (!name || !email || !password) {
  console.error('사용법: npx tsx scripts/create-user.ts <이름> <이메일> <비밀번호> [admin|user]')
  process.exit(1)
}

async function main() {
  const dbPath  = path.resolve(process.cwd(), 'dev.db')
  const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
  const prisma  = new PrismaClient({ adapter } as any)

  const hash = await bcrypt.hash(password, 12)

  try {
    const user = await prisma.user.create({
      data: { name, email, password: hash, role },
    })
    console.log(`✅ 계정 생성 완료: ${user.name} (${user.email}) — 역할: ${user.role}`)
  } catch (e: any) {
    if (e.code === 'P2002') {
      console.error(`❌ 이미 존재하는 이메일: ${email}`)
    } else {
      console.error('❌ 오류:', e.message)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main()
