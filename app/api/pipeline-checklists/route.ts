import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// Read from image-bundled path (not volume-mounted) so deploys always take effect
const BUNDLE_PATH = path.join(process.cwd(), 'data-bundle', 'pipeline-checklists.json')
// Write path is on the writable volume (for future admin use)
const WRITE_PATH  = path.join(process.cwd(), 'data', 'pipeline-checklists.json')

async function read(): Promise<Record<string, { key: string; label: string; field?: string; opts?: string[] }[]>> {
  const src = existsSync(BUNDLE_PATH) ? BUNDLE_PATH : WRITE_PATH
  if (!existsSync(src)) return {}
  const raw = await readFile(src, 'utf-8')
  return JSON.parse(raw)
}

export async function GET() {
  const data = await read()
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const dir = path.dirname(WRITE_PATH)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(WRITE_PATH, JSON.stringify(body, null, 2), 'utf-8')
  return NextResponse.json({ ok: true })
}
