'use client'

import { useState } from 'react'
import { KeyRound, CheckCircle2 } from 'lucide-react'

interface Props { userName: string; userEmail: string }

export default function AccountClient({ userName, userEmail }: Props) {
  const [current, setCurrent] = useState('')
  const [next, setNext]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (next !== confirm) {
      setError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/account/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '오류가 발생했습니다.')
      } else {
        setSuccess(true)
        setCurrent(''); setNext(''); setConfirm('')
      }
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-50">
      {/* 헤더 */}
      <div className="px-6 py-4 shrink-0" style={{ background: '#111111' }}>
        <h1 className="text-lg font-bold text-white leading-tight">내 계정</h1>
        <p className="text-[11px] mt-0.5" style={{ color: '#C5D42A' }}>비밀번호 변경</p>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* 사용자 정보 카드 */}
          <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 mb-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-black shrink-0"
              style={{ backgroundColor: '#C5D42A' }}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">{userName}</div>
              <div className="text-xs text-slate-400">{userEmail}</div>
            </div>
          </div>

          {/* 비밀번호 변경 폼 */}
          <div className="bg-white border border-slate-200 rounded-xl px-6 py-6">
            <div className="flex items-center gap-2 mb-5">
              <KeyRound size={15} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">비밀번호 변경</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">현재 비밀번호</label>
                <input
                  type="password"
                  value={current}
                  onChange={e => setCurrent(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                  placeholder="현재 비밀번호 입력"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">새 비밀번호</label>
                <input
                  type="password"
                  value={next}
                  onChange={e => setNext(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                  placeholder="6자 이상"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">새 비밀번호 확인</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                  placeholder="새 비밀번호 재입력"
                />
              </div>

              {error && (
                <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  <CheckCircle2 size={13} />
                  비밀번호가 성공적으로 변경되었습니다.
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-black transition disabled:opacity-50"
                style={{ backgroundColor: '#C5D42A' }}
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
