'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Check, X, Trash2, FileCheck, UserPlus, Undo2, Save } from 'lucide-react'

type ApproverType = '동의' | '결재'

interface Approver {
  userId: string
  userName: string
  type: ApproverType
  status: string
  approvedAt: string | null
  comment: string | null
}

interface User {
  id: string
  name: string | null
  email: string
}

interface Props {
  tripId: string
  status: string
  isAuthor: boolean
  isApprover: boolean
  approverId: string
  approversJson: string
  preApprovalStatus: string | null
  preApproverId: string | null
  isPreApprover: boolean
  users: User[]
  currentApproverType: ApproverType | null
}

const TYPE_STYLE: Record<ApproverType, { bg: string; text: string; label: string }> = {
  '동의': { bg: 'bg-blue-100',   text: 'text-blue-700',   label: '동의' },
  '결재': { bg: 'bg-purple-100', text: 'text-purple-700', label: '결재' },
}

const STATUS_STYLE: Record<string, string> = {
  '대기': 'text-slate-400',
  '동의': 'text-blue-600',
  '승인': 'text-green-600',
  '반려': 'text-red-500',
}

export default function TripActions({
  tripId, status, isAuthor, isApprover,
  approversJson,
  preApprovalStatus, isPreApprover,
  users,
  currentApproverType,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [comment, setComment] = useState('')
  const [preComment, setPreComment] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [showPreReject, setShowPreReject] = useState(false)
  const [showPreRequest, setShowPreRequest] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const [approvers, setApprovers] = useState<Approver[]>(() => {
    try {
      return (JSON.parse(approversJson) as any[]).map(a => ({
        ...a,
        type: (a.type ?? '결재') as ApproverType,
      }))
    } catch { return [] }
  })
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedType, setSelectedType] = useState<ApproverType>('동의')
  const [savingApprovers, setSavingApprovers] = useState(false)

  const hasApprover = approvers.length > 0

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

  const saveApprovers = async (newApprovers: Approver[]) => {
    setSavingApprovers(true)
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approversJson: JSON.stringify(newApprovers) }),
      })
      setApprovers(newApprovers)
    } finally {
      setSavingApprovers(false)
    }
  }

  const addApprover = () => {
    if (!selectedUserId) return
    const user = users.find(u => u.id === selectedUserId)
    if (!user) return
    if (approvers.some(a => a.userId === selectedUserId)) return
    setApprovers(prev => [...prev, {
      userId: user.id,
      userName: user.name ?? user.email,
      type: selectedType,
      status: '대기',
      approvedAt: null,
      comment: null,
    }])
    setSelectedUserId('')
  }

  const removeApprover = (userId: string) => {
    setApprovers(prev => prev.filter(a => a.userId !== userId))
  }

  const saveDraft = async () => {
    setBusy(true)
    try {
      window.dispatchEvent(new CustomEvent('save-trip-days'))
      await saveApprovers(approvers)
    } finally {
      setBusy(false)
    }
  }

  const submitApproval = async () => {
    if (!hasApprover) return
    setBusy(true)
    try {
      window.dispatchEvent(new CustomEvent('save-trip-days'))
      await fetch(`/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approversJson: JSON.stringify(approvers),
          status: '승인요청',
          submittedAt: new Date().toISOString(),
        }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const withdrawApproval = async () => {
    await patch({ status: '초안', submittedAt: null })
  }

  const handleApprove = async (action: '동의' | '승인' | '반려') => {
    setBusy(true)
    try {
      await fetch(`/api/trips/${tripId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: comment || null }),
      })
      router.refresh()
    } finally {
      setBusy(false)
      setComment('')
      setShowReject(false)
    }
  }

  const deleteFn = async () => {
    setBusy(true)
    await fetch(`/api/trips/${tripId}`, { method: 'DELETE' })
    router.push('/notes?tab=notes')
  }

  const canRequestPreApproval = isAuthor && status === '초안' && !preApprovalStatus
  const canHandlePreApproval  = isPreApprover && preApprovalStatus === '요청'
  const availableUsers = users.filter(u => !approvers.some(a => a.userId === u.id))

  const isMyTurn = currentApproverType != null && isApprover && status === '승인요청'
  const actionLabel = currentApproverType === '동의' ? '동의' : '승인'
  const actionColor = currentApproverType === '동의'
    ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
    : 'linear-gradient(135deg, #10b981, #059669)'

  const ApproverList = ({ editable }: { editable: boolean }) => (
    <div className="space-y-1.5 mb-3">
      {approvers.map((a, i) => {
        const ts = TYPE_STYLE[a.type] ?? TYPE_STYLE['결재']
        const ss = STATUS_STYLE[a.status] ?? 'text-slate-400'
        return (
          <div key={a.userId} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] flex items-center justify-center font-bold shrink-0">{i + 1}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ts.bg} ${ts.text} shrink-0`}>{ts.label}</span>
            <span className="text-sm text-slate-800 flex-1">{a.userName}</span>
            <span className={`text-xs font-semibold ${ss}`}>{a.status}</span>
            {editable && (
              <button onClick={() => removeApprover(a.userId)}
                className="text-slate-300 hover:text-red-400 transition-colors">
                <X size={13} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-3">

      {/* 사전품의 요청 (작성자) */}
      {canRequestPreApproval && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 shadow-sm px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-blue-800">사전품의 요청 (선택)</p>
              <p className="text-xs text-blue-600 mt-0.5">기본정보·방문정보 작성 후 출장 전 승인을 요청할 수 있습니다.</p>
            </div>
            <button onClick={() => setShowPreRequest(v => !v)}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-100 transition-all">
              <FileCheck size={14} />사전품의 요청
            </button>
          </div>
          {showPreRequest && (
            <div className="mt-3 space-y-2">
              <input value={preComment} onChange={e => setPreComment(e.target.value)}
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                placeholder="품의 요청 메모 (선택사항)" />
              <div className="flex justify-end">
                <button onClick={() => patch({ preApprovalStatus: '요청', preApprovalRequestedAt: new Date().toISOString(), preApprovalComment: preComment || null })}
                  disabled={busy}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 bg-blue-600 hover:bg-blue-700">
                  <Send size={14} />품의 요청 제출
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 사전품의 승인 대기 안내 */}
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
          <textarea rows={2} value={preComment} onChange={e => setPreComment(e.target.value)}
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            placeholder="품의 의견을 남겨주세요 (선택사항)" />
          <div className="flex items-center gap-3 justify-end">
            {showPreReject ? (
              <>
                <p className="text-xs text-red-600 mr-auto">사전품의를 반려하시겠습니까?</p>
                <button onClick={() => setShowPreReject(false)} className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg">취소</button>
                <button onClick={() => patch({ preApprovalStatus: '반려', preApprovalComment: preComment || null })} disabled={busy}
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
                <button onClick={() => patch({ preApprovalStatus: '승인', preApprovalComment: preComment || null, preApprovedAt: new Date().toISOString() })} disabled={busy}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 bg-blue-600 hover:bg-blue-700">
                  <Check size={14} />사전 승인
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 결재라인 + 최종 승인 요청 (작성자, 초안) */}
      {isAuthor && status === '초안' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-slate-700">결재라인</p>
              {!hasApprover && (
                <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  결재자를 지정해야 품의 요청이 가능합니다
                </span>
              )}
            </div>

            {approvers.length > 0 && <ApproverList editable />}

            {/* 결재자 추가 */}
            {availableUsers.length > 0 && (
              <div className="space-y-2">
                {/* 동의 / 결재 타입 선택 */}
                <div className="flex gap-3">
                  {(['동의', '결재'] as ApproverType[]).map(t => {
                    const ts = TYPE_STYLE[t]
                    const checked = selectedType === t
                    return (
                      <label key={t} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm font-semibold transition-all
                        ${checked ? `${ts.bg} ${ts.text} border-current` : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        <input type="radio" name="approverType" value={t} checked={checked}
                          onChange={() => setSelectedType(t)} className="sr-only" />
                        {t}
                      </label>
                    )
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                    <option value="">인원 선택...</option>
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                    ))}
                  </select>
                  <button onClick={addApprover} disabled={!selectedUserId}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    <UserPlus size={14} />추가
                  </button>
                </div>
              </div>
            )}

          </div>

          <div className="px-5 py-4 flex items-center justify-between">
            <button onClick={() => setShowDelete(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-all">
              <Trash2 size={13} />삭제
            </button>
            <div className="flex items-center gap-2">
              <button onClick={saveDraft} disabled={busy}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all">
                <Save size={14} />초안 저장
              </button>
              <button onClick={submitApproval} disabled={busy || !hasApprover}
                title={!hasApprover ? '결재자를 먼저 지정해주세요' : ''}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: hasApprover ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#94a3b8' }}>
                <Send size={14} />최종 승인 요청
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 승인요청 철회 (작성자) */}
      {isAuthor && status === '승인요청' && (
        <div className="flex items-center justify-between bg-amber-50 rounded-xl border border-amber-200 shadow-sm px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-amber-800">승인 요청 중</p>
            <p className="text-xs text-amber-600 mt-0.5">요청을 철회하면 초안으로 돌아가 수정할 수 있습니다.</p>
          </div>
          <button onClick={withdrawApproval} disabled={busy}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-all">
            <Undo2 size={14} />승인요청 철회
          </button>
        </div>
      )}

      {/* 재제출 (작성자, 반려) */}
      {isAuthor && status === '반려' && (
        <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-red-100">
            <p className="text-sm font-bold text-slate-700 mb-3">결재라인</p>
            {approvers.length > 0 && <ApproverList editable />}
            {availableUsers.length > 0 && (
              <div className="space-y-2">
                <div className="flex gap-3">
                  {(['동의', '결재'] as ApproverType[]).map(t => {
                    const ts = TYPE_STYLE[t]
                    const checked = selectedType === t
                    return (
                      <label key={t} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm font-semibold transition-all
                        ${checked ? `${ts.bg} ${ts.text} border-current` : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        <input type="radio" name="approverType" value={t} checked={checked}
                          onChange={() => setSelectedType(t)} className="sr-only" />
                        {t}
                      </label>
                    )
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                    <option value="">인원 선택...</option>
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                    ))}
                  </select>
                  <button onClick={addApprover} disabled={!selectedUserId}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-all">
                    <UserPlus size={14} />추가
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="px-5 py-4 flex items-center justify-between">
            <p className="text-sm text-red-600">보고서를 수정 후 재제출 할 수 있습니다.</p>
            <button onClick={() => patch({ status: '승인요청', submittedAt: new Date().toISOString(), approvalComment: null })}
              disabled={busy || !hasApprover}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40 transition-all"
              style={{ background: hasApprover ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#94a3b8' }}>
              <Send size={14} />재제출
            </button>
          </div>
        </div>
      )}

      {/* 동의/결재 처리 (내 차례인 경우) */}
      {isMyTurn && (
        <div className="rounded-xl border shadow-sm px-5 py-4 space-y-3"
          style={{ background: currentApproverType === '동의' ? '#eff6ff' : '#f0fdf4',
                   borderColor: currentApproverType === '동의' ? '#bfdbfe' : '#bbf7d0' }}>
          <p className="text-sm font-bold" style={{ color: currentApproverType === '동의' ? '#1e40af' : '#065f46' }}>
            {currentApproverType === '동의' ? '동의 요청을 받았습니다' : '결재 요청을 받았습니다'}
          </p>
          <textarea rows={2} value={comment} onChange={e => setComment(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white"
            style={{ borderColor: currentApproverType === '동의' ? '#bfdbfe' : '#bbf7d0' }}
            placeholder="의견을 남겨주세요 (선택사항)" />
          <div className="flex items-center gap-3 justify-end">
            {showReject ? (
              <>
                <p className="text-xs text-red-600 mr-auto">반려 처리하시겠습니까?</p>
                <button onClick={() => setShowReject(false)} className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg">취소</button>
                <button onClick={() => handleApprove('반려')} disabled={busy}
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
                <button onClick={() => handleApprove(currentApproverType === '동의' ? '동의' : '승인')} disabled={busy}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 transition-all"
                  style={{ background: actionColor }}>
                  <Check size={14} />{actionLabel}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 대기 중 안내 (결재라인에 있지만 아직 내 차례 아님) */}
      {isApprover && status === '승인요청' && !isMyTurn && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm px-5 py-3">
          <p className="text-sm font-semibold text-slate-600">처리 대기 중</p>
          <p className="text-xs text-slate-400 mt-0.5">이전 인원의 처리가 완료되면 알림을 받습니다.</p>
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
