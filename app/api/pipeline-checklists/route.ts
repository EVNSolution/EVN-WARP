import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
// Bundled at compile time — immune to volume shadowing and filesystem state
import bundledChecklists from '@/data/pipeline-checklists.json'

const WRITE_PATH = path.join(process.cwd(), 'data', 'pipeline-checklists.json')

export async function GET() {
  return NextResponse.json(bundledChecklists)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const dir = path.dirname(WRITE_PATH)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(WRITE_PATH, JSON.stringify(body, null, 2), 'utf-8')
  return NextResponse.json({ ok: true })
}
