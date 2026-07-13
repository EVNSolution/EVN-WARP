'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Mic, ChevronDown, ChevronUp } from 'lucide-react'

interface ActionItem {
  task: string
  owner: string | null
  due: string | null
}

interface Analysis {
  transcript: string
  summary: string
  topics: string[]
  action_items: ActionItem[]
  schedule: string | null
  money: string | null
  result: string
  next_action: string
  duration_sec: number | null
}

interface Props {
  mode?: 'call' | 'meeting'
  onClose: () => void
  onApply: (data: {
    content: string
    result: string
    nextAction: string
    duration?: number
  }) => void
}

export default function CallAnalysisModal({ mode = 'call', onClose, onApply }: Props) {
  const isMeeting = mode === 'meeting'
  const [dragging,        setDragging]        = useState(false)
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [analysis,        setAnalysis]        = useState<Analysis | null>(null)
  const [showTranscript,  setShowTranscript]  = useState(false)
  const [fileName,        setFileName]        = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const processFile = async (file: File) => {
    setFileName(file.name)
    setLoading(true)
    setError(null)
    setAnalysis(null)
    try {
      const fd = new FormData()
      fd.append('audio', file)
      const res  = await fetch('/api/call-analysis', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '분석 실패')
      } else {
        setAnalysis(data)
      }
    } catch (e: any) {
      setError(e?.message ?? '네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleApply = () => {
    if (!analysis) return
    const nextAction = [analysis.next_action, analysis.schedule].filter(Boolean).join(' / ')
    const content    = analysis.money
      ? `${analysis.summary}\n\n[금액] ${analysis.money}`
      : analysis.summary
    onApply({
      content,
      result:     analysis.result,
      nextAction,
      duration:   analysis.duration_sec ? Math.round(analysis.duration_sec / 60) : undefined,
    })
    onClose()
  }

  const modal = (
    <div
      className="fixed inset-0 bg-black/40 z-[99999] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {isMeeting ? 'AI 회의록 자동화' : 'AI 통화 분석'}
            </h2>
            <p className="text-xs text-slate-400">
              {isMeeting
                ? '음성 파일을 업로드하면 AI가 회의록을 자동으로 작성합니다'
                : '녹음 파일을 업로드하면 Gemini AI가 자동으로 분석합니다'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition p-1">
            <X size={18} />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">

          {/* 파일 업로드 영역 */}
          {!analysis && !loading && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer
                ${dragging
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
            >
              <input
                ref={fileRef} type="file"
                accept=".m4a,.mp3,.wav,.ogg,.aac,.amr,.3gp,.mp4,.opus,.flac"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
              />
              <Mic size={32} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">
                {isMeeting ? '회의 녹음 파일을 끌어다 놓거나 클릭하세요' : '녹음 파일을 끌어다 놓거나 클릭하세요'}
              </p>
              <p className="text-xs text-slate-400 mt-1">M4A · MP3 · WAV · AMR 등 · 최대 50MB</p>
              {fileName && (
                <p className="mt-2 text-xs text-indigo-600 font-medium">{fileName}</p>
              )}
            </div>
          )}

          {/* 로딩 */}
          {loading && (
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">AI 분석 중...</p>
                <p className="text-xs text-slate-400 mt-1">{fileName}</p>
                <p className="text-xs text-slate-400 mt-0.5">통화 길이에 따라 30초~2분 소요됩니다</p>
              </div>
            </div>
          )}

          {/* 에러 */}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm font-semibold text-red-700">분석 실패</p>
              <p className="text-xs text-red-500 mt-1">{error}</p>
              <button
                onClick={() => { setError(null); setFileName(null) }}
                className="mt-2 text-xs font-semibold text-red-600 hover:text-red-800 underline"
              >
                다시 시도
              </button>
            </div>
          )}

          {/* 분석 결과 */}
          {analysis && (
            <div className="space-y-3">
              {/* 요약 */}
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">AI 요약</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{analysis.summary}</p>
              </div>

              {/* 결과 + 다음 액션 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                  <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1.5">결과</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{analysis.result}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1.5">다음 액션</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{analysis.next_action}</p>
                  {analysis.schedule && (
                    <p className="text-xs text-blue-500 mt-1.5">일정: {analysis.schedule}</p>
                  )}
                </div>
              </div>

              {/* 할 일 목록 */}
              {analysis.action_items?.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">할 일 목록</p>
                  <ul className="space-y-1.5">
                    {analysis.action_items.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                        <span className="text-slate-700">
                          {a.task}
                          {a.owner && <span className="text-slate-400"> ({a.owner})</span>}
                          {a.due   && <span className="text-amber-600"> ~ {a.due}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 금액 */}
              {analysis.money && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">금액 언급</p>
                  <p className="text-xs text-slate-600">{analysis.money}</p>
                </div>
              )}

              {/* 주제 태그 */}
              {analysis.topics?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {analysis.topics.map((t, i) => (
                    <span key={i} className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* 전사 (접힘) */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowTranscript(v => !v)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  <span>전체 대화 전사 보기</span>
                  {showTranscript ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                {showTranscript && (
                  <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 max-h-52 overflow-y-auto">
                    <p className="text-[11px] text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">
                      {analysis.transcript}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          {analysis ? (
            <>
              <button
                type="button"
                onClick={() => { setAnalysis(null); setFileName(null) }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
              >
                다른 파일 분석
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-5 py-2 text-sm font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                {isMeeting ? '이 내용으로 세부 내용 채우기' : '이 내용으로 상담 기록 채우기'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
            >
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
