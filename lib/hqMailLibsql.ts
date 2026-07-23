import type { PrismaLike } from './hqMailQueueCore'

type LibsqlClient = {
  execute(statement: { sql: string; args: unknown[] }): Promise<{
    rows: unknown[]
    rowsAffected: number
  }>
}

function statementFromTemplate(strings: TemplateStringsArray, values: unknown[]) {
  let sql = ''
  strings.forEach((part, index) => {
    sql += part
    if (index < values.length) sql += '?'
  })
  return { sql, args: values }
}

export function createLibsqlTaggedDb(client: LibsqlClient): PrismaLike {
  return {
    async $executeRaw(strings, ...values) {
      const result = await client.execute(statementFromTemplate(strings, values))
      return result.rowsAffected
    },
    async $queryRaw(strings, ...values) {
      const result = await client.execute(statementFromTemplate(strings, values))
      return result.rows as never
    },
  }
}
