'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CheckCircle2, RefreshCw,
  Users, Database, Link2, Unlink,
  GitMerge, Search, Phone, ChevronDown, ChevronUp,
  Trash2, Eye, UserPlus, X, Pencil, FolderPlus, PackagePlus,
} from 'lucide-react'

/* ── 타입 ── */
interface Stats {
  totalCustomers:     number
  linkedDeals:        number
  unlinkedDeals:      number
  customersWithDetail:number
}

interface UserRow {
  id:        string
  name:      string
  email:     string
  role:      string
  teamId:    string | null
  team:      { name: string } | null
  createdAt: string
}

interface TeamRow { id: string; name: string }

type CustInfo = { id: string; name: string; phone: string | null; status: string; leadCount: number; createdAt: string }
type DupGroup = { phone: string | null; name: string; customers: CustInfo[] }

interface DupResult {
  total:      number
  dupCount:   number
  groupCount: number
  groups:     DupGroup[]
}

interface ProductRow {
  id:        string
  name:      string
  code:      string | null
  category:  string | null
  year:      number | null
  basePrice: number | null
  costPrice: number | null
  active:    boolean
  memo:      string | null
}

type LostPreviewItem = {
  id: string; name: string; phone: string | null; stageCode: string
  meetingCount: number; customerId: string | null; collectedAt: string | null
}
interface LostPreview {
  count:        number
  meetingCount: number
  preview:      LostPreviewItem[]
}

/* ── 상태 초기화 ── */
const RESET_RESULT_INIT = null as { resetCount: number; createCount: number; message: string } | null

const PRODUCT_CATEGORIES = ['냉동', '상온', '특장', '기타']

