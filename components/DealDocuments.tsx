'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Trash2, FileText, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import { PIPELINE } from '@/lib/pipeline'

type DocDef = { key: string; label: string }
type DocsMap = Record<string, DocDef[]>

interface DocRecord {
  id: string
  stageCode: string
  docKey: string
  docLabel: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  uploadedAt: string
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export default function DealDocuments({ dealId, stageCode }: { dealId: string; stageCode: string }) {
  const [docs,      setDocs]      = useState<DocRecord[]>([])
  const [docsMap,   setDocsMap]   = useState<DocsMap>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const fileRef  = useRef<HTMLInputElement>(null)
  const pendingRef = useRef<{ stageCode: string; docKey: string; docLabel: string } | null>(null)

  useEffect(() => {
    // 업로드된 파일 목록 + 서류 설정 동시 로드
    Promise.all([
      fetch(`/api/deals/${dealId}/documents`).then(r => r.json()),
      fetch('/api/pipeline-documents').then(r => r.json()),
    ]).then(([uploaded, config]: [DocRecord[], DocsMap]) => {
      setDocs(uploaded)
      // pipeline.ts 기본값과 병합
      const merged: DocsMap = {}
      for (const ph of PIPELINE) {
        for (const proc of ph.processes) {
          merged[proc.code] = config[proc.code] ?? proc.documents
        }
      }
      setDocsMap(merged)
    }).catch(() => {})
  }, [dealId])

  // 현재 단계까지의 서류가 있는 단계만 수집
  const allCodes    = PIPELINE.flatMap(ph => ph.processes.map(p => p.code))
  const currentIdx  = allCodes.indexOf(stageCode)
  const relevantCodes = allCodes.slice(0, currentIdx + 1)

  const stageDocs = PIPELINE.flatMap(ph =>
    ph.processes
      .filter(p => relevantCodes.includes(p.code) && (docsMap[p.code] ?? []).length > 0)
      .map(p => ({ stageCode: p.code, stageName: p.name, documents: docsMap[p.code] ?? [] }))
  )

  if (stageDocs.length === 0) return null

  const handleUploadClick = (sc: string, docKey: string, docLabel: string) => {
    pendingRef.current = { stageCode: sc, docKey, docLabel }
    fileRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const pending = pendingRef.current
    if (!file || !pending) return

    setUploading(pending.docKey)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('stageCode', pending.stageCode)
      fd.append('docKey', pending.docKey)
      fd.append('docLabel', pending.docLabel)

      const res = await fetch(`/api/deals/${dealId}/documents`, { method: 'POST', body: fd })
      if (res.ok) {
        const newDoc = await res.json()
        setDocs(prev => [...prev, newDoc])
      }
    } finally {
      setUploading(null)
      pendingRef.current = null
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async (docId: string) => {
    if (!confirm('이 서류를 삭제하시겠습니까?')) return
    setDeleting(docId)
    try {
      await fetch(`/api/deals/${dealId}/documents/${docId}`, { method: 'DELETE' })
      setDocs(prev => prev.filter(d => d.id !== docId))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="mt-4">
      <input type="file" ref={fileRef} className="hidden" onChange={handleFileChange} />

      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
          <FileText size={14} className="text-blue-500" />
          <span className="text-sm font-semibold text-slate-700">증빙 서류</span>
          <span className="text-xs text-slate-400 ml-1">— 단계별 필요 서류를 업로드하세요</span>
        </div>

        {/* 단계별 서류 목록 */}
        <div className="divide-y divide-slate-100">
          {stageDocs.map(({ stageCode: sc, stageName, documents }) => (
            <div key={sc} className="px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {sc} {stageName}
              </p>
              <div className="space-y-2">
                {documents.map(docDef => {
                  const uploaded   = docs.filter(d => d.stageCode === sc && d.docKey === docDef.key)
                  const hasFile    = uploaded.length > 0
                  const isUploading = uploading === docDef.key

                  return (
                    <div key={docDef.key} className="flex items-start gap-3">
                      {/* 서류 이름 */}
                      <div className="flex items-center gap-1.5 w-44 shrink-0 pt-0.5">
                        {hasFile
                          ? <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                          : <FileText size={13} className="text-slate-300 shrink-0" />
                        }
                        <span className={`text-xs ${hasFile ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                          {docDef.label}
                        </span>
                      </div>

                      {/* 업로드된 파일 + 버튼 */}
                      <div className="flex-1 min-w-0 space-y-1">
                        {uploaded.map(doc => (
                          <div key={doc.id} className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-lg px-2.5 py-1">
                            <span className="text-[11px] text-slate-600 truncate flex-1 min-w-0">{doc.fileName}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">{formatBytes(doc.fileSize)}</span>
                            <a href={doc.filePath} target="_blank" rel="noreferrer"
                              className="text-blue-400 hover:text-blue-600 shrink-0">
                              <ExternalLink size={11} />
                            </a>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              disabled={deleting === doc.id}
                              className="text-slate-300 hover:text-red-400 shrink-0 disabled:opacity-50">
                              {deleting === doc.id
                                ? <Loader2 size={11} className="animate-spin" />
                                : <Trash2 size={11} />
                              }
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => handleUploadClick(sc, docDef.key, docDef.label)}
                          disabled={!!isUploading}
                          className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {isUploading
                            ? <><Loader2 size={11} className="animate-spin" /> 업로드 중...</>
                            : <><Upload size={11} /> {hasFile ? '추가 업로드' : '파일 업로드'}</>
                          }
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
