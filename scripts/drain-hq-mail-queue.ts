import 'dotenv/config'

import { createClient } from '@libsql/client'

import { resolveWarpDbTarget } from '../lib/dbTarget.ts'
import { createLibsqlTaggedDb } from '../lib/hqMailLibsql.ts'
import { drainHqMailQueueWithPrisma } from '../lib/hqMailQueueCore.ts'

function optionValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] || fallback : fallback
}

const target = resolveWarpDbTarget()
const limit = Number.parseInt(optionValue('--limit', '10'), 10)
const includeDeferred = process.argv.includes('--force')
const client = createClient(target.config)
const db = createLibsqlTaggedDb(client)

try {
  const summary = await drainHqMailQueueWithPrisma(db, { limit, includeDeferred })
  console.log(`hq_mail_due=${summary.due} accepted=${summary.accepted} queued=${summary.queued} held=${summary.held}`)
} finally {
  client.close()
}
