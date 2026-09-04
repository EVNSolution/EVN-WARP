'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        padding: '8px 18px', background: '#1a4b8c', color: '#fff', border: 'none',
        fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 4,
      }}>
      🖨 인쇄 / PDF 저장
    </button>
  )
}
