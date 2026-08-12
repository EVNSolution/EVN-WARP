'use client'

import { useState } from 'react'
import { UserCog, CalendarDays, FileText, Network, Plus, Check, X } from 'lucide-react'
import { calcAnnualLeaveGranted, tenureLabel } from '@/lib/leave'

type LeaveRequest = {
  id: string; userId: string; userName: string; type: string
  startDate: string; endDate: string; days: number; reason: string | null
  status: string; approverName: string | null; approvedAt: string | null; rejectReason: string | null
  createdAt: string
}
type HrRecord = {
  id: string; userId: string; userName: string; type: string
  title: string; detail: string | null; effectiveDate: string; createdByName: string | null; createdAt: string
}
type TeamRow = { id: string; name: string; users: { id: string; name: string; position: string | null }[] }
type UserOpt = { id: string; name: string }
type Me = { id: string; name: string; position: string | null; hireDate: string | null; team: { name: string } | null }

const LEAVE_TYPES = ['연차', '반차(오전)', '반차(오후)', '경조사', '기타']
const HR_RECORD_TYPES = ['입사', '직급변경', '부서이동', '평가', '기타']
const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  '대기':  { bg: 'bg-amber-100', text: 'text-amber-700' },
  '승인':  { bg: 'bg-green-100', text: 'text-green-700' },
  '반려':  { bg: 'bg-red-100',   text: 'text-red-600' },
}

function fmt(d: string) { return d?.slice(0, 10) ?? '' }

