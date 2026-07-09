'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plane, MapPin, Save, Send, X, Trash2, ChevronUp, ChevronDown, UserPlus } from 'lucide-react'
import TripDayTable from '@/components/TripDayTable'

function addBullets(text: string): string {
  if (!text.trim()) return text
  return text.split('\n').map(line => {
    const t = line.trim()
    return t === '' ? '' : t.startsWith('• ') ? t : '• ' + t
  }).join('\n')
}

// 글머리(•) 자동 삽입 + IME 한글 지원 textarea
function BulletTextarea({ value, onChange, rows = 2, placeholder, className }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; className?: string
}) {
  const [local, setLocal] = useState(() => addBullets(value))
  const composing = useRef(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (!composing.current) setLocal(addBullets(value)) }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !composing.current) {
      e.preventDefault()
      const ta = e.currentTarget
      const s = ta.selectionStart
      const next = local.slice(0, s) + '\n• ' + local.slice(ta.selectionEnd)
      setLocal(next)
      setTimeout(() => ta.setSelectionRange(s + 3, s + 3), 0)
    }
  }
  const handleFocus = () => { if (!local.trim()) setLocal('• ') }
  const flush = (v: string) => { onChange(v) }

  return (
    <textarea
      ref={taRef}
      value={local}
      rows={rows}
      className={className}
      placeholder={placeholder}
      onChange={e => setLocal(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onCompositionStart={() => { composing.current = true }}
      onCompositionEnd={e => { composing.current = false; flush((e.target as HTMLTextAreaElement).value) }}
      onBlur={e => { if (!composing.current) flush(e.target.value) }}
    />
  )
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start)
  const last = new Date(end)
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}
function fmtDate(d: string) {
  const dt = new Date(d)
  return `${dt.getUTCMonth() + 1}월 ${dt.getUTCDate()}일`
}
interface DraftDay { city: string; company: string; activity: string; transport: string; accommodation: string; meal: string; other: string }
const emptyDay = (): DraftDay => ({ city: '', company: '', activity: '', transport: '', accommodation: '', meal: '', other: '' })

export interface TripUser { id: string; name: string; email: string; role: string }

export interface TripData {
  id?: string
  type: string
  title: string
  userId?: string
  userName: string
  teamName?: string
  destination: string
  purpose: string
  visitTarget?: string
  companions?: string
  startDate: string
  endDate: string
  transport?: string
  accommodation?: string
  budgetTransport?: number | null
  budgetAccomm?: number | null
  budgetMeal?: number | null
  budgetOther?: number | null
  actualTransport?: number | null
  actualAccomm?: number | null
  actualMeal?: number | null
  actualOther?: number | null
  schedule?: string
  result?: string
  nextAction?: string
  status?: string
  approverId?: string
  approverName?: string
  approvalComment?: string
  preApproverId?: string
  preApproverName?: string
}

interface Props {
  mode: 'create' | 'edit'
  initial: TripData
  users: TripUser[]
  currentUserId: string
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
      <h2 className="text-sm font-bold text-slate-700">{title}</h2>
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
)

