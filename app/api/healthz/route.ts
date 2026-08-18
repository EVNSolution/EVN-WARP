import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const labIdentity = process.env.WARP_DEPLOYMENT_LAB === '1'
    ? {
        slot: process.env.WARP_SLOT ?? 'unknown',
        release: process.env.WARP_RELEASE_ID ?? 'unknown',
        revision: process.env.WARP_SOURCE_REVISION ?? 'unknown',
        imageDigest: process.env.WARP_IMAGE_DIGEST ?? 'unknown',
      }
    : {}
  return NextResponse.json({ ok: true, ...labIdentity }, { headers: { 'Cache-Control': 'no-store' } })
}
