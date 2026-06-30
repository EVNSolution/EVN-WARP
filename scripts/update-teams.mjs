import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '../app/generated/prisma/client/index.js'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(__dirname, '..', 'dev.db')
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter })

const teams = await prisma.team.findMany({ orderBy: { name: 'asc' } })
console.log('현재 팀 목록:')
teams.forEach(t => console.log(' ', t.id, '|', t.name))

await prisma.$disconnect()
