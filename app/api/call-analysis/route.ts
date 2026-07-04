import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

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

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('audio') as File | null
    if (!file) return NextResponse.json({ error: '오디오 파일이 없습니다.' }, { status: 400 })

    const SIZE_LIMIT = 20 * 1024 * 1024
    if (file.size > SIZE_LIMIT) {
      return NextResponse.json({ error: '파일이 너무 큽니다. 20MB 이하만 지원합니다.' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const mimeType = file.type || MIME_MAP[ext] || 'audio/mpeg'

    const bytes = await file.arrayBuffer()
    const base64Data = Buffer.from(bytes).toString('base64')

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GOOGLE_API_KEY 미설정' }, { status: 500 })

    const genAI  = new GoogleGenerativeAI(apiKey)
    const model  = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `이 오디오는 EV 화물차 영업 상담 통화 녹음입니다. 한국어로 분석해 주세요.

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

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      prompt,
    ])

    const text = result.response.text()

    // 마크다운 코드블록 제거 후 JSON 파싱
    let jsonStr = text
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenced) {
      jsonStr = fenced[1]
    } else {
      const obj = text.match(/\{[\s\S]*\}/)
      if (obj) jsonStr = obj[0]
    }

    let analysis: any
    try {
      analysis = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'AI 응답 파싱 실패', raw: text.slice(0, 500) }, { status: 500 })
    }

    return NextResponse.json(analysis)
  } catch (e: any) {
    console.error('[call-analysis POST]', e?.message)
    return NextResponse.json({ error: e?.message ?? '분석 실패' }, { status: 500 })
  }
}
