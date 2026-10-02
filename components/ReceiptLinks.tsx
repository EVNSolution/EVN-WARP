import { receiptList } from '@/lib/cardUsage'

// 사용내역 목록용 영수증 링크 (📎1 📎2 …)
export default function ReceiptLinks({ receiptUrl }: { receiptUrl: string | null | undefined }) {
  const urls = receiptList(receiptUrl)
  if (urls.length === 0) return null
  return (
    <span className="inline-flex gap-1.5 ml-1">
      {urls.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          className="text-[11px] text-blue-600 hover:underline">📎{urls.length > 1 ? i + 1 : '영수증'}</a>
      ))}
    </span>
  )
}
