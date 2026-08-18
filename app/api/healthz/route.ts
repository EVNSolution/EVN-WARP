import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const deploymentIdentity = process.env.WARP_IMAGE_DIGEST
    ? {
        slot: process.env.WARP_SLOT ?? 'unknown',
        release: process.env.WARP_RELEASE_ID ?? 'unknown',
        revision: process.env.WARP_SOURCE_REVISION ?? 'unknown',
        imageDigest: process.env.WARP_IMAGE_DIGEST ?? 'unknown',
      }
    : {}
  return NextResponse.json({ ok: true, ...deploymentIdentity }, { headers: { 'Cache-Control': 'no-store' } })
}