const Field = ({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      {hint && <span className="ml-1.5 font-normal text-slate-400">{hint}</span>}
    </label>
    {children}
  </div>
)

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
const moneyInput = (value: number | null | undefined, onChange: (v: number | null) => void) => (
  <div className="relative">
    <input
      type="number"
      min={0}
      className={`${inputCls} pr-8`}
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      placeholder="0"
    />
    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">만원</span>
  </div>
)

interface Approver { userId: string; userName: string; order: number; status: string; comment: string | null; approvedAt: string | null }
interface Traveler { userId: string; userName: string }

export default function TripForm({ mode, initial, users, currentUserId }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<TripData>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 다중 출장자 상태 (travelersJson → fallback: userId/userName)
  const [travelers, setTravelers] = useState<Traveler[]>(() => {
    try {
      const arr = JSON.parse((initial as any).travelersJson ?? '[]')
      if (arr.length > 0) return arr
    } catch {}
    if (initial.userId && initial.userName) {
      return [{ userId: initial.userId, userName: initial.userName }]
    }
    // 신규 생성 시 현재 로그인 사용자를 기본값으로
    const me = users.find(u => u.id === (initial.userId || currentUserId))
    return me ? [{ userId: me.id, userName: me.name ?? me.email }] : []
  })
  const [selectedTraveler, setSelectedTraveler] = useState('')

  const addTraveler = () => {
    if (!selectedTraveler) return
    const u = users.find(u => u.id === selectedTraveler)
    if (!u || travelers.some(t => t.userId === selectedTraveler)) return
    setTravelers(prev => [...prev, { userId: u.id, userName: u.name ?? u.email }])
    setSelectedTraveler('')
  }
  const removeTraveler = (userId: string) => {
    setTravelers(prev => prev.filter(t => t.userId !== userId))
  }

  // 다중 승인자 (approversJson 파싱)
  const initApprovers: Approver[] = (() => {
    try { return JSON.parse((initial as any).approversJson ?? '[]') } catch { return [] }
  })()
  const [approvers, setApprovers] = useState<Approver[]>(initApprovers)
  const [draftDays, setDraftDays] = useState<Record<string, DraftDay>>({})

  const set = (k: keyof TripData, v: any) => setForm(prev => ({ ...prev, [k]: v }))
  const setDraftField = (date: string, k: keyof DraftDay, v: string) =>
    setDraftDays(prev => ({ ...prev, [date]: { ...emptyDay(), ...prev[date], [k]: v } }))

  const createDates = (mode === 'create' && form.startDate && form.endDate)
    ? dateRange(form.startDate, form.endDate) : []

  const addApprover = (userId: string) => {
    const u = users.find(u => u.id === userId)
    if (!u || approvers.some(a => a.userId === userId)) return
    setApprovers(prev => [...prev, {
      userId, userName: u.name, order: prev.length + 1,
      status: '대기', comment: null, approvedAt: null,
    }])
  }
  const removeApprover = (idx: number) => {
    setApprovers(prev => prev.filter((_, i) => i !== idx).map((a, i) => ({ ...a, order: i + 1 })))
  }
  const moveApprover = (idx: number, dir: 'up' | 'down') => {
    setApprovers(prev => {
      const next = [...prev]
      const target = dir === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next.map((a, i) => ({ ...a, order: i + 1 }))
    })
  }

  const validate = (forApproval = false) => {
    if (!form.title.trim()) return '제목을 입력해주세요.'
    if (!form.destination.trim()) return '출장지를 입력해주세요.'
    if (!form.purpose.trim()) return '출장 목적을 입력해주세요.'
    if (!form.startDate || !form.endDate) return '출장 기간을 입력해주세요.'
    if (forApproval && approvers.length === 0) return '승인 요청 시 승인자를 1명 이상 지정해주세요.'
    return ''
  }

  const save = async (submitStatus?: string) => {
    const errMsg = validate(submitStatus === '승인요청')
    if (errMsg) { setError(errMsg); return }
    setSaving(true)
    setError('')

    // 승인요청 시 모든 승인자 상태 초기화
    const finalApprovers = submitStatus === '승인요청'
      ? approvers.map(a => ({ ...a, status: '대기', comment: null, approvedAt: null }))
      : approvers

    const payload: any = {
      ...form,
      // 다중 출장자: travelersJson 저장, userName은 이름 목록 문자열, userId는 첫 번째
      travelersJson: JSON.stringify(travelers),
      userName: travelers.map(t => t.userName).join(', ') || form.userName,
      userId: travelers[0]?.userId ?? form.userId,
      approversJson: JSON.stringify(finalApprovers),
      // 첫 번째 승인자를 approverId/approverName에도 설정 (하위 호환)
      approverId: finalApprovers[0]?.userId ?? form.approverId,
      approverName: finalApprovers[0]?.userName ?? form.approverName,
    }
    if (submitStatus) {
      payload.status = submitStatus
      if (submitStatus === '승인요청') payload.submittedAt = new Date().toISOString()
    }

    try {
      const url = mode === 'create' ? '/api/trips' : `/api/trips/${form.id}`
      const method = mode === 'create' ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      const saved = await res.json()

      // create 모드: 일정/비용 레코드 일괄 저장
      if (mode === 'create' && createDates.length > 0) {
        for (const date of createDates) {
          const d = draftDays[date] ?? emptyDay()
          const hasData = d.city || d.company || d.activity || d.transport || d.accommodation || d.meal || d.other
          if (!hasData) continue
          await fetch(`/api/trips/${saved.id}/days`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date,
              city: d.city || null,
              company: d.company || null,
              activity: d.activity || null,
              transportCost: d.transport ? Number(d.transport) : null,
              accommodationCost: d.accommodation ? Number(d.accommodation) : null,
              mealCost: d.meal ? Number(d.meal) : null,
              otherCost: d.other ? Number(d.other) : null,
            }),
          })
        }
      }

      router.push(`/trip/${saved.id}`)
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? '저장 오류')
    } finally {
      setSaving(false)
    }
  }

  const approverUser = users.find(u => u.id === form.approverId)

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-5">

      {/* ── Sticky 저장 바 ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 -mx-6 px-6 py-2.5 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: form.type === '해외출장' ? '#6366f1' : '#f97316' }}>
            {form.type === '해외출장' ? <Plane size={12} className="text-white" /> : <MapPin size={12} className="text-white" />}
          </div>
          <span className="text-sm font-semibold text-slate-700 truncate max-w-xs">
            {form.title || (mode === 'create' ? '새 출장보고서' : '출장보고서 수정')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-slate-400">저장 중…</span>}
          <button onClick={() => save()}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all">
            <Save size={13} />
            초안 저장
          </button>
          <button onClick={() => save('승인요청')}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Send size={13} />
            승인 요청
          </button>
        </div>
      </div>

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: form.type === '해외출장' ? '#6366f1' : '#f97316' }}>
            {form.type === '해외출장' ? <Plane size={18} className="text-white" /> : <MapPin size={18} className="text-white" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {mode === 'create' ? '새 출장보고서' : '출장보고서 수정'}
            </h1>
            <p className="text-xs text-slate-400">{form.type}</p>
          </div>
        </div>
        <button onClick={() => router.push('/notes?tab=notes')} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <X size={20} />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* ① 기본 정보 */}
      <Section title="① 기본 정보">
        <div className="grid grid-cols-2 gap-4">
          <Field label="출장 구분" required>
            <select className={inputCls} value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="국내출장">국내출장</option>
              <option value="해외출장">해외출장</option>
            </select>
          </Field>
          <Field label="출장자" required>
            <div className="space-y-2">
              {travelers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {travelers.map(t => (
                    <span key={t.userId}
                      className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-sm text-indigo-700 font-semibold">
                      {t.userName}
                      <button type="button" onClick={() => removeTraveler(t.userId)}
                        className="text-indigo-300 hover:text-red-500 transition-colors">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <select className={inputCls} value={selectedTraveler}
                  onChange={e => setSelectedTraveler(e.target.value)}>
                  <option value="">-- 출장자 추가 --</option>
                  {users.filter(u => !travelers.some(t => t.userId === u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button type="button" onClick={addTraveler} disabled={!selectedTraveler}
                  className="shrink-0 flex items-center gap-1 px-3 py-2 text-sm font-semibold rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  <UserPlus size={14} />추가
                </button>
              </div>
            </div>
          </Field>
        </div>
        <Field label="출장 제목" required>
          <input className={inputCls} value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="예) 서울 전시회 참가 출장" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="출발일" required>
            <input type="date" className={inputCls} value={form.startDate}
              onChange={e => set('startDate', e.target.value)} />
          </Field>
          <Field label="귀환일" required>
            <input type="date" className={inputCls} value={form.endDate}
              onChange={e => set('endDate', e.target.value)} />
          </Field>
        </div>
        <Field label="출장지" required>
          <input className={inputCls} value={form.destination}
            onChange={e => set('destination', e.target.value)}
            placeholder={form.type === '해외출장' ? '예) 독일 뮌헨' : '예) 서울 코엑스'} />
        </Field>
      </Section>

      {/* ② 방문 정보 */}
      <Section title="② 방문 정보">
        <Field label="출장 목적" required>
          <BulletTextarea rows={3} className={inputCls} value={form.purpose}
            onChange={v => set('purpose', v)}
            placeholder="• 방문 목적을 입력하세요 (Enter로 항목 추가)" />
        </Field>
        <Field label="동행자">
          <input className={inputCls} value={form.companions ?? ''}
            onChange={e => set('companions', e.target.value)}
            placeholder="예) 이영희, 박민준" />
        </Field>
      </Section>

      {/* ③ 일자별 일정 및 비용 명세 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-bold text-slate-700">③ 일자별 일정 및 비용 명세</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {mode === 'edit' ? '영수증을 비용 셀에 드래그하거나 📎를 클릭하면 금액이 자동 인식됩니다' : '출발일/귀환일 입력 후 각 일자별 일정과 비용을 입력하세요. 영수증 첨부는 저장 후 가능합니다.'}
          </p>
        </div>
        <div className="px-5 py-4">
          {mode === 'edit' && form.id ? (
            <TripDayTable tripId={form.id} startDate={form.startDate} endDate={form.endDate} isOverseas={form.type === '해외출장'} />
          ) : createDates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 580 }}>
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-2 py-1.5 text-[11px] font-bold text-slate-700 text-center w-14">일자</th>
                    <th className="border border-slate-300 px-1 py-1.5 text-[11px] font-semibold text-slate-600 text-center w-14">도시</th>
                    <th className="border border-slate-300 px-1 py-1.5 text-[11px] font-semibold text-slate-600 text-center w-[72px]">업체명</th>
                    <th className="border border-slate-300 px-1 py-1.5 text-[11px] font-semibold text-slate-600 text-center">주요활동</th>
                    <th className="border border-slate-300 px-1 py-1.5 text-[11px] font-semibold text-slate-600 text-center w-[68px]">교통비</th>
                    <th className="border border-slate-300 px-1 py-1.5 text-[11px] font-semibold text-slate-600 text-center w-[68px]">숙박비</th>
                    <th className="border border-slate-300 px-1 py-1.5 text-[11px] font-semibold text-slate-600 text-center w-[68px]">식비</th>
                    <th className="border border-slate-300 px-1 py-1.5 text-[11px] font-semibold text-slate-600 text-center w-[68px]">기타</th>
                  </tr>
                </thead>
                <tbody>
                  {createDates.map(date => {
                    const d = draftDays[date] ?? emptyDay()
                    return (
                      <tr key={date} className="hover:bg-slate-50/60">
                        <td className="border border-slate-200 px-1 py-1.5 text-center text-[11px] font-semibold text-slate-700 whitespace-nowrap bg-slate-50">{fmtDate(date)}</td>
                        {(['city', 'company'] as const).map(k => (
                          <td key={k} className="border border-slate-200 p-1">
                            <input value={d[k]} onChange={e => setDraftField(date, k, e.target.value)}
                              className="w-full text-[11px] px-1 py-1 rounded border border-transparent hover:border-slate-200 focus:border-indigo-300 focus:outline-none bg-transparent"
                              placeholder={k === 'city' ? '도시' : '업체명'} />
                          </td>
                        ))}
                        <td className="border border-slate-200 p-1">
                          <BulletTextarea
                            value={d.activity}
                            onChange={v => setDraftField(date, 'activity', v)}
                            rows={2}
                            placeholder="• 주요활동 입력 (Enter 추가)"
                            className="w-full text-[11px] px-1 py-1 rounded border border-transparent hover:border-slate-200 focus:border-indigo-300 focus:outline-none bg-transparent resize-none" />
                        </td>
                        {(['transport', 'accommodation', 'meal', 'other'] as const).map(k => (
                          <td key={k} className="border border-slate-200 p-1">
                            <input type="number" value={d[k]} onChange={e => setDraftField(date, k, e.target.value)}
                              className="w-full text-[11px] px-1 py-1 rounded border border-transparent hover:border-slate-200 focus:border-indigo-300 focus:outline-none bg-transparent text-right"
                              placeholder="0" />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-slate-400 text-center">영수증 첨부 및 OCR 인식은 저장 후 수정 화면에서 가능합니다.</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">출발일과 귀환일을 입력하면 일자별 입력창이 나타납니다.</p>
          )}
        </div>
      </div>

      {/* ④ 승인자 지정 (다중) */}
      <Section title="④ 승인자 지정">
        <p className="text-xs text-slate-400 mb-3">결재 순서대로 최종 승인자를 추가하세요. 순차 승인됩니다. 사전품의가 필요한 경우 사전품의 승인자를 별도 지정할 수 있습니다.</p>

        {/* 사전품의 승인자 */}
        <Field label="사전품의 승인자" hint="(선택사항 — 출장 전 사전품의가 필요한 경우에만 지정)">
          <select className={inputCls} value={form.preApproverId ?? ''}
            onChange={e => {
              const u = users.find(u => u.id === e.target.value)
              set('preApproverId', e.target.value)
              set('preApproverName', u?.name ?? '')
            }}>
            <option value="">선택 안 함</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </Field>

        {/* 최종 승인자 목록 */}
        <div className="mt-3">
          <label className="block text-xs font-semibold text-slate-500 mb-2">
            최종 승인자 <span className="text-red-400">*</span>
            <span className="ml-1.5 font-normal text-slate-400">순서대로 순차 승인</span>
          </label>

          {approvers.length === 0 && (
            <div className="text-xs text-slate-400 px-3 py-2 border border-dashed border-slate-200 rounded-lg">
              아래에서 승인자를 추가하세요.
            </div>
          )}

          <div className="space-y-2 mb-3">
            {approvers.map((a, i) => (
              <div key={a.userId} className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                <span className="text-sm font-semibold text-indigo-800 flex-1">{a.userName}</span>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => moveApprover(i, 'up')} disabled={i === 0}
                    className="p-0.5 text-slate-400 hover:text-indigo-500 disabled:opacity-20">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => moveApprover(i, 'down')} disabled={i === approvers.length - 1}
                    className="p-0.5 text-slate-400 hover:text-indigo-500 disabled:opacity-20">
                    <ChevronDown size={14} />
                  </button>
                  <button onClick={() => removeApprover(i)}
                    className="p-0.5 text-slate-300 hover:text-red-400 ml-1">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <select
              className={inputCls}
              value=""
              onChange={e => { if (e.target.value) addApprover(e.target.value) }}
            >
              <option value="">+ 승인자 추가</option>
              {users
                .filter(u => !approvers.some(a => a.userId === u.id))
                .map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
            </select>
          </div>
        </div>
      </Section>

      {/* 하단 버튼 */}
      <div className="flex items-center justify-between pt-2">
        <button onClick={() => router.push('/notes?tab=notes')}
          className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
          취소
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => save()}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all">
            <Save size={15} />
            초안 저장
          </button>
          <button onClick={() => save('승인요청')}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Send size={15} />
            승인 요청
          </button>
        </div>
      </div>

    </div>
  )
}
