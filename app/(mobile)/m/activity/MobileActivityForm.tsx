'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Link2, Unlink, AtSign, Car, Wallet, X } from 'lucide-react'
import { stratColor } from '@/lib/a3'

const CATEGORIES = [
  { label: '커뮤니케이션', types: ['내부회의', '외부미팅', '이메일', '전화·통화'] },
  { label: '현장·이동',    types: ['국내출장', '해외출장'] },
  { label: '발표·행사',    types: ['발표/전시·행사'] },
  { label: '학습',         types: ['교육/연수', '세미나·컨퍼런스'] },
  { label: '업무산출물',   types: ['문서·자료작성', '개발·구현', '도면·설계', '제품제작·조립', '콘텐츠·디자인'] },
  { label: '현장서비스',   types: ['AS출동', '설치·시운전', '정기점검'] },
  { label: '영업',         types: ['고객미팅', '신규영업', '제안/견적', '고객행사'] },
  { label: '관계·네트워킹',types: ['인재영입', '외부 네트워킹', '파트너십 타진'] },
  { label: '투자·IR',      types: ['IR 발표', '투자자 미팅', '투자행사'] },
  { label: '수주·발행',    types: ['견적서 발행', 'PO 발행', '수주 확정', '세금계산서 발행'] },
  { label: '경영·행정',    types: ['대관·신청', '세무·회계', '신고·갱신', '법무·계약', '경영기획'] },
  { label: 'HR',           types: ['연차', '반차(오전)', '반차(오후)', '재직증명서'] },
] as const

const LEAVE_TYPES = new Set(['연차', '반차(오전)', '반차(오후)', '재직증명서'])

type Team   = { id: string; name: string }
type Task   = { id: string; code: string; title: string; teamId: string; strategy: string; parentId: string | null; team?: { name: string } | null }
type Vehicle = { id: string; name: string; plateNo: string }

interface Props {
  teams:    Team[]
  tasks:    Task[]
  vehicles?: Vehicle[]
  initial?: { taskId?: string; teamId?: string; userId?: string; userName?: string; dealName?: string }
}

/* 공통 카드 토큰 */
const CARD  = 'bg-white rounded-xl border border-gray-100 overflow-hidden'
const LBL   = 'px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500'
const BODY  = 'px-4 py-3'
/* 분류 탭 칩과 유형 칩: 동일한 베이스 사이즈 */
const CHIP  = 'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors'

const toLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function MobileActivityForm({ teams, tasks, vehicles = [], initial }: Props) {
  const router = useRouter()

  // ── 기본 필드 ──
  const [linked,   setLinked]   = useState(!!initial?.taskId)
  const [teamId,   setTeamId]   = useState(initial?.teamId ?? teams[0]?.id ?? '')
  const [parentId, setParentId] = useState(() => {
    if (!initial?.taskId) return ''
    const t = tasks.find(x => x.id === initial.taskId)
    return t?.parentId ? (tasks.find(x => x.id === t.parentId)?.parentId ?? t.parentId) : (t?.id ?? '')
  })
  const [childId, setChildId] = useState(() => {
    if (!initial?.taskId) return ''
    const t = tasks.find(x => x.id === initial.taskId)
    return t?.parentId ? t.parentId : ''
  })
  const [date,    setDate]    = useState(new Date().toISOString().slice(0, 10))
  const [catIdx,  setCatIdx]  = useState(0)
  const [type,    setType]    = useState('내부회의')
  const [status,  setStatus]  = useState<'계획'|'완료'>('완료')
  const [title,   setTitle]   = useState(initial?.dealName ? `[${initial.dealName}] ` : '')
  const [content, setContent] = useState('')

  // ── 알림 ──
  const [mentions,     setMentions]     = useState<string[]>([])
  const [showMention,  setShowMention]  = useState(false)

  // ── 차량 ──
  const [showVehicle,  setShowVehicle]  = useState(false)
  const [vehicleId,    setVehicleId]    = useState('')
  const [vStartAt,     setVStartAt]     = useState(() => toLocal(new Date()))
  const [vEndAt,       setVEndAt]       = useState(() => { const d = new Date(); d.setHours(d.getHours()+2); return toLocal(d) })
  const [vPurpose,     setVPurpose]     = useState('')
  const [vDone,        setVDone]        = useState(false)
  const [vSaving,      setVSaving]      = useState(false)
  const [vError,       setVError]       = useState('')

  // ── 비용 ──
  const [showExpense,  setShowExpense]  = useState(false)
  const [expTransport, setExpTransport] = useState('')
  const [expAccomm,    setExpAccomm]    = useState('')
  const [expMeal,      setExpMeal]      = useState('')
  const [expOther,     setExpOther]     = useState('')
  const [expMethod,    setExpMethod]    = useState('')
  const [expNote,      setExpNote]      = useState('')

  // ── 제출 ──
  const [saving,  setSaving]  = useState(false)
  const [done,    setDone]    = useState(false)
  const [error,   setError]   = useState('')

  const parentTasks = tasks.filter(t => !t.parentId)
  const childTasks  = tasks.filter(t => t.parentId === parentId)
  const finalTaskId = linked ? (childId || parentId || null) : null
  const finalTeamId = linked
    ? (tasks.find(t => t.id === (childId || parentId))?.teamId ?? teamId)
    : teamId

  const expTotal = [expTransport, expAccomm, expMeal, expOther]
    .reduce((s, v) => s + (parseInt(v.replace(/,/g,''), 10) || 0), 0)

  function fmtNum(v: string) { const n = parseInt(v.replace(/,/g,''),10); return isNaN(n) ? '' : n.toLocaleString('ko-KR') }
  function rawNum(v: string) { return v.replace(/[^0-9]/g,'') }

  async function reserveVehicle() {
    if (!vehicleId || !vPurpose.trim()) { setVError('차량과 목적을 입력하세요.'); return }
    setVSaving(true); setVError('')
    try {
      const res = await fetch('/api/vehicle-reservations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId, purpose: vPurpose.trim(), startAt: vStartAt, endAt: vEndAt }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '예약 실패')
      setVDone(true)
    } catch (e: any) { setVError(e.message) }
    finally { setVSaving(false) }
  }

  async function submit() {
    if (linked && !parentId) { setError('전략과제를 선택하세요.'); return }
    if (!title.trim())       { setError('제목을 입력하세요.'); return }
    setSaving(true); setError('')
    const hasExp = showExpense && expTotal > 0
    try {
      const res = await fetch('/api/activities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: finalTeamId, taskId: finalTaskId,
          userId: initial?.userId, userName: initial?.userName,
          date, type, title: title.trim(), content: content || null, planStatus: status,
          mentions: mentions.length > 0 ? mentions.join(', ') : null,
          ...(hasExp ? {
            expenseTransport: parseInt(expTransport.replace(/,/g,''),10) || null,
            expenseAccomm:    parseInt(expAccomm.replace(/,/g,''),10) || null,
            expenseMeal:      parseInt(expMeal.replace(/,/g,''),10) || null,
            expenseOther:     parseInt(expOther.replace(/,/g,''),10) || null,
            expensePaymentMethod: expMethod || null,
            expenseNote: expNote || null,
          } : {}),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '저장 실패')
      setDone(true)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
        <CheckCircle2 size={52} className="text-emerald-500" />
        <p className="text-base font-bold text-gray-900">저장되었습니다</p>
        <p className="text-xs text-gray-400 text-center">{title.trim()}</p>
        <button onClick={() => { setDone(false); setTitle(initial?.dealName ? `[${initial.dealName}] ` : ''); setContent('') }}
          className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold">다른 활동 추가</button>
        <button onClick={() => router.push('/m/')}
          className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold">홈으로</button>
      </div>
    )
  }

  const currentCat = CATEGORIES[catIdx]
  const isLeave = LEAVE_TYPES.has(type)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <h1 className="text-base font-bold text-gray-900 px-0.5">활동 추가</h1>

        {/* ① 과제 연계 */}
        <div className={CARD}>
          <div className={LBL}>과제 연계</div>
          <div className={`${BODY} flex gap-2`}>
            <button onClick={() => setLinked(true)}
              className={`${CHIP} ${linked ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 bg-white'}`}>
              <Link2 size={13} className="inline mr-1.5" />과제 연계
            </button>
            <button onClick={() => { setLinked(false); setParentId(''); setChildId('') }}
              className={`${CHIP} ${!linked ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-200 text-gray-500 bg-white'}`}>
              <Unlink size={13} className="inline mr-1.5" />독립 활동
            </button>
          </div>
        </div>

        {/* ② 전략과제 */}
        {linked && (
          <div className={CARD}>
            <div className={LBL}>전략과제</div>
            <div className={`${BODY} space-y-1.5`}>
              {parentTasks.map(t => (
                <button key={t.id} onClick={() => { setParentId(t.id); setChildId('') }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors
                    ${parentId === t.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 bg-gray-50'}`}>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mr-1.5 ${stratColor(t.strategy).light}`}>{t.strategy}</span>
                  <span className="text-xs text-gray-400 mr-1.5">{t.code}</span>
                  <span className="text-sm text-gray-800">{t.title}</span>
                </button>
              ))}
            </div>
            {parentId && childTasks.length > 0 && (
              <>
                <div className={`${LBL} border-t`}>팀과제 <span className="font-normal text-gray-400">(선택)</span></div>
                <div className={`${BODY} space-y-1.5`}>
                  {childTasks.map(t => (
                    <button key={t.id} onClick={() => setChildId(childId === t.id ? '' : t.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors
                        ${childId === t.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 bg-gray-50'}`}>
                      <span className="text-xs text-gray-400 mr-1.5">{t.code}</span>
                      <span className="text-sm text-gray-800">{t.title}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ③ 담당 팀 */}
        {!linked && (
          <div className={CARD}>
            <div className={LBL}>담당 팀</div>
            <div className={`${BODY} flex flex-wrap gap-2`}>
              {teams.map(t => (
                <button key={t.id} onClick={() => setTeamId(t.id)}
                  className={`${CHIP} ${teamId === t.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 bg-white'}`}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ④ 날짜 */}
        <div className={CARD}>
          <div className={LBL}>날짜</div>
          <div className={BODY}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400" />
          </div>
        </div>

        {/* ⑤ 활동 유형 */}
        <div className={CARD}>
          <div className={LBL}>활동 유형</div>

          {/* 분류 — 회색 배경 */}
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">분류</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat, i) => (
                <button key={cat.label} onClick={() => { setCatIdx(i); setType(cat.types[0]) }}
                  className={`${CHIP} ${catIdx === i ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 bg-white'}`}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 유형 — 흰 배경 */}
          <div className={BODY}>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2">유형 선택 · {currentCat.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {currentCat.types.map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`${CHIP} ${type === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 bg-white'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ⑥ 진행 상태 */}
        <div className={CARD}>
          <div className={LBL}>진행 상태</div>
          <div className={`${BODY} flex gap-2`}>
            {(['계획','완료'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
                  ${status === s
                    ? s === '완료' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-600 text-white border-gray-600'
                    : 'border-gray-200 text-gray-500 bg-white'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* ⑦ 내용 */}
        <div className={CARD}>
          <div className={LBL}>내용 입력</div>
          <div className={`${BODY} space-y-3`}>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">제목 <span className="text-red-400">*</span></p>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="활동 제목"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">세부 내용</p>
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={4} placeholder="상세 내용 (선택)"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-400 resize-none" />
            </div>
          </div>
        </div>

        {/* ⑧ 선택 추가 */}
        <div className={CARD}>
          <div className={LBL}>선택 추가</div>
          <div className={`${BODY} flex flex-wrap gap-2`}>
            {/* 알림 */}
            <button onClick={() => setShowMention(v => !v)}
              className={`${CHIP} flex items-center gap-1.5 ${showMention || mentions.length > 0
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'border-gray-200 text-gray-500 bg-white'}`}>
              <AtSign size={13} />알림
              {mentions.length > 0 && (
                <span className="ml-1 bg-indigo-600 text-white rounded-full text-[9px] w-4 h-4 flex items-center justify-center">{mentions.length}</span>
              )}
            </button>

            {/* 차량 */}
            {vehicles.length > 0 && !isLeave && (
              <button onClick={() => setShowVehicle(v => !v)}
                className={`${CHIP} flex items-center gap-1.5 ${showVehicle || vDone
                  ? 'bg-lime-50 border-lime-300 text-lime-700'
                  : 'border-gray-200 text-gray-500 bg-white'}`}>
                <Car size={13} />차량
                {vDone && <span className="text-lime-600 text-xs font-bold">✓</span>}
              </button>
            )}

            {/* 비용 */}
            {!isLeave && (
              <button onClick={() => setShowExpense(v => !v)}
                className={`${CHIP} flex items-center gap-1.5 ${showExpense || expTotal > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'border-gray-200 text-gray-500 bg-white'}`}>
                <Wallet size={13} />비용
                {expTotal > 0 && <span className="text-amber-700 text-xs font-bold">{expTotal.toLocaleString()}원</span>}
              </button>
            )}
          </div>

          {/* 알림 패널 */}
          {showMention && (
            <div className="px-4 pb-4 pt-3 border-t border-gray-100 bg-indigo-50/30">
              <p className="text-xs font-semibold text-indigo-600 mb-2">알림 대상</p>
              {mentions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {mentions.map((m, i) => (
                    <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-xs text-indigo-700 font-semibold">
                      {m}
                      <button onClick={() => setMentions(prev => prev.filter((_, idx) => idx !== i))}><X size={10} /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => { if (!mentions.includes('@전체')) setMentions(p => [...p, '@전체']) }}
                  className="px-3 py-1.5 rounded-lg border border-indigo-200 text-xs font-semibold text-indigo-600 bg-white">
                  @전체
                </button>
                {teams.map(t => (
                  <button key={t.id} onClick={() => { const c = `@${t.name}`; if (!mentions.includes(c)) setMentions(p => [...p, c]) }}
                    className="px-3 py-1.5 rounded-lg border border-indigo-200 text-xs font-semibold text-indigo-600 bg-white">
                    @{t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 차량 패널 */}
          {showVehicle && !vDone && (
            <div className="px-4 pb-4 pt-3 border-t border-gray-100 bg-lime-50/30 space-y-3">
              <p className="text-xs font-semibold text-lime-700">차량 예약</p>
              <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-lime-400">
                <option value="">차량 선택</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNo})</option>)}
              </select>
              <input value={vPurpose} onChange={e => setVPurpose(e.target.value)} placeholder="사용 목적"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-lime-400" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">출발</p>
                  <input type="datetime-local" value={vStartAt} onChange={e => setVStartAt(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-lime-400" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">반납</p>
                  <input type="datetime-local" value={vEndAt} onChange={e => setVEndAt(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-lime-400" />
                </div>
              </div>
              {vError && <p className="text-xs text-red-500">{vError}</p>}
              <button onClick={reserveVehicle} disabled={vSaving}
                className="w-full py-2 rounded-lg bg-lime-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {vSaving && <Loader2 size={14} className="animate-spin" />}
                차량 예약 신청
              </button>
            </div>
          )}
          {showVehicle && vDone && (
            <div className="px-4 pb-3 pt-3 border-t border-gray-100 bg-lime-50/30">
              <p className="text-xs text-lime-700 font-semibold">✓ 차량 예약이 신청되었습니다</p>
            </div>
          )}

          {/* 비용 패널 */}
          {showExpense && (
            <div className="px-4 pb-4 pt-3 border-t border-gray-100 bg-amber-50/30 space-y-2">
              <p className="text-xs font-semibold text-amber-700 mb-2">비용 정산</p>
              {[
                { label: '교통비', val: expTransport, set: setExpTransport },
                { label: '숙박비', val: expAccomm,    set: setExpAccomm },
                { label: '식비',   val: expMeal,      set: setExpMeal },
                { label: '기타',   val: expOther,     set: setExpOther },
              ].map(({ label, val, set }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-12 text-xs text-gray-500 shrink-0">{label}</span>
                  <input type="text" inputMode="numeric" value={fmtNum(val)}
                    onChange={e => set(rawNum(e.target.value))}
                    placeholder="0"
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-right outline-none focus:border-amber-400" />
                  <span className="text-xs text-gray-400 shrink-0">원</span>
                </div>
              ))}
              {expTotal > 0 && (
                <div className="flex justify-between items-center pt-1 border-t border-amber-100">
                  <span className="text-xs text-gray-500">합계</span>
                  <span className="text-sm font-bold text-amber-700">{expTotal.toLocaleString()}원</span>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1.5">결제수단</p>
                <div className="flex gap-1.5">
                  {(['현금','법인카드','개인카드'] as const).map(m => (
                    <button key={m} onClick={() => setExpMethod(expMethod === m ? '' : m)}
                      className={`${CHIP} ${expMethod === m ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-500 bg-white'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <input value={expNote} onChange={e => setExpNote(e.target.value)} placeholder="비용 특이사항 (선택)"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400" />
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-500 px-1">{error}</p>}
      </div>

      {/* 저장 */}
      <div className="px-4 pb-6 pt-3 border-t border-gray-100 bg-white">
        <button onClick={submit} disabled={saving}
          className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
          {saving && <Loader2 size={16} className="animate-spin" />}
          저장하기
        </button>
      </div>
    </div>
  )
}
