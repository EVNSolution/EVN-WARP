'use client'
export default function PrintButton() {
  return (
    <button onClick={() => window.print()}
      className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow transition">
      🖨 인쇄 / PDF 저장
    </button>
  )
}
