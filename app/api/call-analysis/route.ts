import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAIFileManager } from '@google/generative-ai/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const MIME_MAP: Record<string, string> = {
  m4a:  'audio/mp4',
  mp3:  'audio/mpeg',
  wav:  'audio/wav',
  ogg:  'audio/ogg',
  aac:  'audio/aac',
  amr:  'audio/amr',
  '3gp':'audio/3gpp',
  mp4:  'audio/mp4',
  opus: 'audio/opus',
  flac: 'audio/flac',
  webm: 'audio/webm',
}

// Gemini inline data limit: ~20MB (base64 overhead ~33%), so keep inline under 15MB
const INLINE_LIMIT  = 15 * 1024 * 1024
const OVERALL_LIMIT = 50 * 1024 * 1024

const PROMPT = `이 오디오는 EV 화물차 영업 상담 통화 녹음입니다. 한국어로 분석해 주세요.

JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON만):
{
  "transcript": "전체 대화 전사 ([상담원] 내용\\n[고객] 내용 형식)",
  "summary": "3~5문장 핵심 요약",
  "topics": ["주요 주제1", "주제2"],
  "action_items": [{"task": "해야 할 일", "owner": "담당자 또는 고객", "due": "기한 또는 null"}],
  "schedule": "합의된 다음 일정 또는 null",
  "money": "언급된 금액 정보 또는 null",
  "result": "통화 결과 요약 (1~2문장)",
  "next_action": "가장 중요한 다음 행동 1가지",
  "duration_sec": 통화시간(초) 추정값 또는 null
}`

function parseJsonResponse(text: string) {
  let jsonStr = text
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    jsonStr = fenced[1]
  } else {
    const obj = text.match(/\{[\s\S]*\}/)
    if (obj) jsonStr = obj[0]
  }
  return JSON.parse(jsonStr)
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('audio') as File | null
    if (!file) return NextResponse.json({ error: '오디오 파일이 없습니다.' }, { status: 400 })

    if (file.size > OVERALL_LIMIT) {
      return NextResponse.json({ error: '파일이 너무 큽니다. 50MB 이하만 지원합니다.' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GOOGLE_API_KEY 미설정' }, { status: 500 })

    const ext      = file.name.split('.').pop()?.toLowerCase() ?? ''
    const mimeType = file.type || MIME_MAP[ext] || 'audio/mpeg'
    const genAI    = new GoogleGenerativeAI(apiKey)
    const model    = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    let result

    if (file.size > INLINE_LIMIT) {
      // Large file: upload via Gemini File API to avoid base64 size limits
      const fileManager = new GoogleAIFileManager(apiKey)
      const bytes       = await file.arrayBuffer()
      const tmpPath     = join(tmpdir(), `evn_audio_${Date.now()}.${ext}`)

      try {
        await writeFile(tmpPath, Buffer.from(bytes))

        const uploadResult = await fileManager.uploadFile(tmpPath, {
          mimeType,
          displayName: file.name,
        })

        // Wait for Gemini to finish processing the audio
        let fileState = uploadResult.file
        let attempts  = 0
        while (fileState.state === 'PROCESSING' && attempts < 30) {
          await new Promise(r => setTimeout(r, 3000))
          fileState = await fileManager.getFile(fileState.name)
          attempts++
        }

        if (fileState.state !== 'ACTIVE') {
          throw new Error('음성 파일 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        }

        result = await model.generateContent([
          { fileData: { fileUri: fileState.uri, mimeType } },
          PROMPT,
        ])

        // Clean up from Gemini (best-effort)
        fileManager.deleteFile(fileState.name).catch(() => {})
      } finally {
        unlink(tmpPath).catch(() => {})
      }
    } else {
      // Small file: inline base64
      const bytes    = await file.arrayBuffer()
      const base64   = Buffer.from(bytes).toString('base64')
      result = await model.generateContent([
        { inlineData: { mimeType, data: base64 } },
        PROMPT,
      ])
    }

    const text = result.response.text()

    let analysis: any
    try {
      analysis = parseJsonResponse(text)
    } catch {
      return NextResponse.json({ error: 'AI 응답 파싱 실패', raw: text.slice(0, 500) }, { status: 500 })
    }

    return NextResponse.json(analysis)
  } catch (e: any) {
    console.error('[call-analysis POST]', e?.message)
    return NextResponse.json({ error: e?.message ?? '분석 실패' }, { status: 500 })
  }
}
