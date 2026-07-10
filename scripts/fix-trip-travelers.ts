/**
 * 특정 출장보고의 작성자/출장자 정보 수정
 * 사용법: npx tsx scripts/fix-trip-travelers.ts
 */
import 'dotenv/config'
import path from 'path'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const TRIP_ID = 'cmrd5dn2x0000x2nrm82x672p'
const AUTHOR_NAME   = '이현수'
const TRAVELER_NAMES = ['이현수', '민원기']

async function main() {
  const dbPath  = path.resolve(process.cwd(), 'dev.db')
  const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
  const prisma  = new PrismaClient({ adapter } as any)

  // 사용자 조회
  const users = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM "User" WHERE name IN ('이현수', '민원기')
  `
  console.log('조회된 사용자:', users)

  const authorUser    = users.find(u => u.name === AUTHOR_NAME)
  const travelerUsers = TRAVELER_NAMES.map(n => users.find(u => u.name === n)).filter(Boolean)

  if (!authorUser) {
    console.error(`❌ 작성자 '${AUTHOR_NAME}' 계정을 찾을 수 없습니다.`)
    await prisma.$disconnect(); return
  }

  // 현재 출장보고 상태 확인
  const current = await prisma.$queryRaw<any[]>`
    SELECT id, "userName", "userId", "travelersJson" FROM "TripReport" WHERE id = ${TRIP_ID}
  `
  console.log('\n현재 데이터:', current[0])

  if (current.length === 0) {
    console.error(`❌ 출장보고 ID ${TRIP_ID} 를 찾을 수 없습니다.`)
    await prisma.$disconnect(); return
  }

  const travelersJson = JSON.stringify(
    travelerUsers.map(u => ({ userId: u!.id, userName: u!.name }))
  )

  await prisma.$executeRaw`
    UPDATE "TripReport"
    SET "userName"     = ${AUTHOR_NAME},
        "userId"       = ${authorUser.id},
        "travelersJson" = ${travelersJson}
    WHERE id = ${TRIP_ID}
  `

  console.log('\n✅ 수정 완료')
  console.log('  작성자:', AUTHOR_NAME, `(${authorUser.id})`)
  console.log('  출장자:', travelersJson)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
