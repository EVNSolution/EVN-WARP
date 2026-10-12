'use client'

import { useEffect, useState } from 'react'

/**
 * 내 계정 — AI 연결 (원격 MCP) 섹션.
 * 토큰을 발급해 개인 Claude/ChatGPT 에 커넥터로 등록하게 한다. 토큰은 발급 순간 한 번만 표시.
 */
export default function McpConnectSection() {
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')

  const refresh = async () => {
    try {
      const r = await fetch('/api/account/mcp-token').then(r => r.json())
      setConnected(!!r.connected)
      setLastUsedAt(r.lastUsedAt)
    } catch { /* 표시용 — 실패해도 화면은 유지 */ }
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  const issue = async () => {
    if (connected && !window.confirm('재발급하면 기존 토큰은 즉시 사용할 수 없게 됩니다. 계속할까요?')) return
    setBusy(true)
    const r = await fetch('/api/account/mcp-token', { method: 'POST' }).then(r => r.json())
    setBusy(false)
    if (r.token) { setToken(r.token); refresh() }
    else alert(r.error || '발급에 실패했습니다.')
  }

  const revoke = async () => {
    if (!window.confirm('AI 연결을 해제할까요? 연결된 Claude/ChatGPT 에서 더 이상 WARP 를 쓸 수 없게 됩니다.')) return
    setBusy(true)
    await fetch('/api/account/mcp-token', { method: 'DELETE' })
    setBusy(false)
    setToken('')
    refresh()
  }

  const copy = (value: string, key: string) => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(''), 1500)
    })
  }

  const connectorUrl = token ? `${window.location.origin}/api/mcp/${token}` : ''

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6">
      <h2 className="text-sm font-bold text-slate-800">AI 연결 (Claude · ChatGPT)</h2>
      <p className="text-xs text-slate-400 mt-1">
        개인 AI 에서 &ldquo;오늘 한 일 WARP에 정리해줘&rdquo;, &ldquo;내일 2시 미팅 캘린더에 올려줘&rdquo;가 가능해집니다.
        토큰은 <b>내 계정 권한</b>으로 동작합니다.
      </p>

      {loading ? (
        <p className="text-xs text-slate-400 mt-4">불러오는 중...</p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="text-xs text-slate-600">
            상태: {connected
              ? <span className="text-emerald-600 font-semibold">연결됨{lastUsedAt ? ` · 마지막 사용 ${new Date(lastUsedAt).toLocaleDateString('ko-KR')}` : ''}</span>
              : <span className="text-slate-400">미연결</span>}
          </div>

          {token && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
              <p className="text-[11px] text-amber-700 font-semibold">
                아래 주소는 지금 한 번만 표시됩니다 — 바로 복사해 등록하세요. (분실 시 재발급)
              </p>
              <div>
                <div className="text-[11px] text-slate-500 mb-1">연결 주소 (Claude·ChatGPT 커넥터에 붙여넣기)</div>
                <div className="flex gap-2 items-center">
                  <code className="text-[11px] bg-white border border-slate-200 rounded px-2 py-1 flex-1 break-all">{connectorUrl}</code>
                  <button onClick={() => copy(connectorUrl, 'url')}
                    className="text-[11px] px-2 py-1 rounded bg-slate-800 text-white shrink-0">
                    {copied === 'url' ? '복사됨' : '복사'}
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 leading-relaxed">
                <b>Claude</b>: 설정 → 커넥터 → 커스텀 커넥터 추가 → 위 주소 붙여넣기<br />
                <b>ChatGPT</b>: 설정 → 커넥터(개발자 모드) → 새 커넥터 → 위 주소 붙여넣기
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={issue} disabled={busy}
              className="text-xs px-3 py-2 rounded-lg bg-slate-800 text-white disabled:opacity-50">
              {connected ? '토큰 재발급' : '연결 토큰 발급'}
            </button>
            {connected && (
              <button onClick={revoke} disabled={busy}
                className="text-xs px-3 py-2 rounded-lg border border-slate-300 text-slate-600 disabled:opacity-50">
                연결 해제
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
