import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const DATA_PATH = path.join(process.cwd(), 'data', 'pipeline-checklists.json')

async function read(): Promise<Record<string, { key: string; label: string; field?: string; opts?: string[] }[]>> {
  if (!existsSync(DATA_PATH)) return {}
  const raw = await readFile(DATA_PATH, 'utf-8')
  return JSON.parse(raw)
}

export async function GET() {
  const data = await read()
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const dir = path.dirname(DATA_PATH)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(DATA_PATH, JSON.stringify(body, null, 2), 'utf-8')
  return NextResponse.json({ ok: true })
}
