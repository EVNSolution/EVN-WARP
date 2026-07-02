'use client'

import { useRouter } from 'next/navigation'

export default function ExcelImportExport() {
  const router = useRouter()

  const handleDownload = () => { window.location.href = '/api/deals/export' }
  const handleUpload   = () => { router.push('/import') }

  return (
    <>
      <button
        onClick={handleDownload}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition"
        title="현재 리드 전체를 엑셀로 다운로드"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        엑셀 다운로드
      </button>

      <button
        onClick={handleUpload}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition"
        title="엑셀로 리드 일괄 등록·수정"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
        </svg>
        엑셀 업로드
      </button>
    </>
  )
}