export default function HrClient({
  isManager, me, myLeaves: initialMyLeaves, pendingLeaves: initialPendingLeaves, teams, allUsers, myHrRecords: initialMyHrRecords,
}: {
  isManager: boolean
  me: Me
  myLeaves: LeaveRequest[]
  pendingLeaves: LeaveRequest[]
  teams: TeamRow[]
  allUsers: UserOpt[]
  myHrRecords: HrRecord[]
}) {
  const [tab, setTab] = useState<'attendance' | 'certificate' | 'record' | 'orgchart'>('attendance')

  /* ── 근태 ── */
  const [myLeaves, setMyLeaves] = useState(initialMyLeaves)
  const [pendingLeaves, setPendingLeaves] = useState(initialPendingLeaves)
  const [leaveType, setLeaveType] = useState(LEAVE_TYPES[0])
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [reason,    setReason]    = useState('')
  const [submittingLeave, setSubmittingLeave] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const isHalfDay = leaveType.startsWith('반차')
  const days = isHalfDay ? 0.5 : (startDate && endDate)
    ? Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
    : 0

  const granted = me.hireDate ? calcAnnualLeaveGranted(new Date(me.hireDate)) : 0
  const used = myLeaves.filter(l => l.status === '승인' && (l.type === '연차' || l.type.startsWith('반차'))).reduce((s, l) => s + l.days, 0)
  const remaining = Math.max(0, granted - used)

  const submitLeave = async () => {
    const effEnd = isHalfDay ? startDate : endDate
    if (!startDate || !effEnd) return
    setSubmittingLeave(true)
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: leaveType, startDate, endDate: effEnd, days, reason }),
      })
      if (res.ok) {
        const data = await res.json()
        setMyLeaves(prev => [data, ...prev])
        setStartDate(''); setEndDate(''); setReason('')
      }
    } finally { setSubmittingLeave(false) }
  }

  const cancelLeave = async (id: string) => {
    if (!confirm('신청을 취소할까요?')) return
    await fetch(`/api/leave-requests/${id}`, { method: 'DELETE' })
    setMyLeaves(prev => prev.filter(l => l.id !== id))
  }

  const decideLeave = async (id: string, status: '승인' | '반려') => {
    setProcessingId(id)
    try {
      const rejectReason = status === '반려' ? (prompt('반려 사유를 입력해주세요 (선택)') ?? '') : ''
      const res = await fetch(`/api/leave-requests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rejectReason }),
      })
      if (res.ok) setPendingLeaves(prev => prev.filter(l => l.id !== id))
    } finally { setProcessingId(null) }
  }

  /* ── 증명서 ── */
  const [purpose, setPurpose] = useState('')
  const [issuing, setIssuing] = useState(false)

  const issueEmployment = async () => {
    setIssuing(true)
    try {
      await fetch('/api/certificates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certType: '재직증명서', purpose }),
      })
      window.open(`/hr/certificate/employment/print?purpose=${encodeURIComponent(purpose)}`, '_blank')
    } finally { setIssuing(false) }
  }

  /* ── 인사기록카드 ── */
  const [selectedUserId, setSelectedUserId] = useState(me.id)
  const [hrRecords, setHrRecords] = useState(initialMyHrRecords)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [showRecordAdd, setShowRecordAdd] = useState(false)
  const [newRecord, setNewRecord] = useState({ type: HR_RECORD_TYPES[0], title: '', detail: '', effectiveDate: new Date().toISOString().slice(0, 10) })
  const [addingRecord, setAddingRecord] = useState(false)

  const loadRecords = async (userId: string) => {
    setSelectedUserId(userId)
    if (userId === me.id) { setHrRecords(initialMyHrRecords); return }
    setLoadingRecords(true)
    try {
      const res = await fetch(`/api/hr-records?userId=${userId}`)
      setHrRecords(await res.json())
    } finally { setLoadingRecords(false) }
  }

  const addRecord = async () => {
    if (!newRecord.title.trim()) return
    setAddingRecord(true)
    try {
      const targetUser = allUsers.find(u => u.id === selectedUserId)
      const res = await fetch('/api/hr-records', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newRecord, userId: selectedUserId, userName: targetUser?.name ?? me.name }),
      })
      if (res.ok) {
        const data = await res.json()
        setHrRecords(prev => [data, ...prev])
        setNewRecord({ type: HR_RECORD_TYPES[0], title: '', detail: '', effectiveDate: new Date().toISOString().slice(0, 10) })
        setShowRecordAdd(false)
      }
    } finally { setAddingRecord(false) }
  }

  const TABS = [
    { key: 'attendance',  label: '근태',       icon: CalendarDays },
    { key: 'certificate', label: '증명서',     icon: FileText },
    { key: 'record',      label: '인사기록카드', icon: UserCog },
    { key: 'orgchart',    label: '조직도',     icon: Network },
  ] as const

  return (
    <div className="p-6" style={{ maxWidth: '1100px' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 mb-4 rounded-xl" style={{ backgroundColor: '#111111' }}>
        <div>
          <h1 className="text-xl font-bold text-white">인사 (HR)</h1>
          <p className="text-xs mt-0.5" style={{ color: '#C5D42A' }}>근태 · 증명서 발급 · 인사기록 · 조직도</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-white">{me.name}</p>
          <p className="text-[11px] text-slate-400">{me.team?.name ?? '팀 미배정'} {me.position ? `· ${me.position}` : ''}</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-0 mb-4 border-b border-slate-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-6 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              tab === key ? 'border-[#C5D42A] text-[#7a9200] bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ══ 근태 ══ */}
      {tab === 'attendance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '연차 발생일수', val: granted, color: 'text-slate-700', bg: 'bg-slate-50' },
              { label: '사용일수',     val: used,    color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: '잔여일수',     val: remaining, color: 'text-emerald-700', bg: 'bg-emerald-50' },
            ].map(({ label, val, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-4`}>
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`text-2xl font-black tabular-nums ${color}`}>{val}<span className="text-sm font-semibold ml-1">일</span></p>
              </div>
            ))}
          </div>
          {me.hireDate && (
            <p className="text-[11px] text-slate-400">
              입사일 {fmt(me.hireDate)} · 근속 {tenureLabel(new Date(me.hireDate))} 기준 근사 계산 (사규와 다를 수 있습니다)
            </p>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-sm font-bold text-slate-700 mb-3">휴가 신청</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {LEAVE_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setLeaveType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${leaveType === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{isHalfDay ? '날짜' : '시작일'}</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
              </div>
              {!isHalfDay && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">종료일</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
              )}
              <div className={isHalfDay ? 'col-span-2' : ''}>
                <label className="text-xs text-slate-500 mb-1 block">사유 (선택)</label>
                <input value={reason} onChange={e => setReason(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-slate-400">{days > 0 ? `${days}일 소진` : ''}</span>
              <button onClick={submitLeave} disabled={submittingLeave || !startDate || (!isHalfDay && !endDate)}
                className="px-5 py-2 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-40">
                {submittingLeave ? '신청 중...' : '신청'}
              </button>
            </div>
          </div>

          {isManager && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
                <span className="text-sm font-bold text-slate-700">승인 대기</span>
                <span className="text-xs font-bold text-amber-600">{pendingLeaves.length}건</span>
              </div>
              {pendingLeaves.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">대기중인 신청이 없습니다.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingLeaves.map(l => (
                    <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{l.userName} · {l.type} ({l.days}일)</p>
                        <p className="text-xs text-slate-400 mt-0.5">{fmt(l.startDate)} ~ {fmt(l.endDate)}{l.reason ? ` · ${l.reason}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => decideLeave(l.id, '승인')} disabled={processingId === l.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition">
                          <Check size={11} /> 승인
                        </button>
                        <button onClick={() => decideLeave(l.id, '반려')} disabled={processingId === l.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition">
                          <X size={11} /> 반려
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-700">내 신청 내역</span>
            </div>
            {myLeaves.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">신청 내역이 없습니다.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {myLeaves.map(l => {
                  const s = STATUS_STYLE[l.status] ?? STATUS_STYLE['대기']
                  return (
                    <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{l.type} ({l.days}일)</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>{l.status}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {fmt(l.startDate)} ~ {fmt(l.endDate)}{l.reason ? ` · ${l.reason}` : ''}
                          {l.status === '반려' && l.rejectReason ? ` · 반려사유: ${l.rejectReason}` : ''}
                        </p>
                      </div>
                      {l.status === '대기' && (
                        <button onClick={() => cancelLeave(l.id)} className="text-[11px] text-slate-300 hover:text-red-500 transition shrink-0">취소</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ 증명서 ══ */}
      {tab === 'certificate' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-sm font-bold text-slate-700 mb-3">재직증명서</p>
            <p className="text-xs text-slate-400 mb-3">성명·입사일·직위·소속은 시스템에 등록된 정보가 자동으로 반영됩니다.</p>
            <label className="text-xs text-slate-500 mb-1 block">용도</label>
            <input value={purpose} onChange={e => setPurpose(e.target.value)}
              placeholder="예: 은행 제출용"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-1 focus:ring-slate-400" />
            <button onClick={issueEmployment} disabled={issuing}
              className="w-full px-4 py-2.5 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-40">
              발급 (새 탭에서 인쇄)
            </button>
          </div>
        </div>
      )}

      {/* ══ 인사기록카드 ══ */}
      {tab === 'record' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            {isManager ? (
              <select value={selectedUserId} onChange={e => loadRecords(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400">
                {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            ) : (
              <span className="text-sm font-bold text-slate-700">{me.name}의 인사기록</span>
            )}
            {isManager && (
              <button onClick={() => setShowRecordAdd(v => !v)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition">
                <Plus size={12} /> 기록 추가
              </button>
            )}
          </div>

          {showRecordAdd && (
            <div className="p-5 bg-slate-50 border-b border-slate-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">구분</label>
                  <select value={newRecord.type} onChange={e => setNewRecord(p => ({ ...p, type: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400">
                    {HR_RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">발생일</label>
                  <input type="date" value={newRecord.effectiveDate} onChange={e => setNewRecord(p => ({ ...p, effectiveDate: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">제목</label>
                  <input value={newRecord.title} onChange={e => setNewRecord(p => ({ ...p, title: e.target.value }))}
                    placeholder="예: 대리 승진"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">상세 (선택)</label>
                  <input value={newRecord.detail} onChange={e => setNewRecord(p => ({ ...p, detail: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={addRecord} disabled={addingRecord || !newRecord.title.trim()}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 transition">
                  {addingRecord ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => setShowRecordAdd(false)} className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition">취소</button>
              </div>
            </div>
          )}

          {loadingRecords ? (
            <p className="text-xs text-slate-400 text-center py-8">불러오는 중...</p>
          ) : hrRecords.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">등록된 인사기록이 없습니다.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {hrRecords.map(r => (
                <div key={r.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{r.type}</span>
                    <span className="text-sm font-semibold text-slate-800">{r.title}</span>
                    <span className="text-xs text-slate-400">{fmt(r.effectiveDate)}</span>
                  </div>
                  {r.detail && <p className="text-xs text-slate-500 mt-1">{r.detail}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ 조직도 ══ */}
      {tab === 'orgchart' && (
        <div className="grid grid-cols-3 gap-4">
          {teams.map(t => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-800 flex items-center justify-between">
                <span className="text-sm font-bold text-white">{t.name}</span>
                <span className="text-xs text-slate-300">{t.users.length}명</span>
              </div>
              <div className="p-3 space-y-1">
                {t.users.length === 0 ? (
                  <p className="text-xs text-slate-300 text-center py-3">소속 인원 없음</p>
                ) : (
                  t.users.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50">
                      <span className="text-sm text-slate-700">{u.name}</span>
                      {u.position && <span className="text-xs text-slate-400">{u.position}</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