export default function AdminClient({
  stats, users: initialUsers, teams: initialTeams, products: initialProducts,
}: {
  stats: Stats; users: UserRow[]; teams: TeamRow[]; products: ProductRow[]
}) {
  const router = useRouter()

  /* ── 제품/모델 관리 ── */
  const [products,        setProducts]        = useState<ProductRow[]>(initialProducts)
  const [showProdAdd,     setShowProdAdd]     = useState(false)
  const [newProd, setNewProd] = useState({ name: '', code: '', category: '', year: '', basePrice: '', costPrice: '', memo: '' })
  const [prodAddLoading,  setProdAddLoading]  = useState(false)
  const [prodAddErr,      setProdAddErr]      = useState('')
  const [prodEditId,      setProdEditId]      = useState<string | null>(null)
  const [prodEditVal,     setProdEditVal]     = useState({ name: '', code: '', category: '', year: '', basePrice: '', costPrice: '', memo: '' })
  const [prodEditLoading, setProdEditLoading] = useState(false)
  const [prodDelId,       setProdDelId]       = useState<string | null>(null)
  const [prodDelLoading,  setProdDelLoading]  = useState(false)

  const handleAddProduct = async () => {
    setProdAddErr('')
    if (!newProd.name.trim()) { setProdAddErr('제품명은 필수입니다.'); return }
    setProdAddLoading(true)
    try {
      const res  = await fetch('/api/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProd),
      })
      const data = await res.json()
      if (!res.ok) { setProdAddErr(data.error ?? '생성 실패'); return }
      setProducts(prev => [...prev, data].sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name)))
      setNewProd({ name: '', code: '', category: '', year: '', basePrice: '', costPrice: '', memo: '' })
      setShowProdAdd(false)
    } finally { setProdAddLoading(false) }
  }

  const handleEditProduct = async (id: string) => {
    setProdEditLoading(true)
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prodEditVal),
      })
      if (res.ok) {
        const updated = await res.json()
        setProducts(prev => prev.map(p => p.id === id ? updated : p))
        setProdEditId(null)
      }
    } finally { setProdEditLoading(false) }
  }

  const handleDeleteProduct = async (id: string) => {
    setProdDelLoading(true)
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (res.ok) { setProducts(prev => prev.filter(p => p.id !== id)); setProdDelId(null) }
    } finally { setProdDelLoading(false) }
  }

  /* ── 팀 관리 ── */
  const [teams,        setTeams]        = useState<TeamRow[]>(initialTeams)
  const [newTeamName,  setNewTeamName]  = useState('')
  const [teamAddLoading, setTeamAddLoading] = useState(false)
  const [teamDelId,      setTeamDelId]      = useState<string | null>(null)
  const [teamDelLoading, setTeamDelLoading] = useState(false)
  const [teamRenameId,   setTeamRenameId]   = useState<string | null>(null)
  const [teamRenameVal,  setTeamRenameVal]  = useState('')
  const [teamRenameLoading, setTeamRenameLoading] = useState(false)

  const handleRenameTeam = async (id: string) => {
    if (!teamRenameVal.trim()) return
    setTeamRenameLoading(true)
    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamRenameVal.trim() }),
      })
      if (res.ok) {
        setTeams(prev => prev.map(t => t.id === id ? { ...t, name: teamRenameVal.trim() } : t))
        setTeamRenameId(null)
      }
    } finally { setTeamRenameLoading(false) }
  }

  const handleAddTeam = async () => {
    const trimmed = newTeamName.trim()
    if (!trimmed || teamAddLoading) return
    if (teams.some(t => t.name === trimmed)) {
      alert(`"${trimmed}" 팀이 이미 존재합니다.`)
      return
    }
    setTeamAddLoading(true)
    try {
      const res  = await fetch('/api/teams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (res.ok) {
        setTeams(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
        setNewTeamName('')
      } else {
        alert(data.error ?? '팀 추가 실패')
      }
    } finally { setTeamAddLoading(false) }
  }

  const handleDeleteTeam = async (id: string) => {
    setTeamDelLoading(true)
    try {
      const res = await fetch(`/api/teams/${id}`, { method: 'DELETE' })
      if (res.ok) { setTeams(prev => prev.filter(t => t.id !== id)); setTeamDelId(null) }
    } finally { setTeamDelLoading(false) }
  }

  /* ── 사용자 관리 ── */
  const [users,      setUsers]      = useState<UserRow[]>(initialUsers)
  const [showAdd,    setShowAdd]    = useState(false)
  const [newUser,    setNewUser]    = useState({ name: '', email: '', password: '', role: 'user', teamId: '' })
  const [addErr,     setAddErr]     = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [delId,       setDelId]       = useState<string | null>(null)
  const [delLoading,  setDelLoading]  = useState(false)
  const [editId,      setEditId]      = useState<string | null>(null)
  const [editVal,     setEditVal]     = useState({ name: '', email: '', role: 'user', teamId: '', newPassword: '' })
  const [editLoading, setEditLoading] = useState(false)

  const handleAddUser = async () => {
    setAddErr('')
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      setAddErr('이름, 이메일, 비밀번호는 필수입니다.')
      return
    }
    setAddLoading(true)
    try {
      const res  = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      const data = await res.json()
      if (!res.ok) { setAddErr(data.error ?? '생성 실패'); return }
      setUsers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewUser({ name: '', email: '', password: '', role: 'user', teamId: '' })
      setShowAdd(false)
    } finally { setAddLoading(false) }
  }

  const handleDelete = async (id: string) => {
    setDelLoading(true)
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      if (res.ok) { setUsers(prev => prev.filter(u => u.id !== id)); setDelId(null) }
    } finally { setDelLoading(false) }
  }

  const handleEditUser = async (id: string) => {
    if (!editVal.name.trim() || !editVal.email.trim()) return
    setEditLoading(true)
    try {
      const body: Record<string, unknown> = {
        name: editVal.name, email: editVal.email, role: editVal.role,
        teamId: editVal.teamId || null,
      }
      if (editVal.newPassword.trim()) body.password = editVal.newPassword
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const newTeam = teams.find(t => t.id === editVal.teamId) ?? null
        setUsers(prev => prev.map(u => u.id === id
          ? { ...u, name: editVal.name.trim(), email: editVal.email.trim(), role: editVal.role, teamId: editVal.teamId || null, team: newTeam }
          : u
        ))
        setEditId(null)
      }
    } finally { setEditLoading(false) }
  }

  /* 초기화 작업 */
  const [resetStep,   setResetStep]   = useState<'idle' | 'confirm' | 'running' | 'done'>('idle')
  const [resetResult, setResetResult] = useState(RESET_RESULT_INIT)
  const [resetError,  setResetError]  = useState('')

  /* 이탈 리드 삭제 */
  const [lostPreview,  setLostPreview]  = useState<LostPreview | null>(null)
  const [lostLoading,  setLostLoading]  = useState(false)
  const [lostStep,     setLostStep]     = useState<'idle' | 'preview' | 'confirm' | 'running' | 'done'>('idle')
  const [lostResult,   setLostResult]   = useState<{ deleted: number; message: string } | null>(null)
  const [lostError,    setLostError]    = useState('')
  const [lostExpanded, setLostExpanded] = useState(false)

  /* 중복 진단 */
  const [dupLoading, setDupLoading] = useState(false)
  const [dupResult,  setDupResult]  = useState<DupResult | null>(null)
  const [dupError,   setDupError]   = useState('')
  const [expanded,   setExpanded]   = useState<Set<number>>(new Set())
  const [merging,    setMerging]    = useState<string | null>(null) // removeId being merged
  const [mergeMsg,   setMergeMsg]   = useState('')

  /* ── 핸들러: 이탈 리드 미리보기 ── */
  const handleLostPreview = async () => {
    setLostLoading(true)
    setLostError('')
    try {
      const res  = await fetch('/api/migrate/delete-lost-leads')
      const json = await res.json()
      if (!res.ok) { setLostError(json.error ?? '오류'); return }
      setLostPreview(json)
      setLostStep('preview')
    } catch {
      setLostError('네트워크 오류가 발생했습니다')
    } finally {
      setLostLoading(false)
    }
  }

  /* ── 핸들러: 이탈 리드 삭제 실행 ── */
  const handleLostDelete = async () => {
    setLostStep('running')
    setLostError('')
    try {
      const res  = await fetch('/api/migrate/delete-lost-leads', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setLostError(json.error ?? '오류'); setLostStep('preview'); return }
      setLostResult(json)
      setLostStep('done')
      router.refresh()
    } catch {
      setLostError('네트워크 오류가 발생했습니다')
      setLostStep('preview')
    }
  }

  /* ── 핸들러: 데이터 초기화 실행 ── */
  const handleReset = async () => {
    setResetStep('running')
    setResetError('')
    try {
      const res  = await fetch('/api/migrate/reset-customers', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setResetError(json.error ?? '오류가 발생했습니다'); setResetStep('idle'); return }
      setResetResult(json)
      setResetStep('done')
      router.refresh()
    } catch {
      setResetError('네트워크 오류가 발생했습니다')
      setResetStep('idle')
    }
  }

  /* ── 핸들러: 중복 고객 검색 ── */
  const handleFindDups = async () => {
    setDupLoading(true)
    setDupError('')
    setDupResult(null)
    setMergeMsg('')
    try {
      const res  = await fetch('/api/migrate/find-duplicates')
      const json = await res.json()
      if (!res.ok) { setDupError(json.error ?? '오류'); return }
      setDupResult(json)
    } catch {
      setDupError('네트워크 오류가 발생했습니다')
    } finally {
      setDupLoading(false)
    }
  }

  /* ── 핸들러: 고객 통합 ── */
  const handleMerge = async (keepId: string, removeId: string) => {
    setMerging(removeId)
    setMergeMsg('')
    try {
      const res  = await fetch('/api/migrate/merge-customers', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ keepId, removeId }),
      })
      const json = await res.json()
      if (!res.ok) { setMergeMsg(`오류: ${json.error}`); return }
      setMergeMsg(json.message)
      // 중복 목록 갱신
      await handleFindDups()
      router.refresh()
    } catch {
      setMergeMsg('네트워크 오류가 발생했습니다')
    } finally {
      setMerging(null)
    }
  }

  const toggleGroup = (idx: number) =>
    setExpanded(prev => { const s = new Set(prev); s.has(idx) ? s.delete(idx) : s.add(idx); return s })

  /* ── 렌더 ── */
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">

      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">관리자</h1>
        <p className="text-sm text-slate-500 mt-1">사용자 계정 및 데이터 관리</p>
      </div>

      {/* ══ 제품/모델 관리 ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#1e3a5f' }}>
          <div>
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <PackagePlus size={15} /> 제품/모델 관리
            </h2>
            <p className="text-slate-300 text-xs mt-0.5">판매 차량 모델 등록 · 수정 · 삭제 — 영업 파이프라인에서 딜에 연결합니다</p>
          </div>
          <button
            onClick={() => { setShowProdAdd(v => !v); setProdAddErr('') }}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition">
            <PackagePlus size={13} />
            제품 추가
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {/* 추가 폼 */}
          {showProdAdd && (
            <div className="p-5 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-600 mb-3">새 제품/모델 등록</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">제품명 *</label>
                  <input value={newProd.name} onChange={e => setNewProd(p => ({ ...p, name: e.target.value }))}
                    placeholder="예: 스테고Z 냉동 5톤"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">모델 코드</label>
                  <input value={newProd.code} onChange={e => setNewProd(p => ({ ...p, code: e.target.value }))}
                    placeholder="예: STG-Z-5T"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">카테고리</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {PRODUCT_CATEGORIES.map(c => (
                      <button key={c} type="button"
                        onClick={() => setNewProd(p => ({ ...p, category: p.category === c ? '' : c }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition
                          ${newProd.category === c ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">연식</label>
                  <input type="number" value={newProd.year} onChange={e => setNewProd(p => ({ ...p, year: e.target.value }))}
                    placeholder="예: 2025"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">기준 출고가 (만원)</label>
                  <input type="number" value={newProd.basePrice} onChange={e => setNewProd(p => ({ ...p, basePrice: e.target.value }))}
                    placeholder="예: 8500"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">원가 (만원)</label>
                  <input type="number" value={newProd.costPrice} onChange={e => setNewProd(p => ({ ...p, costPrice: e.target.value }))}
                    placeholder="예: 7200"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">메모</label>
                  <input value={newProd.memo} onChange={e => setNewProd(p => ({ ...p, memo: e.target.value }))}
                    placeholder="옵션, 특이사항 등"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
              </div>
              {prodAddErr && <p className="text-xs text-red-500 mt-2">{prodAddErr}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={handleAddProduct} disabled={prodAddLoading}
                  className="px-5 py-2 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-50 flex items-center gap-2">
                  {prodAddLoading ? <RefreshCw size={13} className="animate-spin" /> : <PackagePlus size={13} />}
                  {prodAddLoading ? '추가 중...' : '제품 추가'}
                </button>
                <button onClick={() => { setShowProdAdd(false); setProdAddErr('') }}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 제품 목록 */}
          {products.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">등록된 제품이 없습니다. 제품 추가 버튼으로 등록하세요.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">제품명</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">코드</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">카테고리</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500">출고가(만)</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500">원가(만)</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(p => (
                    <>
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {p.name}
                          {p.year && <span className="ml-1 text-xs text-slate-400">{p.year}년</span>}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500">{p.code ?? '—'}</td>
                        <td className="px-3 py-3">
                          {p.category && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              {p.category}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
                          {p.basePrice != null ? p.basePrice.toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
                          {p.costPrice != null ? p.costPrice.toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 justify-end">
                            {prodDelId === p.id ? (
                              <>
                                <span className="text-xs text-red-600 font-medium whitespace-nowrap">삭제할까요?</span>
                                <button onClick={() => handleDeleteProduct(p.id)} disabled={prodDelLoading}
                                  className="px-2 py-1 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40">
                                  {prodDelLoading ? '...' : '삭제'}
                                </button>
                                <button onClick={() => setProdDelId(null)} className="p-1 text-slate-400 hover:text-slate-600">
                                  <X size={12} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setProdEditId(prodEditId === p.id ? null : p.id)
                                    setProdEditVal({ name: p.name, code: p.code ?? '', category: p.category ?? '', year: p.year?.toString() ?? '', basePrice: p.basePrice?.toString() ?? '', costPrice: p.costPrice?.toString() ?? '', memo: p.memo ?? '' })
                                    setProdDelId(null)
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                                  <Pencil size={10} /> 수정
                                </button>
                                <button onClick={() => { setProdDelId(p.id); setProdEditId(null) }}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
                                  <Trash2 size={10} /> 삭제
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {prodEditId === p.id && (
                        <tr key={`${p.id}-edit`}>
                          <td colSpan={6} className="px-4 pb-4 pt-0 bg-slate-50">
                            <div className="grid grid-cols-3 gap-3 mt-3">
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">제품명 *</label>
                                <input value={prodEditVal.name} onChange={e => setProdEditVal(v => ({ ...v, name: e.target.value }))}
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">모델 코드</label>
                                <input value={prodEditVal.code} onChange={e => setProdEditVal(v => ({ ...v, code: e.target.value }))}
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">연식</label>
                                <input type="number" value={prodEditVal.year} onChange={e => setProdEditVal(v => ({ ...v, year: e.target.value }))}
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">카테고리</label>
                                <div className="flex gap-1 flex-wrap">
                                  {PRODUCT_CATEGORIES.map(c => (
                                    <button key={c} type="button"
                                      onClick={() => setProdEditVal(v => ({ ...v, category: v.category === c ? '' : c }))}
                                      className={`px-2 py-0.5 rounded text-xs font-semibold border transition
                                        ${prodEditVal.category === c ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                                      {c}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">출고가 (만원)</label>
                                <input type="number" value={prodEditVal.basePrice} onChange={e => setProdEditVal(v => ({ ...v, basePrice: e.target.value }))}
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">원가 (만원)</label>
                                <input type="number" value={prodEditVal.costPrice} onChange={e => setProdEditVal(v => ({ ...v, costPrice: e.target.value }))}
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                              </div>
                              <div className="col-span-3">
                                <label className="text-xs text-slate-500 mb-1 block">메모</label>
                                <input value={prodEditVal.memo} onChange={e => setProdEditVal(v => ({ ...v, memo: e.target.value }))}
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button onClick={() => handleEditProduct(p.id)} disabled={prodEditLoading || !prodEditVal.name.trim()}
                                className="px-4 py-2 text-sm font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 transition flex items-center gap-1.5">
                                {prodEditLoading ? <RefreshCw size={12} className="animate-spin" /> : null}
                                {prodEditLoading ? '저장 중...' : '저장'}
                              </button>
                              <button onClick={() => setProdEditId(null)}
                                className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition">
                                취소
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══ 팀 관리 ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <FolderPlus size={15} /> 팀 관리
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">팀 추가 · 삭제 — 사용자 등록 전에 먼저 팀을 만드세요</p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {/* 팀 추가 입력 */}
          <div className="flex gap-2">
            <input
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTeam()}
              placeholder="팀 이름 입력 (예: 영업1팀)"
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
            <button
              onClick={handleAddTeam}
              disabled={teamAddLoading || !newTeamName.trim()}
              className="px-4 py-2 text-sm font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-40 flex items-center gap-1.5">
              {teamAddLoading ? <RefreshCw size={12} className="animate-spin" /> : <FolderPlus size={12} />}
              추가
            </button>
          </div>

          {/* 팀 목록 */}
          {teams.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">등록된 팀이 없습니다.</p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {teams.map(t => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  {teamRenameId === t.id ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        value={teamRenameVal}
                        onChange={e => setTeamRenameVal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleRenameTeam(t.id)}
                        className="flex-1 text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                      <button onClick={() => handleRenameTeam(t.id)} disabled={teamRenameLoading || !teamRenameVal.trim()}
                        className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-40 transition">
                        {teamRenameLoading ? '...' : '저장'}
                      </button>
                      <button onClick={() => setTeamRenameId(null)} className="p-1.5 text-slate-400 hover:text-slate-600">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-slate-700">{t.name}</span>
                      <div className="flex items-center gap-1.5">
                        {teamDelId === t.id ? (
                          <>
                            <span className="text-xs text-red-600 font-medium">정말 삭제하시겠어요?</span>
                            <button onClick={() => handleDeleteTeam(t.id)} disabled={teamDelLoading}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition">
                              {teamDelLoading ? '...' : '삭제'}
                            </button>
                            <button onClick={() => setTeamDelId(null)} className="p-1.5 text-slate-400 hover:text-slate-600">
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setTeamRenameId(t.id); setTeamRenameVal(t.name); setTeamDelId(null) }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                              <Pencil size={11} /> 수정
                            </button>
                            <button
                              onClick={() => { setTeamDelId(t.id); setTeamRenameId(null) }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
                              <Trash2 size={11} /> 삭제
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ 사용자 관리 ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <Users size={15} /> 사용자 관리
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">직원 계정 추가 · 비밀번호 초기화 · 삭제</p>
          </div>
          <button
            onClick={() => { setShowAdd(v => !v); setAddErr('') }}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition">
            <UserPlus size={13} />
            사용자 추가
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {/* 사용자 추가 폼 */}
          {showAdd && (
            <div className="p-5 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-600 mb-3">새 사용자 등록</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">이름 *</label>
                  <input
                    value={newUser.name}
                    onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
                    placeholder="홍길동"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">이메일 *</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                    placeholder="hong@evnsolution.com"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">비밀번호 *</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                    placeholder="8자 이상 권장"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">팀</label>
                  <select
                    value={newUser.teamId}
                    onChange={e => setNewUser(p => ({ ...p, teamId: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400">
                    <option value="">팀 없음</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">권한</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400">
                    <option value="user">일반 사용자</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>
              </div>
              {addErr && <p className="text-xs text-red-500 mt-2">{addErr}</p>}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddUser}
                  disabled={addLoading}
                  className="px-5 py-2 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-50 flex items-center gap-2">
                  {addLoading ? <RefreshCw size={13} className="animate-spin" /> : <UserPlus size={13} />}
                  {addLoading ? '생성 중...' : '계정 생성'}
                </button>
                <button
                  onClick={() => { setShowAdd(false); setAddErr('') }}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 사용자 목록 — 팀별 그룹 */}
          {users.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">등록된 사용자가 없습니다.</p>
          ) : (() => {
            const teamGroups = teams
              .map(t => ({ team: t, members: users.filter(u => u.teamId === t.id) }))
              .filter(g => g.members.length > 0)
            const noTeam = users.filter(u => !u.teamId)

            const renderUser = (u: UserRow) => (
              <div key={u.id}>
                <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800">{u.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        u.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {u.role === 'admin' ? '관리자' : '사용자'}
                      </span>
                      {u.team && <span className="text-[10px] text-slate-400">{u.team.name}</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {delId === u.id ? (
                      <>
                        <span className="text-xs text-red-600 font-medium">정말 삭제하시겠어요?</span>
                        <button onClick={() => handleDelete(u.id)} disabled={delLoading}
                          className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition">
                          {delLoading ? '...' : '삭제'}
                        </button>
                        <button onClick={() => setDelId(null)} className="p-1.5 text-slate-400 hover:text-slate-600">
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditId(editId === u.id ? null : u.id); setEditVal({ name: u.name, email: u.email, role: u.role, teamId: u.teamId ?? '', newPassword: '' }); setDelId(null) }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${editId === u.id ? 'bg-slate-100 border-slate-300 text-slate-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                          <Pencil size={11} /> 정보 수정
                        </button>
                        <button
                          onClick={() => { setDelId(u.id); setEditId(null) }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
                          <Trash2 size={11} /> 삭제
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editId === u.id && (
                  <div className="mx-5 mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">이름 *</label>
                        <input value={editVal.name} onChange={e => setEditVal(p => ({ ...p, name: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">이메일 *</label>
                        <input value={editVal.email} onChange={e => setEditVal(p => ({ ...p, email: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">팀</label>
                        <select value={editVal.teamId} onChange={e => setEditVal(p => ({ ...p, teamId: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400">
                          <option value="">팀 없음</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">권한</label>
                        <select value={editVal.role} onChange={e => setEditVal(p => ({ ...p, role: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400">
                          <option value="user">일반 사용자</option>
                          <option value="admin">관리자</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-slate-500 mb-1 block">새 비밀번호 <span className="text-slate-400">(변경 시에만 입력)</span></label>
                        <input type="password" value={editVal.newPassword} onChange={e => setEditVal(p => ({ ...p, newPassword: e.target.value }))}
                          placeholder="변경하지 않으면 비워두세요"
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleEditUser(u.id)} disabled={editLoading || !editVal.name.trim() || !editVal.email.trim()}
                        className="px-4 py-2 text-sm font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 transition flex items-center gap-1.5">
                        {editLoading ? <RefreshCw size={12} className="animate-spin" /> : null}
                        {editLoading ? '저장 중...' : '저장'}
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition">
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )

            return (
              <>
                {teamGroups.map(({ team, members }) => (
                  <div key={team.id}>
                    <div className="px-5 py-2 bg-slate-50 border-y border-slate-100 flex items-center gap-2">
                      <Users size={11} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-600">{team.name}</span>
                      <span className="text-[10px] text-slate-400">{members.length}명</span>
                    </div>
                    {members.map(renderUser)}
                  </div>
                ))}
                {noTeam.length > 0 && (
                  <div>
                    <div className="px-5 py-2 bg-slate-50 border-y border-slate-100 flex items-center gap-2">
                      <Users size={11} className="text-slate-300" />
                      <span className="text-xs font-bold text-slate-400">팀 미배정</span>
                      <span className="text-[10px] text-slate-400">{noTeam.length}명</span>
                    </div>
                    {noTeam.map(renderUser)}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </div>

      {/* 현황 카드 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: <Users size={16} />,    label: '전체 고객',            val: stats.totalCustomers,       color: 'text-slate-700',   bg: 'bg-slate-50' },
          { icon: <Database size={16} />, label: '상세 정보 있는 고객',   val: stats.customersWithDetail,  color: 'text-amber-700',   bg: 'bg-amber-50' },
          { icon: <Link2 size={16} />,    label: '연결된 리드',           val: stats.linkedDeals,          color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { icon: <Unlink size={16} />,   label: '미연결 리드',           val: stats.unlinkedDeals,        color: 'text-red-600',     bg: 'bg-red-50' },
        ].map(({ icon, label, val, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
            <span className={color}>{icon}</span>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`text-2xl font-black tabular-nums ${color}`}>{val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ══ 중복 고객 통합 ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 bg-indigo-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-sm flex items-center gap-2">
                <GitMerge size={15} /> 중복 고객 통합
              </h2>
              <p className="text-indigo-300 text-xs mt-0.5">동일 전화번호로 중복 등록된 고객을 찾아 하나로 합칩니다</p>
            </div>
            <button onClick={handleFindDups} disabled={dupLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50">
              {dupLoading ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
              {dupLoading ? '검색 중...' : '중복 검색'}
            </button>
          </div>
        </div>

        <div className="p-6">
          {dupError && <p className="text-sm text-red-600 mb-4">{dupError}</p>}
          {mergeMsg && (
            <div className="mb-4 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium">
              ✓ {mergeMsg}
            </div>
          )}

          {!dupResult && !dupLoading && (
            <p className="text-sm text-slate-400 text-center py-6">
              "중복 검색" 버튼을 누르면 전화번호가 동일한 고객을 찾아줍니다
            </p>
          )}

          {dupResult && (
            <>
              {/* 요약 */}
              <div className={`mb-5 px-4 py-3 rounded-xl border text-sm font-semibold ${
                dupResult.dupCount > 0
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                {dupResult.dupCount > 0
                  ? `전체 ${dupResult.total}명 중 중복 ${dupResult.groupCount}건 발견 — 제거 가능 레코드 ${dupResult.dupCount}개`
                  : `전체 ${dupResult.total}명 검사 완료 — 중복 없음`}
              </div>

              {/* 중복 그룹 목록 */}
              {dupResult.groups.length > 0 && (
                <div className="space-y-3">
                  {dupResult.groups.map((group, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                      {/* 그룹 헤더 */}
                      <button onClick={() => toggleGroup(idx)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left">
                        <div className="flex items-center gap-3">
                          <Phone size={12} className="text-slate-400" />
                          <span className="text-sm font-semibold text-slate-700">{group.name}</span>
                          <span className="text-xs text-slate-400">{group.phone ?? '전화 없음'}</span>
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded">
                            {group.customers.length}개 중복
                          </span>
                        </div>
                        {expanded.has(idx) ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                      </button>

                      {/* 펼친 상태: 통합 선택 */}
                      {expanded.has(idx) && (
                        <div className="divide-y divide-slate-100">
                          <div className="px-4 py-2 bg-blue-50">
                            <p className="text-[11px] text-blue-600 font-semibold">
                              아래에서 "남길 고객"을 결정하고, 나머지의 "통합" 버튼을 누르세요.
                              리드·활동이 모두 남긴 고객으로 이전됩니다.
                            </p>
                          </div>
                          {group.customers.map((c, ci) => {
                            const isFirst = ci === 0
                            const otherIds = group.customers.filter(x => x.id !== c.id).map(x => x.id)
                            const keepId   = isFirst ? c.id : group.customers[0].id
                            return (
                              <div key={c.id} className={`px-4 py-3 flex items-center justify-between ${isFirst ? 'bg-emerald-50/40' : ''}`}>
                                <div className="flex items-center gap-3 text-xs">
                                  {isFirst && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 font-bold text-[9px] rounded">기준</span>}
                                  <div>
                                    <p className="font-semibold text-slate-700">{c.name}</p>
                                    <p className="text-slate-400 mt-0.5">
                                      {c.phone ?? '전화 없음'} · {c.status} ·
                                      리드 {c.leadCount}건 · {c.createdAt.slice(0, 10)} 생성
                                    </p>
                                  </div>
                                </div>
                                {!isFirst && (
                                  <button
                                    onClick={() => handleMerge(keepId, c.id)}
                                    disabled={merging === c.id}
                                    className="shrink-0 ml-4 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-1.5">
                                    {merging === c.id
                                      ? <><RefreshCw size={10} className="animate-spin" />통합 중</>
                                      : <><GitMerge size={10} />기준으로 통합</>}
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══ 이탈 리드 삭제 ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 bg-red-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-sm flex items-center gap-2">
                <Trash2 size={15} /> 이탈 리드 삭제
              </h2>
              <p className="text-red-300 text-xs mt-0.5">
                구매의향 미확인 이탈 리드를 영업 파이프라인에서 제거합니다. 고객 레코드는 유지됩니다.
              </p>
            </div>
            {lostStep === 'idle' && (
              <button onClick={handleLostPreview} disabled={lostLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50">
                {lostLoading ? <RefreshCw size={12} className="animate-spin" /> : <Eye size={12} />}
                {lostLoading ? '조회 중...' : '삭제 대상 조회'}
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {lostError && <p className="text-sm text-red-600">{lostError}</p>}

          {/* 초기 안내 */}
          {lostStep === 'idle' && (
            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 space-y-1.5">
              <p>• <strong>삭제 대상</strong>: salesStatus = '이탈' 인 SalesDeal 전체</p>
              <p>• <strong>유지 항목</strong>: 연결된 Customer 레코드 (고객 이름·전화번호·상태)</p>
              <p>• <strong>함께 삭제</strong>: 해당 리드의 미팅 기록 (LeadMeeting)</p>
            </div>
          )}

          {/* 미리보기 */}
          {(lostStep === 'preview' || lostStep === 'confirm' || lostStep === 'running') && lostPreview && (
            <div className="space-y-3">
              {/* 요약 */}
              <div className="flex gap-3">
                <div className="flex-1 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-red-500 mb-0.5">삭제될 리드</p>
                  <p className="text-2xl font-black text-red-700 tabular-nums">{lostPreview.count}건</p>
                </div>
                <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-amber-500 mb-0.5">함께 삭제되는 미팅 기록</p>
                  <p className="text-2xl font-black text-amber-700 tabular-nums">{lostPreview.meetingCount}건</p>
                </div>
                <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-emerald-600 mb-0.5">유지되는 고객 레코드</p>
                  <p className="text-2xl font-black text-emerald-700 tabular-nums">
                    {lostPreview.preview.filter(d => d.customerId).length}명
                  </p>
                </div>
              </div>

              {/* 목록 토글 */}
              <button onClick={() => setLostExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-600 transition">
                <span>삭제 대상 목록 {lostExpanded ? '접기' : '펼치기'}</span>
                {lostExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {lostExpanded && (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-slate-400 font-semibold">이름</th>
                        <th className="text-left px-3 py-2 text-slate-400 font-semibold">전화번호</th>
                        <th className="text-left px-3 py-2 text-slate-400 font-semibold">수집일</th>
                        <th className="text-center px-3 py-2 text-slate-400 font-semibold">미팅</th>
                        <th className="text-center px-3 py-2 text-slate-400 font-semibold">고객연결</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lostPreview.preview.map(d => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-700">{d.name}</td>
                          <td className="px-3 py-2 text-slate-500">{d.phone ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-400">{d.collectedAt ?? '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-500">{d.meetingCount || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            {d.customerId
                              ? <span className="text-emerald-600 font-bold">✓</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 경고 */}
              {lostStep === 'preview' && (
                <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    삭제된 리드와 미팅 기록은 복구할 수 없습니다.
                    목록을 확인한 후 실행해 주세요.
                  </p>
                </div>
              )}

              {/* 확인 단계 */}
              {lostStep === 'confirm' && (
                <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-300 rounded-xl">
                  <AlertTriangle size={15} className="text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 font-semibold">
                    이탈 리드 {lostPreview.count}건과 미팅 기록 {lostPreview.meetingCount}건이 영구 삭제됩니다. 정말 실행하시겠습니까?
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 완료 */}
          {lostStep === 'done' && lostResult && (
            <div className="flex items-start gap-3 px-4 py-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-800">완료</p>
                <p className="text-xs text-emerald-700 mt-0.5">{lostResult.message}</p>
              </div>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex items-center gap-3 pt-1">
            {lostStep === 'preview' && (
              <>
                <button onClick={() => setLostStep('confirm')}
                  className="px-5 py-2.5 text-sm font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition">
                  삭제 실행
                </button>
                <button onClick={() => { setLostStep('idle'); setLostPreview(null) }}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                  취소
                </button>
              </>
            )}
            {lostStep === 'confirm' && (
              <>
                <button onClick={handleLostDelete}
                  className="px-5 py-2.5 text-sm font-bold rounded-xl bg-red-700 text-white hover:bg-red-800 transition">
                  최종 확인 — 지금 삭제
                </button>
                <button onClick={() => setLostStep('preview')}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                  돌아가기
                </button>
              </>
            )}
            {lostStep === 'running' && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <RefreshCw size={14} className="animate-spin" /> 삭제 중...
              </div>
            )}
            {lostStep === 'done' && (
              <button onClick={() => { setLostStep('idle'); setLostPreview(null); setLostResult(null) }}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                닫기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══ 고객 데이터 초기화 ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-800">
          <h2 className="text-white font-bold text-sm">고객 데이터 초기화</h2>
          <p className="text-slate-400 text-xs mt-0.5">리드에서 자동 복사된 상세 정보를 제거하고, 이름·전화번호만 유지합니다</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 text-sm">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black shrink-0">1</span>
              <div>
                <p className="font-semibold text-slate-700">기존 고객 초기화 ({stats.totalCustomers}개)</p>
                <p className="text-slate-500 text-xs mt-0.5">이름·전화번호·세그먼트·상태 유지 — 차량/화주/CRM 상세 초기화</p>
              </div>
            </div>
            {stats.unlinkedDeals > 0 && (
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                <div>
                  <p className="font-semibold text-slate-700">미연결 리드 고객 생성 ({stats.unlinkedDeals}개)</p>
                  <p className="text-slate-500 text-xs mt-0.5">이름·전화번호로 고객 레코드 생성 후 리드에 연결</p>
                </div>
              </div>
            )}
          </div>

          {resetStep !== 'done' && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                <strong>주의:</strong> 기존 고객의 차량/화주/상세 정보가 삭제됩니다. 중복 통합 먼저 완료 후 실행을 권장합니다.
              </p>
            </div>
          )}

          {resetError && <p className="text-sm text-red-600">{resetError}</p>}

          {resetStep === 'done' && resetResult && (
            <div className="flex items-start gap-3 px-4 py-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-800">완료</p>
                <p className="text-xs text-emerald-700 mt-0.5">{resetResult.message}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            {resetStep === 'idle' && (
              <button onClick={() => setResetStep('confirm')}
                className="px-5 py-2.5 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition">
                실행 준비
              </button>
            )}
            {resetStep === 'confirm' && (
              <>
                <button onClick={handleReset}
                  className="px-5 py-2.5 text-sm font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition">
                  확인 — 지금 실행
                </button>
                <button onClick={() => setResetStep('idle')}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                  취소
                </button>
                <p className="text-xs text-red-500 font-semibold">정말 실행하시겠습니까?</p>
              </>
            )}
            {resetStep === 'running' && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <RefreshCw size={14} className="animate-spin" /> 실행 중...
              </div>
            )}
            {resetStep === 'done' && (
              <button onClick={() => { setResetStep('idle'); setResetResult(null) }}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                닫기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
