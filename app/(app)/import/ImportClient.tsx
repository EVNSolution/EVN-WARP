'use client'

import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { useRouter } from 'next/navigation'

/* ── 엑셀 컬럼 정의 ── */
const TEMPLATE_COLS = [
  '딜ID',
  '고객명',
  '전화번호',
  '고객유형(B2C/B2B)',
  '회사명(B2B)',
  '단계코드',
  '영업상태',
  '유입경로',
  '수집일(YYYY-MM-DD)',
  '영업담당자',
  '지역_시',
  '지역_구',
  '구매시점',
  '메모',
]
const COL_WIDTHS = [36, 12, 14, 16, 18, 8, 8, 12, 18, 12, 10, 10, 12, 30]

type Status = 'new' | 'duplicate' | 'similar' | 'update'
type Action = 'update' | 'create' | 'link' | 'skip'

interface ImportRow {
  idx:             number
  dealId:          string
  name:            string
  phone:           string
  customerSegment: 'B2C' | 'B2B'
  companyName:     string
  stageCode:       string
  salesStatus:     string
  source:          string
  collectedAt:     string
  assignee:        string
  regionCity:      string
  regionDist:      string
  purchaseTiming:  string
  memo:            string
  status:          Status
  matchedId:       string | null
  matchedName:     string | null
  matchedPhone:    string | null
  action:          Action
}

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
  update:    { label: '수정',      color: 'bg-amber-100 text-amber-700' },
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
  const [result,   setResult]   = useState<{ created: number; updated: number; linked: number; skipped: number; errors: string[] } | null>(null)

  /* ── 현재 데이터 다운로드 ── */
  const downloadCurrent = () => { window.location.href = '/api/deals/export' }

  /* ── 빈 템플릿 다운로드 ── */
  const downloadTemplate = () => {
    const sample = [
      ['', '홍길동', '010-1234-5678', 'B2C', '', '1-1', '진행중', '소개', '2026-07-01', '이담당', '서울', '강남구', '3개월 이내', '상온 배송 관심'],
      ['', '(주)물류', '02-123-4567', 'B2B', '(주)물류', '1-2', '진행중', '전시회', '2026-07-01', '', '경기', '성남시', '', '컬리 화주 문의'],
    ]
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLS, ...sample])
    ws['!cols'] = COL_WIDTHS.map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '리드등록')
    const guide = XLSX.utils.aoa_to_sheet([
      ['필드', '허용값'],
      ['고객유형', 'B2C  /  B2B'],
      ['단계코드', '1-1  1-2  1-3  2-1  2-2  2-3  3-1  3-2  3-3  4-1  4-2  이탈  완료'],
      ['영업상태', '진행중  /  완료  /  이탈'],
      ['', ''],
      ['딜ID가 있는 행', '기존 딜을 수정합니다'],
      ['딜ID가 없는 행', '신규 딜을 생성합니다'],
    ])
    guide['!cols'] = [{ wch: 16 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, guide, '안내')
    XLSX.writeFile(wb, 'EVN_리드_템플릿.xlsx')
  }

  /* ── 파일 파싱 + 중복 확인 ── */
  const processFile = useCallback(async (file: File) => {
    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(buf, { type: 'array' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

    const seg  = (v: unknown) => String(v ?? '').toUpperCase() === 'B2B' ? 'B2B' : 'B2C'

    const parsed = data
      .filter(r => String(r['고객명'] ?? '').trim() || String(r['회사명(B2B)'] ?? '').trim())
      .map((r, idx) => ({
        idx,
        dealId:          String(r['딜ID']               ?? '').trim(),
        name:            String(r['고객명']              ?? '').trim(),
        phone:           fmtPhone(String(r['전화번호']   ?? '')),
        customerSegment: seg(r['고객유형(B2C/B2B)']) as 'B2C' | 'B2B',
        companyName:     String(r['회사명(B2B)']         ?? '').trim(),
        stageCode:       String(r['단계코드']             ?? '').trim() || '1-1',
        salesStatus:     String(r['영업상태']             ?? '').trim() || '진행중',
        source:          String(r['유입경로']             ?? '').trim(),
        collectedAt:     String(r['수집일(YYYY-MM-DD)']  ?? '').trim(),
        assignee:        String(r['영업담당자']           ?? '').trim(),
        regionCity:      String(r['지역_시']              ?? '').trim(),
        regionDist:      String(r['지역_구']              ?? '').trim(),
        purchaseTiming:  String(r['구매시점']             ?? '').trim(),
        memo:            String(r['메모']                ?? '').trim(),
      }))

    if (parsed.length === 0) {
      alert('처리할 행이 없습니다. 고객명 또는 회사명 컬럼을 확인하세요.')
      return
    }

    // dealId 있는 행 → 'update' (중복 확인 불필요)
    const updateRows = parsed.filter(r => r.dealId)
    const newRows    = parsed.filter(r => !r.dealId)

    const updateImportRows: ImportRow[] = updateRows.map(r => ({
      ...r, status: 'update', matchedId: null, matchedName: null, matchedPhone: null, action: 'update',
    }))

    if (newRows.length === 0) {
      setRows(updateImportRows)
      setStage('preview')
      return
    }

    setChecking(true)
    try {
      const res = await fetch('/api/import/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          newRows.map(r => ({ index: r.idx, name: r.name || r.companyName, phone: r.phone || null }))
        ),
      })
      const checks: {
        index: number; status: 'new' | 'duplicate' | 'similar'
        matchedId: string | null; matchedName: string | null; matchedPhone: string | null
      }[] = await res.json()

      const checkMap = Object.fromEntries(checks.map(c => [c.index, c]))
      const newImportRows: ImportRow[] = newRows.map(r => {
        const c = checkMap[r.idx]
        return {
          ...r,
          status:       c.status,
          matchedId:    c.matchedId,
          matchedName:  c.matchedName,
          matchedPhone: c.matchedPhone,
          action:       (c.status === 'duplicate' ? 'link' : 'create') as Action,
        }
      })

      setRows([...updateImportRows, ...newImportRows])
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
            dealId:          r.dealId          || undefined,
            linkCustomerId:  r.action === 'link' ? (r.matchedId ?? undefined) : undefined,
            name:            r.name            || r.companyName,
            phone:           r.phone           || undefined,
            customerSegment: r.customerSegment,
            companyName:     r.companyName     || undefined,
            stageCode:       r.stageCode       || undefined,
            salesStatus:     r.salesStatus     || undefined,
            source:          r.source          || undefined,
            collectedAt:     r.collectedAt     || undefined,
            assignee:        r.assignee        || undefined,
            regionCity:      r.regionCity      || undefined,
            regionDist:      r.regionDist      || undefined,
            purchaseTiming:  r.purchaseTiming  || undefined,
            memo:            r.memo            || undefined,
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
    total:  rows.length,
    update: rows.filter(r => r.action === 'update').length,
    create: rows.filter(r => r.action === 'create').length,
    link:   rows.filter(r => r.action === 'link').length,
    skip:   rows.filter(r => r.action === 'skip').length,
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-0.5">리드 데이터 관리</p>
          <h1 className="text-lg font-bold text-slate-800">엑셀 일괄 등록 · 수정</h1>
        </div>
        <div className="flex gap-2">
          {stage === 'preview' && (
            <button onClick={() => { setStage('upload'); setRows([]) }}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
              ← 다시 업로드
            </button>
          )}
          <button onClick={() => router.push('/funnel')}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
            파이프라인
          </button>
          <button onClick={() => router.push('/customers')}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
            고객 관리
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ══ STAGE: upload ══ */}
        {stage === 'upload' && (
          <div className="flex flex-col gap-6">
            {/* 안내 */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <h2 className="text-sm font-bold text-blue-800 mb-2">사용 방법</h2>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li><strong>현재 데이터 다운로드</strong>로 기존 리드 전체를 받거나, <strong>빈 템플릿</strong>으로 신규 데이터를 입력합니다</li>
                <li>딜ID가 있는 행은 <strong>기존 리드 수정</strong>, 없는 행은 <strong>신규 등록</strong>으로 처리됩니다</li>
                <li>파일을 업로드하면 신규 행에 한해 중복 고객 여부를 자동 확인합니다</li>
                <li>미리보기에서 처리 방법을 확인하고 일괄 적용합니다</li>
              </ol>
            </div>

            {/* 다운로드 버튼 2종 */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={downloadCurrent}
                className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-6 py-4 hover:border-blue-300 hover:bg-blue-50/50 transition text-left group">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">현재 데이터 다운로드</p>
                  <p className="text-xs text-slate-400 mt-0.5">DB의 리드 전체 · 수정 후 업로드</p>
                </div>
              </button>

              <button onClick={downloadTemplate}
                className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-6 py-4 hover:border-green-300 hover:bg-green-50/50 transition text-left group">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0 group-hover:bg-green-200 transition">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">빈 템플릿 다운로드</p>
                  <p className="text-xs text-slate-400 mt-0.5">신규 입력용 · 예시 데이터 포함</p>
                </div>
              </button>
            </div>

            {/* 컬럼 안내 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                엑셀 컬럼 구성 ({TEMPLATE_COLS.length}개 · 고객정보 + 파이프라인 단계 통합)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATE_COLS.map((col, i) => (
                  <div key={col} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-center shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-sm text-slate-600">{col}</span>
                    {col === '고객명' && <span className="text-[10px] text-red-500 font-bold">*필수</span>}
                    {col === '딜ID' && <span className="text-[10px] text-amber-600 font-bold">수정시</span>}
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs text-slate-500">
                <div><span className="font-bold text-slate-700">고객유형:</span> B2C / B2B</div>
                <div><span className="font-bold text-slate-700">단계코드:</span> 1-1 ~ 4-2 · 이탈 · 완료</div>
                <div><span className="font-bold text-slate-700">영업상태:</span> 진행중 / 완료 / 이탈</div>
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
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-600">파일을 여기에 드래그하거나 클릭하여 선택</p>
                    <p className="text-xs text-slate-400">.xlsx / .xls 파일 지원</p>
                  </>
              }
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} className="hidden" />
            </div>
          </div>
        )}

        {/* ══ STAGE: preview ══ */}
        {stage === 'preview' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: '전체',      value: counts.total,  color: 'bg-slate-100 text-slate-700' },
                { label: '수정',      value: counts.update, color: 'bg-amber-100 text-amber-700' },
                { label: '신규 등록', value: counts.create, color: 'bg-green-100 text-green-700' },
                { label: '기존 연결', value: counts.link,   color: 'bg-blue-100 text-blue-700' },
                { label: '건너뜀',    value: counts.skip,   color: 'bg-slate-100 text-slate-400' },
              ].map(s => (
                <div key={s.label} className={`${s.color} rounded-xl px-4 py-3 text-center`}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs font-semibold mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-3 text-xs font-bold text-slate-500 w-8">#</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-slate-500">상태</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-slate-500">이름</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-slate-500">전화번호</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-slate-500">유형</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-slate-500">단계</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-slate-500">기존 고객</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-slate-500 w-36">처리 방법</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(row => {
                      const si = STATUS_INFO[row.status]
                      const displayName = row.customerSegment === 'B2B' && row.companyName
                        ? row.companyName
                        : (row.name || row.companyName)
                      return (
                        <tr key={row.idx} className={row.action === 'skip' ? 'opacity-40' : ''}>
                          <td className="px-3 py-2.5 text-xs text-slate-400">{row.idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${si.color}`}>
                              {si.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-800">
                            {displayName}
                            {row.customerSegment === 'B2B' && row.name && row.companyName && (
                              <span className="text-xs text-slate-400 ml-1">({row.name})</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500 text-xs">{row.phone || '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded
                              ${row.customerSegment === 'B2B' ? 'bg-violet-100 text-violet-700' : 'bg-blue-50 text-blue-600'}`}>
                              {row.customerSegment}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono text-slate-600">{row.stageCode}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">
                            {row.status === 'update'
                              ? <span className="text-amber-600">딜 수정</span>
                              : row.matchedName
                              ? <span>
                                  <span className="font-semibold text-slate-700">{row.matchedName}</span>
                                  {row.matchedPhone && <span className="text-slate-400 ml-1">{row.matchedPhone}</span>}
                                </span>
                              : <span className="text-slate-300">—</span>
                            }
                          </td>
                          <td className="px-3 py-2.5">
                            <select
                              value={row.action}
                              onChange={e => setAction(row.idx, e.target.value as Action)}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300">
                              {row.dealId && <option value="update">수정</option>}
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

            <div className="flex items-center justify-between">
              <div className="flex gap-2 items-center">
                <span className="text-xs text-slate-500">전체 변경:</span>
                <button onClick={() => setRows(prev => prev.map(r => r.dealId ? { ...r, action: 'update' } : r))}
                  className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition">
                  수정 가능 → 수정
                </button>
                <button onClick={() => setRows(prev => prev.map(r => !r.dealId ? { ...r, action: 'create' } : r))}
                  className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition">
                  신규 → 모두 등록
                </button>
                <button onClick={() => setRows(prev => prev.map(r => ({ ...r, action: 'skip' })))}
                  className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition">
                  모두 건너뜀
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setStage('upload'); setRows([]) }}
                  className="px-5 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
                  취소
                </button>
                <button
                  onClick={handleExecute}
                  disabled={saving || counts.total - counts.skip === 0}
                  className="px-8 py-2 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-40 flex items-center gap-2">
                  {saving
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />처리 중...</>
                    : `${counts.total - counts.skip}건 적용`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ STAGE: done ══ */}
        {stage === 'done' && result && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-6">일괄 처리 완료</h2>
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-green-700">{result.created}</p>
                <p className="text-xs text-green-600 font-semibold mt-1">신규</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-amber-700">{result.updated}</p>
                <p className="text-xs text-amber-600 font-semibold mt-1">수정</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-blue-700">{result.linked}</p>
                <p className="text-xs text-blue-600 font-semibold mt-1">연결</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-slate-400">{result.skipped}</p>
                <p className="text-xs text-slate-400 font-semibold mt-1">건너뜀</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-red-50 rounded-xl p-4 mb-6 text-left">
                <p className="text-xs font-bold text-red-600 mb-2">오류 {result.errors.length}건</p>
                {result.errors.map((e, i) => <p key={i} className="text-xs text-red-500">{e}</p>)}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setStage('upload'); setRows([]); setResult(null) }}
                className="px-5 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
                추가 업로드
              </button>
              <button onClick={() => router.push('/funnel')}
                className="px-5 py-2 text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-500">
                파이프라인
              </button>
              <button onClick={() => router.push('/customers')}
                className="px-5 py-2 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700">
                고객 관리
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
