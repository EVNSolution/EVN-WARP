import { dispatchDueAccountEvidence } from '@/lib/account-control/dispatcher'
import { readHqGatewayConfig } from '@/lib/account-control/config'
import { prisma } from '@/lib/db'

async function main() {
  const summary = await dispatchDueAccountEvidence({
    prisma,
    config: readHqGatewayConfig(),
  })
  process.stdout.write(`${JSON.stringify(summary)}\n`)
}

main()
  .catch(error => {
    const code = error instanceof Error ? error.message : 'account_evidence_dispatch_failed'
    process.stderr.write(`${JSON.stringify({ ok: false, code })}\n`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
