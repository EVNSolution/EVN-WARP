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
    <div className="bg-white rounded-xl border border-slate-200 px-6 py-6">
      <h2 className="text-sm font-semibold text-slate-700">AI 연결 (Claude · ChatGPT)</h2>
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
                <b>Claude</b>: 설정 → 커넥터 → 커스텀 커넥터 추가 → 위 주소 붙여넣기 →
                인증 방식은 <b>「로그인 없음」</b> 선택 (주소에 내 토큰이 들어 있어 헤더 추가 불필요)<br />
                <b>ChatGPT</b>: 설정 → 커넥터(개발자 모드) → 새 커넥터 → 위 주소 붙여넣기 → 인증 「없음」
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

          <DongjakConnect />
        </div>
      )}
    </div>
  )
}

/** 회의실 예약(동작사무실) 계정 연결 — AI가 내 이름으로 회의실을 잡을 수 있게 한다. */
function DongjakConnect() {
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [userName, setUserName] = useState('')
  const [form, setForm] = useState(false)
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = async () => {
    try {
      const r = await fetch('/api/account/dongjak').then(r => r.json())
      setConnected(!!r.connected)
      setUserName(r.userName ?? '')
    } catch { /* 표시용 */ }
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  const login = async () => {
    setBusy(true); setError('')
    const r = await fetch('/api/account/dongjak', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: pw }),
    }).then(r => r.json())
    setBusy(false)
    if (r.ok) { setForm(false); setId(''); setPw(''); refresh() }
    else setError(r.error || '로그인 실패')
  }

  const disconnect = async () => {
    if (!window.confirm('회의실 예약 연결을 해제할까요?')) return
    setBusy(true)
    await fetch('/api/account/dongjak', { method: 'DELETE' })
    setBusy(false)
    refresh()
  }

  return (
    <div className="border-t border-slate-100 pt-3 mt-1">
      <div className="text-xs font-semibold text-slate-700">회의실 예약 계정 연결 (선택)</div>
      <p className="text-[11px] text-slate-400 mt-0.5 mb-2">
        <b>서울창업센터(동작) 로그인 계정을 확인한 후 입력하세요.</b> 회사 메일/WARP 계정과
        연동되지 않는 <b>센터 홈페이지의 별도 계정</b>입니다.
        연결하면 AI에게 &ldquo;내일 2시 회의실 잡아줘&rdquo;가 가능해집니다.
        비밀번호는 저장되지 않습니다.
      </p>
      {loading ? <p className="text-[11px] text-slate-400">확인 중...</p> : connected ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-600 font-semibold">연결됨{userName ? ` · ${userName}` : ''}</span>
          <button onClick={disconnect} disabled={busy} className="text-[11px] px-2 py-1 rounded border border-slate-300 text-slate-500">해제</button>
        </div>
      ) : form ? (
        <div className="space-y-2 max-w-xs">
          <input value={id} onChange={e => setId(e.target.value)} placeholder="서울창업센터(동작) ID"
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5" />
          <input value={pw} onChange={e => setPw(e.target.value)} type="password" placeholder="비밀번호"
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5"
            onKeyDown={e => e.key === 'Enter' && login()} />
          {error && (
            <p className="text-[11px] text-red-500">
              {error}
              {error.includes('올바르지 않') && ' — 서울창업센터(동작) 홈페이지에서 직접 로그인되는 계정인지 확인해 주세요.'}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={login} disabled={busy || !id || !pw}
              className="text-xs px-3 py-1.5 rounded bg-slate-800 text-white disabled:opacity-50">연결</button>
            <button onClick={() => { setForm(false); setError('') }} className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-500">취소</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setForm(true)} className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-600">
          회의실 계정 연결
        </button>
      )}
    </div>
  )
}
