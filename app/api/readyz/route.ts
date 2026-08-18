import path from 'node:path'
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function writableDirectory(name: 'UPLOADS_DIR' | 'DATA_DIR') {
  const value = process.env[name]
  if (!value || !path.isAbsolute(value)) throw new Error(`${name} must be an absolute path`)
  await access(value, constants.R_OK | constants.W_OK)
}

export async function GET(req: NextRequest) {
  const labFault = process.env.WARP_DEPLOYMENT_LAB === '1' ? process.env.WARP_LAB_FAULT : undefined
  const externalCheck = req.headers.get('x-warp-external-check') === '1'
  if (labFault === 'readiness' || (labFault === 'external' && externalCheck)) {
    return NextResponse.json({ ok: false, code: `lab_${labFault}_failure` }, { status: 503 })
  }

  try {
    await prisma.$queryRawUnsafe('SELECT 1')
    await prisma.accountEvidenceOutbox.findFirst({ select: { id: true } })
    await Promise.all([writableDirectory('UPLOADS_DIR'), writableDirectory('DATA_DIR')])
    const deploymentIdentity = process.env.WARP_IMAGE_DIGEST
      ? {
          slot: process.env.WARP_SLOT ?? 'unknown',
          release: process.env.WARP_RELEASE_ID ?? 'unknown',
          revision: process.env.WARP_SOURCE_REVISION ?? 'unknown',
          imageDigest: process.env.WARP_IMAGE_DIGEST ?? 'unknown',
      }
      : {}
    return NextResponse.json({ ok: true, ...deploymentIdentity }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[readyz]', error instanceof Error ? error.message : 'unknown_error')
    return NextResponse.json({ ok: false, code: 'not_ready' }, { status: 503 })
  }
}
