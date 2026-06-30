import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const dealId = form.get('dealId') as string | null
    const files  = form.getAll('files') as File[]

    if (!files.length) return NextResponse.json({ error: '파일 없음' }, { status: 400 })

    const dir = path.join(process.cwd(), 'public', 'uploads', 'meetings', dealId ?? 'general')
    await mkdir(dir, { recursive: true })

    const saved: { name: string; path: string; size: number; mime: string }[] = []

    for (const file of files) {
      const buf  = Buffer.from(await file.arrayBuffer())
      const safe = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
      const dest = path.join(dir, `${Date.now()}_${safe}`)
      await writeFile(dest, buf)
      saved.push({
        name: file.name,
        path: `/uploads/meetings/${dealId ?? 'general'}/${path.basename(dest)}`,
        size: file.size,
        mime: file.type,
      })
    }

    return NextResponse.json({ files: saved })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '업로드 실패' }, { status: 500 })
  }
}
