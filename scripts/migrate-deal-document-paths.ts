/**
 * DealDocument.filePath를 정적 서빙(/uploads/...)에서 API 라우트 서빙(/api/uploads/...)으로 변경.
 * 실행: npx tsx scripts/migrate-deal-document-paths.ts
 *
 * 배경: public/uploads는 배포마다 영구 보존 디렉터리(UPLOADS_DIR)로 이관되어
 * 더 이상 정적 경로로 서빙되지 않음. 실파일은 이미 이관된 위치에 있으므로
 * DB에 저장된 경로 문자열만 새 라우트 프리픽스로 맞춰주면 기존 첨부도 다시 열림.
 */
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000')
  const r = await prisma.$executeRaw`
    UPDATE "DealDocument"
    SET "filePath" = REPLACE("filePath", '/uploads/deals/', '/api/uploads/deals/')
    WHERE "filePath" LIKE '/uploads/deals/%'
  `
  console.log(`DealDocument 첨부 경로 이전: ${r}건`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
