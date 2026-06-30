'use client'

import { useState, useMemo } from 'react'
import { formatPhone } from '@/lib/format'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Lead = { id: string; stageCode: string; salesStatus: string }
type Activity = { id: string; date: string; type: string }
type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  customerSegment: string | null
  status: string
  grade: string | null
  source: string | null
  collectedAt: string | null
  assignee: string | null
  companyName: string | null
  cargoType: string | null
  leads: Lead[]
  activities: Activity[]
  createdAt: string
}

type Tab = 'all' | '잠재고객' | '활성' | '완료' | '이탈'
type Seg = 'all' | 'B2C' | 'B2B'



function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace('. ', '/').replace('.', '')
}

interface Props { customers: Customer[] }

export default function CustomerListClient({ customers: initial }: Props) {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>(initial)
  const [tab,     setTab]     = useState<Tab>('all')
  const [seg,     setSeg]     = useState<Seg>('all')
  const [search,  setSearch]  = useState('')
  const [showNew, setShowNew] = useState(false)

  const filtered = useMemo(() => {
    return customers.filter(c => {
      if (tab !== 'all' && c.status !== tab) return false
      if (seg !== 'all' && (c.customerSegment ?? 'B2C') !== seg) return false
      if (search) {
        const q = search.toLowerCase()
        if (!c.name.toLowerCase().includes(q) &&
            !(c.phone ?? '').includes(q) &&
            !(c.companyName ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [customers, tab, seg, search])


  const TABS: { key: Tab; label: string }[] = [
    { key: 'all',    label: '전체' },
    { key: '잠재고객', label: '잠재고객' },
    { key: '활성',   label: '활성' },
    { key: '완료',   label: '완료' },
    { key: '이탈',   label: '이탈' },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* 툴바 */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-100 shrink-0 flex-wrap">
        {/* 상태 탭 */}
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition
                ${tab === t.key ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
              {t.label}
              <span className="ml-1 opacity-60">
                {t.key === 'all' ? customers.length : customers.filter(c => c.status === t.key).length}
              </span>
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-200" />

        {/* B2C/B2B 필터 */}
        <div className="flex gap-1">
          {(['all', 'B2C', 'B2B'] as Seg[]).map(s => (
            <button key={s} onClick={() => setSeg(s)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition
                ${seg === s
                  ? s === 'B2B' ? 'bg-violet-700 text-white' : s === 'B2C' ? 'bg-sky-600 text-white' : 'bg-slate-600 text-white'
                  : 'text-slate-400 hover:bg-slate-100'}`}>
              {s === 'all' ? '전체' : s === 'B2C' ? 'B2C 개인' : 'B2B 법인'}
            </button>
          ))}
        </div>

        {/* 검색 */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이름·연락처·회사명 검색"
          className="ml-auto text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-300 w-52"
        />


        {/* 신규 고객 추가 */}
        <Link href="/import"
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition">
          엑셀 일괄 등록
        </Link>
        <button onClick={() => setShowNew(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition">
          + 고객 추가
        </button>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            고객이 없습니다
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
              <tr className="text-slate-400 font-semibold">
                <th className="px-4 py-3 text-left w-36">이름</th>
                <th className="px-3 py-3 text-left w-28">연락처</th>
                <th className="px-3 py-3 text-left w-28">세그먼트</th>
                <th className="px-3 py-3 text-left w-32">회사명</th>
                <th className="px-3 py-3 text-left w-20">유입경로</th>
                <th className="px-3 py-3 text-left w-20">수집일</th>
                <th className="px-3 py-3 text-left w-20">담당자</th>
                <th className="px-3 py-3 text-center w-16">리드</th>
                <th className="px-3 py-3 text-left w-20">최근활동</th>
                <th className="px-3 py-3 text-center w-16">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(c => {
                const activeLeads = c.leads.filter(l => l.salesStatus === '진행중')
                const lastAct = c.activities[0]
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/customers/${c.id}`)}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800">{c.name}</span>
                        {(c.customerSegment ?? 'B2C') === 'B2B'
                          ? <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-100 text-violet-700">법인</span>
                          : <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-50 text-sky-600">개인</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{c.phone ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-400">
                      {c.customerSegment ?? 'B2C'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 truncate max-w-0">{c.companyName ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-400">{c.source ?? '—'}</td>
                    <td className="px-3 py-2.5 text-slate-400">{fmtDate(c.collectedAt)}</td>
                    <td className="px-3 py-2.5 text-slate-500">{c.assignee ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      {activeLeads.length > 0
                        ? <span className="inline-block w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold leading-5 text-center">
                            {activeLeads.length}
                          </span>
                        : c.leads.length > 0
                          ? <span className="text-slate-300">{c.leads.length}</span>
                          : <span className="text-slate-200">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">
                      {lastAct
                        ? <span>{fmtDate(lastAct.date)} <span className="text-slate-300">{lastAct.type}</span></span>
                        : <span className="text-slate-200">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <Link href={`/customers/${c.id}`}
                        className="inline-block px-2.5 py-1 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
                        상세 →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 신규 고객 추가 모달 */}
      {showNew && <NewCustomerModal onClose={() => setShowNew(false)} onCreated={c => { setCustomers(prev => [c, ...prev]); setShowNew(false) }} />}
    </div>
  )
}

/* ── 신규 고객 추가 모달 ── */
function NewCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Customer) => void }) {
  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [seg,     setSeg]     = useState<'B2C' | 'B2B'>('B2C')
  const [source,  setSource]  = useState('')
  const [company, setCompany] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const SOURCES = ['소개', '온라인', '전시장/이벤트', '직접방문', '기타']

  const handleSubmit = async () => {
    if (!name.trim()) { setError('고객명은 필수입니다.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:            name.trim(),
          phone:           phone    || null,
          customerSegment: seg,
          source:          source   || null,
          companyName:     company  || null,
          collectedAt:     new Date().toISOString(),
        }),
      })
      if (!res.ok) { const j = await res.json(); setError(j.error ?? '오류'); setSaving(false); return }
      const c = await res.json()
      onCreated({ ...c, leads: [], activities: [] })
    } catch {
      setError('네트워크 오류')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[380px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        <div className="shrink-0 px-6 pt-6 pb-5" style={{ background: 'linear-gradient(135deg,#1e293b 0%,#334155 100%)' }}>
          <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 transition text-xl leading-none">×</button>
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">신규 고객 등록</p>
          <p className="text-white font-bold text-lg">고객 기본 정보</p>
          <div className="flex gap-2 mt-4">
            {(['B2C', 'B2B'] as const).map(s => (
              <button key={s} onClick={() => setSeg(s)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${seg === s ? 'bg-white text-slate-800' : 'bg-white/15 text-white/70 hover:bg-white/25'}`}>
                {s === 'B2C' ? 'B2C 개인' : 'B2B 법인'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              {seg === 'B2B' ? '담당자 이름' : '고객 이름'} <span className="text-red-400">*</span>
            </label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">연락처</label>
            <input value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000"
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
          {seg === 'B2B' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">회사명</label>
              <input value={company} onChange={e => setCompany(e.target.value)} placeholder="(주)회사명"
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            </div>
          )}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">유입 경로</label>
            <div className="flex gap-2 flex-wrap">
              {SOURCES.map(s => (
                <button key={s} type="button" onClick={() => setSource(source === s ? '' : s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition
                    ${source === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-slate-100 px-6 py-4 flex items-center justify-between bg-white">
          <button onClick={onClose} className="px-5 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">취소</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-6 py-2 text-sm font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-50">
            {saving ? '등록 중...' : '등록하기'}
          </button>
        </div>
      </div>
    </>
  )
}
