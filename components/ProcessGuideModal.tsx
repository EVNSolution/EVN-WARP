'use client'

import { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronUp, CheckCircle2, FileText, Pencil, Plus, Trash2, Save, Loader2, Printer } from 'lucide-react'
import { PIPELINE } from '@/lib/pipeline'

type ItemDef  = { key: string; label: string; field?: string }
type ConfigMap = Record<string, ItemDef[]>

const FIELD_LABELS: Record<string, string> = { vehicle: '차량정보', shipper: '화주정보' }

const PHASE_COLORS: Record<number, string> = {
  1: 'bg-blue-700',
  2: 'bg-violet-700',
  3: 'bg-orange-600',
  4: 'bg-teal-600',
}

export default function ProcessGuideModal({ onClose }: { onClose: () => void }) {
  const [openCodes,  setOpenCodes]  = useState<Set<string>>(new Set())
  const [editMode,   setEditMode]   = useState(false)
  const [checks,     setChecks]     = useState<ConfigMap>({})
  const [docs,       setDocs]       = useState<ConfigMap>({})
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [dirty,      setDirty]      = useState(false)
  // 새 항목 입력 (단계코드 → { check, doc })
  const [newCheck,   setNewCheck]   = useState<Record<string, string>>({})
  const [newDoc,     setNewDoc]     = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([
      fetch('/api/pipeline-checklists').then(r => r.json()),
      fetch('/api/pipeline-documents').then(r => r.json()),
    ]).then(([cl, dc]: [ConfigMap, ConfigMap]) => {
      // pipeline.ts 기본값과 병합
      const mc: ConfigMap = {}
      const md: ConfigMap = {}
      for (const ph of PIPELINE) {
        for (const proc of ph.processes) {
          mc[proc.code] = cl[proc.code] ?? proc.checks
          md[proc.code] = dc[proc.code] ?? proc.documents
        }
      }
      setChecks(mc)
      setDocs(md)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggle      = (code: string) => setOpenCodes(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n })
  const expandAll   = () => setOpenCodes(new Set(PIPELINE.flatMap(ph => ph.processes.map(p => p.code))))
  const collapseAll = () => setOpenCodes(new Set())
  const allOpen     = openCodes.size === PIPELINE.flatMap(ph => ph.processes).length

  /* ── 체크리스트 추가/삭제 ── */
  const addCheck = (code: string) => {
    const label = newCheck[code]?.trim()
    if (!label) return
    const key = `custom_${Date.now()}`
    setChecks(prev => ({ ...prev, [code]: [...(prev[code] ?? []), { key, label }] }))
    setNewCheck(prev => ({ ...prev, [code]: '' }))
    setDirty(true); setSaved(false)
  }
  const removeCheck = (code: string, key: string) => {
    setChecks(prev => ({ ...prev, [code]: prev[code].filter(c => c.key !== key) }))
    setDirty(true); setSaved(false)
  }

  /* ── 서류 추가/삭제 ── */
  const addDoc = (code: string) => {
    const label = newDoc[code]?.trim()
    if (!label) return
    const key = `custom_${Date.now()}`
    setDocs(prev => ({ ...prev, [code]: [...(prev[code] ?? []), { key, label }] }))
    setNewDoc(prev => ({ ...prev, [code]: '' }))
    setDirty(true); setSaved(false)
  }
  const removeDoc = (code: string, key: string) => {
    setDocs(prev => ({ ...prev, [code]: prev[code].filter(d => d.key !== key) }))
    setDirty(true); setSaved(false)
  }

  /* ── 저장 (체크리스트 + 서류 동시 저장) ── */
  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all([
        fetch('/api/pipeline-checklists', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checks),
        }),
        fetch('/api/pipeline-documents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(docs),
        }),
      ])
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  /* ── 공통: 추가 입력 행 ── */
  const AddRow = ({ code: _code, value, onChange, onAdd, placeholder }: {
    code: string; value: string; onChange: (v: string) => void; onAdd: () => void; placeholder: string
  }) => (
    <div className="flex items-center gap-1.5 mt-2">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd() } }}
        className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"
      />
      <button
        onClick={onAdd}
        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-semibold shrink-0"
      >
        <Plus size={12} /> 추가
      </button>
    </div>
  )

  return (
    <>
    <style>{`
      @media print {
        body > * { visibility: hidden; }
        .guide-print-area, .guide-print-area * { visibility: visible; }
        .guide-print-area {
          position: absolute; left: 0; top: 0;
          width: 100%; max-height: none !important;
          box-shadow: none !important; border-radius: 0 !important;
        }
        .guide-print-area .overflow-y-auto { overflow: visible !important; max-height: none !important; }
        .guide-no-print { display: none !important; }
      }
    `}</style>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="guide-print-area bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">영업 프로세스 가이드</h2>
            <p className="text-xs text-slate-400 mt-0.5">각 단계별 체크사항과 필요 서류 안내</p>
          </div>
          <div className="flex items-center gap-2 guide-no-print">
            <button
              onClick={allOpen ? collapseAll : expandAll}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-colors"
            >
              {allOpen ? '전체 접기' : '전체 펼치기'}
            </button>
            <button
              onClick={() => { expandAll(); setTimeout(() => window.print(), 100) }}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
            >
              <Printer size={11} /> 인쇄
            </button>
            <button
              onClick={() => setEditMode(v => !v)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded border font-semibold transition-colors ${
                editMode
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
              }`}
            >
              <Pencil size={11} />
              {editMode ? '편집 중' : '편집'}
            </button>
            {editMode && (
              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className={`flex items-center gap-1 text-xs px-3 py-1 rounded font-semibold transition-colors disabled:opacity-40 ${
                  saved
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* 편집 모드 안내 */}
        {editMode && (
          <div className="guide-no-print px-6 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 font-medium">
            편집 모드: 체크리스트와 필요 서류를 수정한 후 [저장]을 누르세요. 리드 상세 페이지에도 즉시 반영됩니다.
          </div>
        )}

        {/* 본문 */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-slate-400" />
            </div>
          ) : (
            PIPELINE.map(phase => (
              <div key={phase.phase}>
                <div className={`rounded-lg px-3 py-1.5 mb-2 ${PHASE_COLORS[phase.phase]}`}>
                  <span className="text-xs font-bold text-white tracking-wide">
                    Phase {phase.phase}. {phase.name}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {phase.processes.map(proc => {
                    const isOpen    = openCodes.has(proc.code)
                    const stageCks  = checks[proc.code] ?? []
                    const stageDocs = docs[proc.code] ?? []
                    return (
                      <div key={proc.code} className="border border-slate-200 rounded-lg overflow-hidden">
                        {/* 프로세스 행 */}
                        <button
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                          onClick={() => toggle(proc.code)}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-[10px] font-bold text-white bg-slate-400 rounded px-1.5 py-0.5 shrink-0">
                              {proc.code}
                            </span>
                            <span className="text-sm font-semibold text-slate-700">{proc.name}</span>
                            <div className="flex items-center gap-1.5 ml-1">
                              {stageCks.length > 0 && (
                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                  <CheckCircle2 size={10} /> {stageCks.length}개
                                </span>
                              )}
                              {stageDocs.length > 0 && (
                                <span className="text-[10px] text-blue-500 flex items-center gap-0.5">
                                  <FileText size={10} /> {stageDocs.length}종
                                </span>
                              )}
                            </div>
                          </div>
                          {isOpen
                            ? <ChevronUp size={14} className="text-slate-400 shrink-0" />
                            : <ChevronDown size={14} className="text-slate-400 shrink-0" />
                          }
                        </button>

                        {/* 펼침 내용 */}
                        {isOpen && (
                          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-4">

                            {/* ── 체크리스트 ── */}
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                체크리스트
                              </p>
                              {stageCks.length === 0 && !editMode && (
                                <p className="text-xs text-slate-400 italic">없음</p>
                              )}
                              <ul className="space-y-1">
                                {stageCks.map(ck => (
                                  <li key={ck.key} className="flex items-center gap-2 text-xs text-slate-600">
                                    <CheckCircle2 size={12} className="text-slate-300 shrink-0" />
                                    <span className="flex-1">{ck.label}</span>
                                    {ck.field && (
                                      <span className="text-[10px] font-semibold bg-blue-50 text-blue-500 border border-blue-100 px-1.5 py-0.5 rounded shrink-0">
                                        🔗 {FIELD_LABELS[ck.field] ?? ck.field}
                                      </span>
                                    )}
                                    {editMode && !ck.field && (
                                      <button
                                        onClick={() => removeCheck(proc.code, ck.key)}
                                        className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                    {editMode && ck.field && (
                                      <span className="text-[10px] text-slate-300 shrink-0">연동</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                              {editMode && (
                                <AddRow
                                  code={proc.code}
                                  value={newCheck[proc.code] ?? ''}
                                  onChange={v => setNewCheck(p => ({ ...p, [proc.code]: v }))}
                                  onAdd={() => addCheck(proc.code)}
                                  placeholder="체크 항목 입력 후 Enter"
                                />
                              )}
                            </div>

                            {/* 구분선 */}
                            <div className="border-t border-slate-200" />

                            {/* ── 필요 서류 ── */}
                            <div>
                              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1.5">
                                필요 서류
                              </p>
                              {stageDocs.length === 0 && !editMode && (
                                <p className="text-xs text-slate-400 italic">없음</p>
                              )}
                              <ul className="space-y-1">
                                {stageDocs.map(doc => (
                                  <li key={doc.key} className="flex items-center gap-2 text-xs text-slate-600">
                                    <FileText size={12} className="text-blue-400 shrink-0" />
                                    <span className="flex-1">{doc.label}</span>
                                    {editMode && (
                                      <button
                                        onClick={() => removeDoc(proc.code, doc.key)}
                                        className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                              {editMode && (
                                <AddRow
                                  code={proc.code}
                                  value={newDoc[proc.code] ?? ''}
                                  onChange={v => setNewDoc(p => ({ ...p, [proc.code]: v }))}
                                  onAdd={() => addDoc(proc.code)}
                                  placeholder="서류 이름 입력 후 Enter"
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
    </>
  )
}
