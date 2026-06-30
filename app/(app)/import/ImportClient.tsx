'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { useRouter } from 'next/navigation'

/* ── 템플릿 열 정의 ── */
const TEMPLATE_COLS = [
  '이름',
  '전화번호',
  '고객유형(B2C/B2B)',
  '고객유입경로',
  '회사명(B2B)',
  '리드발굴경로',
  '담당영업사원',
  '메모',
]
const CUST_SOURCES = ['소개', '온라인', '전시장/이벤트', '직접방문', '기타']
const LEAD_SOURCES = ['소개', '자체발굴', '인바운드', 'SNS', '전시회', '기타']

type Status = 'new' | 'duplicate' | 'similar'
type Action = 'create' | 'link' | 'skip'

interface ImportRow {
  idx:             number
  name:            string
  phone:           string
  customerSegment: 'B2C' | 'B2B'
  customerSource:  string
  companyName:     string
  leadSource:      string
  assignee:        string
  memo:            string
  /* 중복 확인 결과 */
  status:         Status
  matchedId:      string | null
  matchedName:    string | null
  matchedPhone:   string | null
  /* 처리 방법 */
  action:         Action
}

/* ── 전화번호 하이픈 포맷 ── */
function fmtPhone(raw: string): string {
  const d = String(raw ?? '').replace(/\D/g, '').slice(0, 11)
  if (!d) return ''
  if (d.startsWith('02')) {
    if (d.length <= 5) return `${d.slice(0,2)}-${d.slice(2)}`
    if (d.length <= 9) return `${d.slice(0,2)}-${d.slice(2,5)}-${d.slice(5)}`
    return `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6)}`
  }
  if (d.length <= 6) return `${d.slice(0,3)}-${d.slice(3)}`
  if (d.length <= 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`
  return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`
}

const STATUS_INFO: Record<Status, { label: string; color: string }> = {
  new:       { label: '신규',      color: 'bg-green-100 text-green-700' },
  similar:   { label: '유사 고객', color: 'bg-yellow-100 text-yellow-700' },
  duplicate: { label: '기존 고객', color: 'bg-red-100 text-red-600' },
}

export default function ImportClient() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [stage,    setStage]    = useState<'upload' | 'preview' | 'done'>('upload')
  const [dragging, setDragging] = useState(false)
  const [checking, setChecking] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [rows,     setRows]     = useState<ImportRow[]>([])
  const [result,   setResult]   = useState<{ created: number; linked: number; skipped: number; errors: string[] } | null>(null)

  /* ── 템플릿 다운로드 ── */
  const downloadTemplate = () => {
    const sample = [
      ['홍길동', '010-1234-5678', 'B2C', '소개', '', '자체발굴', '이담당', '상온 배송 관심 있음'],
      ['(주)물류', '02-123-4567', 'B2B', '전시장/이벤트', '(주)물류', '인바운드', '', '컬리 화주 문의'],
    ]
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLS, ...sample])

    /* 열 너비 */
    ws['!cols'] = [
      { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 },
    ]

    /* 드롭다운 힌트 메모 */
    const hints: Record<string, string> = {
      C: `선택값: B2C, B2B`,
      D: `선택값: ${CUST_SOURCES.join(', ')}`,
      F: `선택값: ${LEAD_SOURCES.join(', ')}`,
    }
    Object.entries(hints).forEach(([col, note]) => {
      const cell = `${col}1`
      if (!ws[cell]) ws[cell] = { t: 's', v: TEMPLATE_COLS[col.charCodeAt(0) - 65] }
      ws[cell].c = [{ a: 'EVN', t: note }]
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '고객_리드_등록')
    XLSX.writeFile(wb, 'EVN_등록_템플릿.xlsx')
  }

  /* ── 파일 파싱 + 중복 확인 ── */
  const processFile = useCallback(async (file: File) => {
    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(buf, { type: 'array' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const data  = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

    const parsed: Omit<ImportRow, 'status' | 'matchedId' | 'matchedName' | 'matchedPhone' | 'action'>[] =
      data
        .filter(r => String(r['이름'] ?? '').trim())
        .map((r, idx) => ({
          idx,
          name:            String(r['이름'] ?? '').trim(),
          phone:           fmtPhone(String(r['전화번호'] ?? '')),
          customerSegment: String(r['고객유형(B2C/B2B)'] ?? '').toUpperCase() === 'B2B' ? 'B2B' : 'B2C',
          customerSource:  String(r['고객유입경로'] ?? ''),
          companyName:     String(r['회사명(B2B)'] ?? ''),
          leadSource:      String(r['리드발굴경로'] ?? ''),
          assignee:        String(r['담당영업사원'] ?? ''),
          memo:            String(r['메모'] ?? ''),
        }))

    if (parsed.length === 0) { alert('이름이 입력된 행이 없습니다.'); return }

    setChecking(true)
    try {
      const res = await fetch('/api/import/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.map(p => ({ index: p.idx, name: p.name, phone: p.phone || null }))),
      })
      const checks: { index: number; status: Status; matchedId: string | null; matchedName: string | null; matchedPhone: string | null }[] = await res.json()

      const checkMap = Object.fromEntries(checks.map(c => [c.index, c]))

      setRows(parsed.map(p => {
        const c = checkMap[p.idx]
        const defaultAction: Action = c.status === 'duplicate' ? 'link' : 'create'
        return { ...p, ...c, action: defaultAction }
      }))
      setStage('preview')
    } finally {
      setChecking(false)
    }
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processFile(f)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }

  const setAction = (idx: number, action: Action) =>
    setRows(prev => prev.map(r => r.idx === idx ? { ...r, action } : r))

  /* ── 일괄 처리 실행 ── */
  const handleExecute = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          rows.map(r => ({
            action:          r.action,
            linkCustomerId:  r.action === 'link' ? (r.matchedId ?? undefined) : undefined,
            name:            r.name,
            phone:           r.phone || undefined,
            customerSegment: r.customerSegment,
            customerSource:  r.customerSource || undefined,
            companyName:     r.companyName || undefined,
            leadSource:      r.leadSource || undefined,
            assignee:        r.assignee || undefined,
            memo:            r.memo || undefined,
          }))
        ),
      })
      const data = await res.json()
      setResult(data)
      setStage('done')
    } finally {
      setSaving(false)
    }
  }

  const counts = {
    total:   rows.length,
    newRows: rows.filter(r => r.action === 'create').length,
    link:    rows.filter(r => r.action === 'link').length,
    skip:    rows.filter(r => r.action === 'skip').length,
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-0.5">고객 · 리드 관리</p>
          <h1 className="text-lg font-bold text-slate-800">엑셀 일괄 등록</h1>
        </div>
        <div className="flex gap-2">
          {stage === 'preview' && (
            <button onClick={() => { setStage('upload'); setRows([]) }}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
              ← 다시 업로드
            </button>
          )}
          <button onClick={() => router.push('/customers')}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
            고객 관리로 이동
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ══════ STAGE: upload ══════ */}
        {stage === 'upload' && (
          <div className="flex flex-col gap-6">
            {/* 안내 카드 */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <h2 className="text-sm font-bold text-blue-800 mb-2">📋 사용 방법</h2>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>아래 <strong>템플릿 다운로드</strong>를 눌러 양식을 받으세요</li>
                <li>양식에 고객 및 리드 정보를 입력합니다</li>
                <li>파일을 업로드하면 기존 고객 중복 여부를 자동으로 확인합니다</li>
                <li>미리보기에서 처리 방법을 확인하고 일괄 등록합니다</li>
              </ol>
            </div>

            {/* 템플릿 다운로드 */}
            <button onClick={downloadTemplate}
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-6 py-4 hover:border-slate-300 hover:bg-slate-50 transition text-left">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-xl">📥</div>
              <div>
                <p className="text-sm font-bold text-slate-800">템플릿 다운로드</p>
                <p className="text-xs text-slate-400 mt-0.5">EVN_등록_템플릿.xlsx · 8개 열 · 예시 데이터 포함</p>
              </div>
            </button>

            {/* 열 안내 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">템플릿 열 구성</p>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATE_COLS.map((col, i) => (
                  <div key={col} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-center shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-sm text-slate-600">{col}</span>
                    {(col.includes('이름')) && (
                      <span className="text-[10px] text-red-500 font-bold">*필수</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 업로드 존 */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition
                ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'}`}>
              {checking
                ? <>
                    <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
                    <p className="text-sm text-slate-500 font-medium">중복 여부 확인 중...</p>
                  </>
                : <>
                    <div className="text-4xl">📂</div>
                    <p className="text-sm font-semibold text-slate-600">파일을 여기에 드래그하거나 클릭하여 선택</p>
                    <p className="text-xs text-slate-400">.xlsx, .xls, .csv 파일 지원</p>
                  </>
              }
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} className="hidden" />
            </div>
          </div>
        )}

        {/* ══════ STAGE: preview ══════ */}
        {stage === 'preview' && (
          <div className="flex flex-col gap-4">
            {/* 요약 */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '전체',           value: counts.total,   color: 'bg-slate-100 text-slate-700' },
                { label: '신규 등록',       value: counts.newRows, color: 'bg-green-100 text-green-700' },
                { label: '기존 고객 연결',  value: counts.link,    color: 'bg-blue-100 text-blue-700' },
                { label: '건너뜀',          value: counts.skip,    color: 'bg-slate-100 text-slate-500' },
              ].map(s => (
                <div key={s.label} className={`${s.color} rounded-xl px-4 py-3 text-center`}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs font-semibold mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* 테이블 */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest w-8">#</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">상태</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">이름</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">전화번호</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">유형</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">기존 고객</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest w-40">처리 방법</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(row => {
                      const si = STATUS_INFO[row.status]
                      return (
                        <tr key={row.idx} className={`transition ${row.action === 'skip' ? 'opacity-40' : ''}`}>
                          <td className="px-4 py-3 text-xs text-slate-400">{row.idx + 1}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${si.color}`}>
                              {si.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {row.name}
                            {row.companyName && (
                              <span className="text-xs text-slate-400 ml-1.5">({row.companyName})</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.phone || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded
                              ${row.customerSegment === 'B2B' ? 'bg-violet-100 text-violet-700' : 'bg-blue-50 text-blue-600'}`}>
                              {row.customerSegment}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {row.matchedName
                              ? <span>
                                  <span className="font-semibold text-slate-700">{row.matchedName}</span>
                                  {row.matchedPhone && <span className="text-slate-400 ml-1">{row.matchedPhone}</span>}
                                </span>
                              : <span className="text-slate-300">—</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={row.action}
                              onChange={e => setAction(row.idx, e.target.value as Action)}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300">
                              <option value="create">신규 등록</option>
                              {row.matchedId && <option value="link">기존 고객 연결</option>}
                              <option value="skip">건너뜀</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 전체 선택 도구 */}
            <div className="flex gap-2">
              <span className="text-xs text-slate-500 mr-2 self-center">전체 변경:</span>
              {(['create', 'link', 'skip'] as Action[]).map(a => (
                <button key={a} onClick={() => setRows(prev => prev.map(r => {
                  if (a === 'link' && !r.matchedId) return r
                  return { ...r, action: a }
                }))}
                  className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition">
                  모두 {a === 'create' ? '신규 등록' : a === 'link' ? '기존 연결' : '건너뜀'}
                </button>
              ))}
            </div>

            {/* 실행 버튼 */}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setStage('upload'); setRows([]) }}
                className="px-6 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
                취소
              </button>
              <button onClick={handleExecute} disabled={saving || counts.total - counts.skip === 0}
                className="px-8 py-2.5 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-40 flex items-center gap-2">
                {saving
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />처리 중...</>
                  : `${counts.total - counts.skip}건 일괄 등록`}
              </button>
            </div>
          </div>
        )}

        {/* ══════ STAGE: done ══════ */}
        {stage === 'done' && result && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-md mx-auto">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-lg font-bold text-slate-800 mb-6">일괄 등록 완료</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-green-700">{result.created}</p>
                <p className="text-xs text-green-600 font-semibold mt-1">신규 등록</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-blue-700">{result.linked}</p>
                <p className="text-xs text-blue-600 font-semibold mt-1">기존 연결</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-slate-500">{result.skipped}</p>
                <p className="text-xs text-slate-400 font-semibold mt-1">건너뜀</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-red-50 rounded-xl p-4 mb-6 text-left">
                <p className="text-xs font-bold text-red-600 mb-2">오류 발생 ({result.errors.length}건)</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-500">{e}</p>
                ))}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setStage('upload'); setRows([]); setResult(null) }}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
                추가 등록
              </button>
              <button onClick={() => router.push('/funnel')}
                className="px-5 py-2.5 text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-500">
                영업 파이프라인 보기
              </button>
              <button onClick={() => router.push('/customers')}
                className="px-5 py-2.5 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700">
                고객 관리 보기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
