// 로컬 dev.db에서 전략과제/KPI/팀/주간업무 데이터를 SQL INSERT 파일로 내보냄
import { createClient } from '@libsql/client'
import { writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(__dirname, '..', 'dev.db')
const client = createClient({ url: `file:${dbPath}` })

function esc(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number' || typeof v === 'bigint') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  return `'${String(v).replace(/'/g, "''")}'`
}

async function dumpTable(table, orderBy = 'rowid') {
  const { rows, columns } = await client.execute(`SELECT * FROM "${table}" ORDER BY ${orderBy}`)
  if (rows.length === 0) return `-- ${table}: 데이터 없음\n`
  const cols = columns.map(c => `"${c}"`).join(', ')
  const lines = [`-- ${table} (${rows.length}건)`]
  for (const row of rows) {
    const vals = columns.map(c => esc(row[c])).join(', ')
    lines.push(`INSERT OR IGNORE INTO "${table}" (${cols}) VALUES (${vals});`)
  }
  return lines.join('\n') + '\n'
}

const tables = [
  // 의존성 순서 중요
  ['Team',            'rowid'],
  ['StrategyTask',    '"parentId" NULLS FIRST, "createdAt"'],  // 부모 먼저
  ['KpiItem',         'rowid'],
  ['MonthlyTarget',   'rowid'],
  ['Countermeasure',  'rowid'],
  ['KpiActual',       'rowid'],
  ['WorkActivity',    'rowid'],
  ['WeeklyUpdate',    'rowid'],
  ['CompanyKpi',      'rowid'],
  ['CompanyKpiEntry', 'rowid'],
]

let sql = `-- EVN WARP 전략과제/KPI 데이터 이전 스크립트\n-- 생성: ${new Date().toISOString()}\nPRAGMA foreign_keys = OFF;\nBEGIN TRANSACTION;\n\n`

for (const [table, order] of tables) {
  try {
    sql += await dumpTable(table, order)
    sql += '\n'
  } catch (e) {
    sql += `-- ${table}: 오류 - ${e.message}\n\n`
  }
}

sql += 'COMMIT;\nPRAGMA foreign_keys = ON;\n'

const outPath = path.resolve(__dirname, '..', 'scripts', 'a3-kpi-export.sql')
writeFileSync(outPath, sql, 'utf8')
console.log(`✅ 내보내기 완료: ${outPath}`)
console.log(`   행 수: ${(sql.match(/^INSERT/gm) || []).length}건`)
