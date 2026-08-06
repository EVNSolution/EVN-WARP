'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, X } from 'lucide-react'

interface Props {
  taskId: string
  hasSubTasks: boolean
}

export default function DeleteTaskButton({ taskId, hasSubTasks }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`/api/a3/${taskId}`, { method: 'DELETE' })
      router.push('/a3')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 text-sm text-red-600 border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors font-medium"
      >
        <Trash2 size={14} /> 삭제
      </button>

      {/* 삭제 확인 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Trash2 size={18} className="text-red-500" />
                <h2 className="text-base font-bold text-slate-900">전략과제 삭제</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-2">
              <p className="text-sm text-slate-500">
                이 전략과제를 삭제하시겠습니까? <span className="font-semibold text-red-500">삭제된 데이터는 되돌릴 수 없습니다.</span>
              </p>
              {hasSubTasks && (
                <p className="text-sm font-semibold text-red-500">
                  하부 과제가 모두 함께 삭제됩니다.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                {deleting ? '삭제 중...' : '삭제 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
