'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Check, X, Trash2, FileCheck } from 'lucide-react'

interface Props {
  tripId: string
  status: string
  isAuthor: boolean
  isApprover: boolean
  approverId: string
  preApprovalStatus: string | null
  preApproverId: string | null
  isPreApprover: boolean
}

export default function TripActions({
  tripId, status, isAuthor, isApprover,
  preApprovalStatus, isPreApprover,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [comment, setComment] = useState('')
  const [preComment, setPreComment] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [showPreReject, setShowPreReject] = useState(false)
  const [showPreRequest, setShowPreRequest] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const patch = async (data: object) => {
    setBusy(true)
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      router.refresh()
    } finally {
      setBusy(false)
      setComment('')
      setPreComment('')
    }
  }

  const deleteFn = async () => {
    setBusy(true)
    await fetch(`/api/trips/${tripId}`, { method: 'DELETE' })
    router.push('/notes?tab=notes')
  }

  // ── 사전품의 요청 패널 (작성자, 초안, 아직 품의 없음) ──────────────
  const canRequestPreApproval = isAuthor && status === '초안' && !preApprovalStatus

  // ── 사전품의 승인 패널 (사전품의 승인자, 품의 요청 상태) ────────────
  const canHandlePreApproval = isPreApprover && preApprovalStatus === '요청'

  return (
    <div className="space-y-3">

      {/* 사전품의 요청 (작성자) */}
      {canRequestPreApproval && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 shadow-sm px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-blue-800">사전품의 요청 (선택)</p>
              <p className="text-xs text-blue-600 mt-0.5">
                기본정보·방문정보 작성 후 출장 전 승인을 요청할 수 있습니다. 건너뛰어도 됩니다.
              </p>
            </div>
            <button
              onClick={() => setShowPreRequest(v => !v)}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-100 transition-all"
            >
              <FileCheck size={14} />사전품의 요청
            </button>
          </div>
          {showPreRequest && (
            <div className="mt-3 space-y-2">
              <input
                value={preComment}
                onChange={e => setPreComment(e.target.value)}
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                placeholder="품의 요청 메모 (선택사항)"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => patch({
                    preApprovalStatus: '요청',
                    preApprovalRequestedAt: new Date().toISOString(),
                    preApprovalComment: preComment || null,
                  })}
                  disabled={busy}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 transition-all bg-blue-600 hover:bg-blue-700"
                >
                  <Send size={14} />품의 요청 제출
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 사전품의 승인 대기 안내 (작성자) */}
      {isAuthor && preApprovalStatus === '요청' && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm px-5 py-3">
          <p className="text-sm font-semibold text-amber-800">사전품의 검토 중</p>
          <p className="text-xs text-amber-600 mt-0.5">승인자가 사전품의를 검토하고 있습니다.</p>
        </div>
      )}

      {/* 사전품의 승인/반려 (승인자) */}
      {canHandlePreApproval && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 shadow-sm px-5 py-4 space-y-3">
          <p className="text-sm font-bold text-blue-800">사전품의 검토</p>
          <textarea
            rows={2}
            value={preComment}
            onChange={e => setPreComment(e.target.value)}
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            placeholder="품의 의견을 남겨주세요 (선택사항)"
          />
          <div className="flex items-center gap-3 justify-end">
            {showPreReject ? (
              <>
                <p className="text-xs text-red-600 mr-auto">사전품의를 반려하시겠습니까?</p>
                <button onClick={() => setShowPreReject(false)} className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg">취소</button>
                <button
                  onClick={() => patch({ preApprovalStatus: '반려', preApprovalComment: preComment || null })}
                  disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                  <X size={14} />반려 확인
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setShowPreReject(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
                  <X size={14} />반려
                </button>
                <button
                  onClick={() => patch({
                    preApprovalStatus: '승인',
                    preApprovalComment: preComment || null,
                    preApprovedAt: new Date().toISOString(),
                  })}
                  disabled={busy}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 bg-blue-600 hover:bg-blue-700">
                  <Check size={14} />사전 승인
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 최종 승인 요청 (작성자, 초안) */}
      {isAuthor && status === '초안' && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
          <p className="text-sm text-slate-500">
            {preApprovalStatus === '승인'
              ? '사전품의 승인 완료. 출장 후 보고서를 작성하여 최종 승인을 요청하세요.'
              : '작성 완료 후 최종 승인을 요청하세요.'}
          </p>
          <div className="flex gap-3">
            <button onClick={() => setShowDelete(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-all">
              <Trash2 size={13} />삭제
            </button>
            <button
              onClick={() => patch({ status: '승인요청', submittedAt: new Date().toISOString() })}
              disabled={busy}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Send size={14} />최종 승인 요청
            </button>
          </div>
        </div>
      )}

      {/* 재제출 (작성자, 반려) */}
      {isAuthor && status === '반려' && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-red-200 shadow-sm px-5 py-4">
          <p className="text-sm text-red-600">보고서를 수정 후 재제출 할 수 있습니다.</p>
          <button
            onClick={() => patch({ status: '승인요청', submittedAt: new Date().toISOString(), approvalComment: null })}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Send size={14} />재제출
          </button>
        </div>
      )}

      {/* 최종 승인/반려 처리 (승인자) */}
      {isApprover && status === '승인요청' && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm px-5 py-4 space-y-3">
          <p className="text-sm font-bold text-amber-800">이 출장보고서를 승인하시겠습니까?</p>
          <textarea
            rows={2}
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
            placeholder="승인 의견을 남겨주세요 (선택사항)"
          />
          <div className="flex items-center gap-3 justify-end">
            {showReject ? (
              <>
                <p className="text-xs text-red-600 mr-auto">반려 처리하시겠습니까?</p>
                <button onClick={() => setShowReject(false)} className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg">취소</button>
                <button
                  onClick={() => patch({ status: '반려', approvalComment: comment || null, approvedAt: null })}
                  disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                  <X size={14} />반려 확인
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setShowReject(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
                  <X size={14} />반려
                </button>
                <button
                  onClick={() => patch({ status: '승인', approvalComment: comment || null, approvedAt: new Date().toISOString() })}
                  disabled={busy}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 transition-all"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  <Check size={14} />승인
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showDelete && <DeleteConfirm onConfirm={deleteFn} onCancel={() => setShowDelete(false)} />}
    </div>
  )
}

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p className="text-base font-bold text-slate-900 mb-2">출장보고서 삭제</p>
        <p className="text-sm text-slate-500 mb-6">삭제하면 복구할 수 없습니다. 계속하시겠습니까?</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">취소</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600">삭제</button>
        </div>
      </div>
    </div>
  )
}
