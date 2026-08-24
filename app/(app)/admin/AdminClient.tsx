'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw,
  Users, Database, Link2, Unlink,
  GitMerge, Search, Phone, ChevronDown, ChevronUp,
  Trash2, UserPlus, X, Pencil, FolderPlus, PackagePlus, Car, CreditCard, MapPin,
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
  nickname:  string | null
  position:  string | null
  ssnFront:  string | null
  ssnBack:   string | null
  address:   string | null
  hireDate:  string | null
  phone:     string | null
  employmentType: string
  externalRole:   string | null
  createdAt: string
}

function formatTenure(hireDate: string | null): string {
  if (!hireDate) return '-'
  const start = new Date(hireDate)
  const now = new Date()
  let years  = now.getFullYear()  - start.getFullYear()
  let months = now.getMonth()     - start.getMonth()
  let days   = now.getDate()      - start.getDate()
  if (days < 0) {
    months -= 1
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  }
  if (months < 0) { years -= 1; months += 12 }
  return years > 0 ? `${years}년 ${months}개월 ${days}일` : `${months}개월 ${days}일`
}

interface TeamRow { id: string; name: string }

interface CardRow {
  id:         string
  holderName: string
  cardNumber: string
  userId:     string | null
  userName:   string | null
  createdAt:  string
}

interface VehicleRow {
  id:         string
  name:       string
  plateNo:    string
  department: string | null
  manager:    string | null
  cardNo:     string | null
  hasCharge:  boolean
  hasHipass:  boolean
}

interface GarageRow {
  id:      string
  name:    string
  address: string
  detail:  string | null
}

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

const PRODUCT_CATEGORIES = ['냉동', '상온', '특장', '기타']

export default function AdminClient({
  stats, users: initialUsers, teams: initialTeams, products: initialProducts, vehicles: initialVehicles,
  garages: initialGarages, corporateCards: initialCards, canManageUsers,
}: {
  stats: Stats; users: UserRow[]; teams: TeamRow[]; products: ProductRow[]; vehicles: VehicleRow[]
  garages: GarageRow[]; corporateCards: CardRow[]; canManageUsers: boolean
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
    if (!newProd.code.trim()) { setProdAddErr('모델명은 필수입니다.'); return }
    setProdAddLoading(true)
    try {
      const res  = await fetch('/api/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newProd, name: newProd.name.trim() || newProd.code.trim() }),
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

  /* ── 업무용 차량 관리 ── */
  const [vehicles,       setVehicles]       = useState<VehicleRow[]>(initialVehicles)
  const [showVehAdd,     setShowVehAdd]     = useState(false)
  const [newVeh, setNewVeh] = useState({ name: '', plateNo: '', department: '', manager: '', cardNo: '', hasCharge: false, hasHipass: false })
  const [vehAddLoading,  setVehAddLoading]  = useState(false)
  const [vehAddErr,      setVehAddErr]      = useState('')
  const [vehEditId,      setVehEditId]      = useState<string | null>(null)
  const [vehEditVal,     setVehEditVal]     = useState({ name: '', plateNo: '', department: '', manager: '', cardNo: '', hasCharge: false, hasHipass: false })
  const [vehEditLoading, setVehEditLoading] = useState(false)
  const [vehDelId,       setVehDelId]       = useState<string | null>(null)
  const [vehDelLoading,  setVehDelLoading]  = useState(false)

  const handleAddVehicle = async () => {
    setVehAddErr('')
    if (!newVeh.name.trim() || !newVeh.plateNo.trim()) { setVehAddErr('차량명과 차량번호는 필수입니다.'); return }
    setVehAddLoading(true)
    try {
      const res  = await fetch('/api/vehicles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVeh),
      })
      const data = await res.json()
      if (!res.ok) { setVehAddErr(data.error ?? '등록 실패'); return }
      setVehicles(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewVeh({ name: '', plateNo: '', department: '', manager: '', cardNo: '', hasCharge: false, hasHipass: false })
      setShowVehAdd(false)
    } finally { setVehAddLoading(false) }
  }

  const handleEditVehicle = async (id: string) => {
    setVehEditLoading(true)
    try {
      const res = await fetch(`/api/vehicles/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehEditVal),
      })
      if (res.ok) {
        const updated = await res.json()
        setVehicles(prev => prev.map(v => v.id === id ? updated : v))
        setVehEditId(null)
      }
    } finally { setVehEditLoading(false) }
  }

  const handleDeleteVehicle = async (id: string) => {
    setVehDelLoading(true)
    try {
      const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' })
      if (res.ok) { setVehicles(prev => prev.filter(v => v.id !== id)); setVehDelId(null) }
    } finally { setVehDelLoading(false) }
  }

  /* ── 차고지 관리 ── */
  const [garages,       setGarages]       = useState<GarageRow[]>(initialGarages)
  const [showGarAdd,    setShowGarAdd]    = useState(false)
  const [newGar, setNewGar] = useState({ name: '', address: '', detail: '' })
  const [garAddLoading, setGarAddLoading] = useState(false)
  const [garAddErr,     setGarAddErr]     = useState('')
  const [garEditId,     setGarEditId]     = useState<string | null>(null)
  const [garEditVal,    setGarEditVal]    = useState({ name: '', address: '', detail: '' })
  const [garEditLoading, setGarEditLoading] = useState(false)
  const [garDelId,      setGarDelId]      = useState<string | null>(null)
  const [garDelLoading, setGarDelLoading] = useState(false)

  const handleAddGarage = async () => {
    setGarAddErr('')
    if (!newGar.name.trim() || !newGar.address.trim()) { setGarAddErr('차고지명과 주소는 필수입니다.'); return }
    setGarAddLoading(true)
    try {
      const res  = await fetch('/api/garages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGar),
      })
      const data = await res.json()
      if (!res.ok) { setGarAddErr(data.error ?? '등록 실패'); return }
      setGarages(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewGar({ name: '', address: '', detail: '' })
      setShowGarAdd(false)
    } finally { setGarAddLoading(false) }
  }

  const handleEditGarage = async (id: string) => {
    setGarEditLoading(true)
    try {
      const res = await fetch(`/api/garages/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(garEditVal),
      })
      if (res.ok) {
        const updated = await res.json()
        setGarages(prev => prev.map(g => g.id === id ? updated : g))
        setGarEditId(null)
      }
    } finally { setGarEditLoading(false) }
  }

  const handleDeleteGarage = async (id: string) => {
    setGarDelLoading(true)
    try {
      const res = await fetch(`/api/garages/${id}`, { method: 'DELETE' })
      if (res.ok) { setGarages(prev => prev.filter(g => g.id !== id)); setGarDelId(null) }
    } finally { setGarDelLoading(false) }
  }

  /* ── 법인카드 관리 ── */
  const [cards,        setCards]        = useState<CardRow[]>(initialCards)
  const [showCardAdd,  setShowCardAdd]  = useState(false)
  const [newCard, setNewCard] = useState({ holderName: '', cardNumber: '', userId: '' })
  const [cardAddLoading, setCardAddLoading] = useState(false)
  const [cardAddErr,     setCardAddErr]     = useState('')
  const [cardDelId,      setCardDelId]      = useState<string | null>(null)
  const [cardDelLoading, setCardDelLoading] = useState(false)
  const [cardEditId,     setCardEditId]     = useState<string | null>(null)
  const [cardEditVal,    setCardEditVal]    = useState({ holderName: '', cardNumber: '', userId: '' })
  const [cardEditLoading, setCardEditLoading] = useState(false)

  const handleAddCard = async () => {
    setCardAddErr('')
    if (!newCard.holderName.trim() || !newCard.cardNumber.trim()) {
      setCardAddErr('카드상 이름과 카드번호는 필수입니다.')
      return
    }
    setCardAddLoading(true)
    try {
      const assignedUser = users.find(u => u.id === newCard.userId)
      const res  = await fetch('/api/corporate-cards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newCard, userName: assignedUser?.name ?? null }),
      })
      const data = await res.json()
      if (!res.ok) { setCardAddErr(data.error ?? '등록 실패'); return }
      setCards(prev => [data, ...prev])
      setNewCard({ holderName: '', cardNumber: '', userId: '' })
      setShowCardAdd(false)
    } finally { setCardAddLoading(false) }
  }

  const handleEditCard = async (id: string) => {
    if (!cardEditVal.holderName.trim() || !cardEditVal.cardNumber.trim()) return
    setCardEditLoading(true)
    try {
      const assignedUser = users.find(u => u.id === cardEditVal.userId)
      const res = await fetch(`/api/corporate-cards/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cardEditVal, userName: assignedUser?.name ?? null }),
      })
      if (res.ok) {
        const data = await res.json()
        setCards(prev => prev.map(c => c.id === id ? data : c))
        setCardEditId(null)
      }
    } finally { setCardEditLoading(false) }
  }

  const handleDeleteCard = async (id: string) => {
    setCardDelLoading(true)
    try {
      const res = await fetch(`/api/corporate-cards/${id}`, { method: 'DELETE' })
      if (res.ok) { setCards(prev => prev.filter(c => c.id !== id)); setCardDelId(null) }
    } finally { setCardDelLoading(false) }
  }

  /* ── 사용자 관리 ── */
  const [users,      setUsers]      = useState<UserRow[]>(initialUsers)
  const [showAdd,    setShowAdd]    = useState(false)
  const [newUser,    setNewUser]    = useState({
    name: '', email: '', password: '', role: 'user', teamId: '',
    nickname: '', position: '', ssnFront: '', ssnBack: '', address: '', hireDate: '', phone: '',
    employmentType: '사내', externalRole: '영업',
  })
  const [addErr,     setAddErr]     = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [delId,       setDelId]       = useState<string | null>(null)
  const [delLoading,  setDelLoading]  = useState(false)
  const [detailId,    setDetailId]    = useState<string | null>(null)
  const [editId,      setEditId]      = useState<string | null>(null)
  const [editVal,     setEditVal]     = useState({
    name: '', email: '', role: 'user', teamId: '', newPassword: '',
    nickname: '', position: '', ssnFront: '', ssnBack: '', address: '', hireDate: '', phone: '',
    employmentType: '사내', externalRole: '영업',
  })
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
      setNewUser({
        name: '', email: '', password: '', role: 'user', teamId: '',
        nickname: '', position: '', ssnFront: '', ssnBack: '', address: '', hireDate: '', phone: '',
        employmentType: '사내', externalRole: '영업',
      })
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
        nickname: editVal.nickname, position: editVal.position, ssnFront: editVal.ssnFront,
        ssnBack: editVal.ssnBack, address: editVal.address,
        hireDate: editVal.hireDate || null, phone: editVal.phone,
        employmentType: editVal.employmentType, externalRole: editVal.externalRole,
      }
      if (editVal.newPassword.trim()) body.password = editVal.newPassword
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(prev => prev.map(u => u.id === id ? data : u))
        setEditId(null)
      }
    } finally { setEditLoading(false) }
  }

  /* 중복 진단 */
  const [dupLoading, setDupLoading] = useState(false)
  const [dupResult,  setDupResult]  = useState<DupResult | null>(null)
  const [dupError,   setDupError]   = useState('')
  const [expanded,   setExpanded]   = useState<Set<number>>(new Set())
  const [merging,    setMerging]    = useState<string | null>(null) // removeId being merged
  const [mergeMsg,   setMergeMsg]   = useState('')

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
    <div className="p-8 max-w-7xl mx-auto space-y-8">

      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">관리자</h1>
        <p className="text-sm text-slate-500 mt-1">사용자 계정 및 데이터 관리</p>
      </div>

      {/* ══ 등록 항목 (제품/팀/사용자/차량) — 동일 크기 박스 + 스크롤 ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* ══ 제품/모델 관리 ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-[560px] flex flex-col">
        <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ backgroundColor: '#1e3a5f' }}>
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

        <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
          {/* 추가 폼 */}
          {showProdAdd && (
            <div className="p-5 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-600 mb-3">새 제품/모델 등록</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">모델명 *</label>
                  <input value={newProd.code} onChange={e => setNewProd(p => ({ ...p, code: e.target.value }))}
                    placeholder="예: 스테고Z"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">등록명칭</label>
                  <input value={newProd.name} onChange={e => setNewProd(p => ({ ...p, name: e.target.value }))}
                    placeholder="예: 스테고Z 냉동 5톤 2025"
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
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">모델명</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">등록명칭</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">메모</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(p => (
                    <>
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-semibold text-slate-800">{p.code ?? '—'}</td>
                        <td className="px-3 py-3 text-slate-600">{p.name}</td>
                        <td className="px-3 py-3 text-xs text-slate-400">{p.memo ?? ''}</td>
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
                                    setProdEditVal({ name: p.name, code: p.code ?? '', category: '', year: '', basePrice: '', costPrice: '', memo: p.memo ?? '' })
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
                          <td colSpan={4} className="px-4 pb-4 pt-0 bg-slate-50">
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">모델명 *</label>
                                <input value={prodEditVal.code} onChange={e => setProdEditVal(v => ({ ...v, code: e.target.value }))}
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">등록명칭</label>
                                <input value={prodEditVal.name} onChange={e => setProdEditVal(v => ({ ...v, name: e.target.value }))}
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                              </div>
                              <div className="col-span-2">
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
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-[560px] flex flex-col">
        <div className="px-6 py-4 bg-slate-700 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <FolderPlus size={15} /> 팀 관리
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">팀 추가 · 삭제 — 사용자 등록 전에 먼저 팀을 만드세요</p>
          </div>
        </div>

        <div className="p-5 space-y-3 flex-1 overflow-y-auto">
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
                <div key={t.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ 사용자 관리 ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-[560px] flex flex-col">
        <div className="px-6 py-4 bg-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <Users size={15} /> 사용자 관리
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">직원 계정 추가 · 비밀번호 초기화 · 삭제</p>
          </div>
          {canManageUsers && (
            <button
              onClick={() => { setShowAdd(v => !v); setAddErr('') }}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition">
              <UserPlus size={13} />
              사용자 추가
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
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
                    <option value="ceo">대표이사 (CEO)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">닉네임</label>
                  <input
                    value={newUser.nickname}
                    onChange={e => setNewUser(p => ({ ...p, nickname: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">직책</label>
                  <input
                    value={newUser.position}
                    onChange={e => setNewUser(p => ({ ...p, position: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">주민번호 앞자리</label>
                  <input
                    value={newUser.ssnFront}
                    onChange={e => setNewUser(p => ({ ...p, ssnFront: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) }))}
                    placeholder="990101"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">주민번호 뒷자리</label>
                  <input
                    value={newUser.ssnBack}
                    onChange={e => setNewUser(p => ({ ...p, ssnBack: e.target.value.replace(/[^0-9]/g, '').slice(0, 7) }))}
                    placeholder="1234567"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">현주소</label>
                  <input
                    value={newUser.address}
                    onChange={e => setNewUser(p => ({ ...p, address: e.target.value }))}
                    placeholder="서울시 ..."
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">전화번호</label>
                  <input
                    value={newUser.phone}
                    onChange={e => setNewUser(p => ({ ...p, phone: e.target.value }))}
                    placeholder="010-0000-0000"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">입사일</label>
                  <input
                    type="date"
                    value={newUser.hireDate}
                    onChange={e => setNewUser(p => ({ ...p, hireDate: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">근속기간</label>
                  <input
                    disabled
                    value={formatTenure(newUser.hireDate || null)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-100 text-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">사내/사외</label>
                  <div className="flex gap-1.5">
                    {(['사내', '사외'] as const).map(t => (
                      <button key={t} type="button"
                        onClick={() => setNewUser(p => ({ ...p, employmentType: t }))}
                        className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg border transition ${
                          newUser.employmentType === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {newUser.employmentType === '사외' && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">사외 구분</label>
                    <select
                      value={newUser.externalRole}
                      onChange={e => setNewUser(p => ({ ...p, externalRole: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400">
                      <option value="영업">영업</option>
                      <option value="AS">AS</option>
                    </select>
                  </div>
                )}
              </div>
              {newUser.employmentType === '사외' && (
                <p className="text-[11px] text-amber-600 mt-2">
                  사외 계정은 로그인 시 영업 파이프라인 · 고객 관리(CRM)만 볼 수 있고, 본인이 담당자로 등록된 리드/고객만 표시됩니다.
                </p>
              )}
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
                      {u.nickname && <span className="text-xs text-slate-400">({u.nickname})</span>}
                      {u.phone && <span className="text-xs text-slate-400">{u.phone}</span>}
                      {u.team && <span className="text-[10px] text-slate-400">{u.team.name}</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                  </div>
                  {canManageUsers && (
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
                            onClick={() => setDetailId(detailId === u.id ? null : u.id)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${detailId === u.id ? 'bg-slate-100 border-slate-300 text-slate-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                            세부정보
                          </button>
                          <button
                            onClick={() => { setEditId(editId === u.id ? null : u.id); setEditVal({
                              name: u.name, email: u.email, role: u.role, teamId: u.teamId ?? '', newPassword: '',
                              nickname: u.nickname ?? '', position: u.position ?? '', ssnFront: u.ssnFront ?? '',
                              ssnBack: u.ssnBack ?? '', address: u.address ?? '',
                              hireDate: u.hireDate ? u.hireDate.slice(0, 10) : '', phone: u.phone ?? '',
                              employmentType: u.employmentType ?? '사내', externalRole: u.externalRole ?? '영업',
                            }); setDelId(null); setDetailId(null) }}
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
                  )}
                </div>
                {canManageUsers && detailId === u.id && (
                  <div className="mx-5 mb-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        u.role === 'admin' || u.role === 'ceo' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {u.role === 'ceo' ? '대표이사 (CEO)' : u.role === 'admin' ? '관리자' : '사용자'}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        u.employmentType === '사외' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {u.employmentType === '사외' ? `사외 · ${u.externalRole ?? '-'}` : '사내'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {u.position ?? '직책 미입력'}
                      {u.ssnFront ? ` · ${u.ssnFront}${u.ssnBack ? `-${u.ssnBack}` : ''}` : ''}
                      {u.hireDate ? ` · 입사 ${u.hireDate.slice(0, 10)} (${formatTenure(u.hireDate)})` : ''}
                    </p>
                    {u.address && <p className="text-xs text-slate-400 mt-1">주소: {u.address}</p>}
                  </div>
                )}
                {canManageUsers && editId === u.id && (
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
                          <option value="ceo">대표이사 (CEO)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">닉네임</label>
                        <input value={editVal.nickname} onChange={e => setEditVal(p => ({ ...p, nickname: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">직책</label>
                        <input value={editVal.position} onChange={e => setEditVal(p => ({ ...p, position: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">주민번호 앞자리</label>
                        <input value={editVal.ssnFront}
                          onChange={e => setEditVal(p => ({ ...p, ssnFront: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) }))}
                          placeholder="990101"
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">주민번호 뒷자리</label>
                        <input value={editVal.ssnBack}
                          onChange={e => setEditVal(p => ({ ...p, ssnBack: e.target.value.replace(/[^0-9]/g, '').slice(0, 7) }))}
                          placeholder="1234567"
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-slate-500 mb-1 block">현주소</label>
                        <input value={editVal.address}
                          onChange={e => setEditVal(p => ({ ...p, address: e.target.value }))}
                          placeholder="서울시 ..."
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">전화번호</label>
                        <input value={editVal.phone} onChange={e => setEditVal(p => ({ ...p, phone: e.target.value }))}
                          placeholder="010-0000-0000"
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">입사일</label>
                        <input type="date" value={editVal.hireDate} onChange={e => setEditVal(p => ({ ...p, hireDate: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">근속기간</label>
                        <input disabled value={formatTenure(editVal.hireDate || null)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-100 text-slate-400" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">사내/사외</label>
                        <div className="flex gap-1.5">
                          {(['사내', '사외'] as const).map(t => (
                            <button key={t} type="button"
                              onClick={() => setEditVal(p => ({ ...p, employmentType: t }))}
                              className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg border transition ${
                                editVal.employmentType === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                              }`}>
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      {editVal.employmentType === '사외' && (
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">사외 구분</label>
                          <select value={editVal.externalRole} onChange={e => setEditVal(p => ({ ...p, externalRole: e.target.value }))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400">
                            <option value="영업">영업</option>
                            <option value="AS">AS</option>
                          </select>
                        </div>
                      )}
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

      {/* ══ 법인카드 관리 ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-[560px] flex flex-col">
        <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ backgroundColor: '#5b3a8e' }}>
          <div>
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <CreditCard size={15} /> 법인카드 관리
            </h2>
            <p className="text-slate-300 text-xs mt-0.5">카드상 이름 · 카드번호 · 배정 대상자 등록</p>
          </div>
          <button
            onClick={() => { setShowCardAdd(v => !v); setCardAddErr('') }}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition">
            <CreditCard size={13} />
            카드 등록
          </button>
        </div>

        <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
          {showCardAdd && (
            <div className="p-5 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-600 mb-3">새 법인카드 등록</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">카드상 이름 *</label>
                  <input value={newCard.holderName} onChange={e => setNewCard(c => ({ ...c, holderName: e.target.value }))}
                    placeholder="카드에 표기된 이름"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">카드번호 *</label>
                  <input value={newCard.cardNumber} onChange={e => setNewCard(c => ({ ...c, cardNumber: e.target.value }))}
                    placeholder="0000-0000-0000-0000"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">배정 대상자</label>
                  <select value={newCard.userId} onChange={e => setNewCard(c => ({ ...c, userId: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400">
                    <option value="">미배정</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              {cardAddErr && <p className="text-xs text-red-500 mt-2">{cardAddErr}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={handleAddCard} disabled={cardAddLoading}
                  className="px-5 py-2 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-50 flex items-center gap-2">
                  {cardAddLoading ? <RefreshCw size={13} className="animate-spin" /> : <CreditCard size={13} />}
                  {cardAddLoading ? '등록 중...' : '카드 등록'}
                </button>
                <button onClick={() => { setShowCardAdd(false); setCardAddErr('') }}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
                  취소
                </button>
              </div>
            </div>
          )}

          {cards.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">등록된 법인카드가 없습니다.</p>
          ) : (
            cards.map(c => (
              <div key={c.id}>
                <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-slate-800">{c.holderName}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.userName ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>
                        {c.userName ? `배정: ${c.userName}` : '미배정'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{c.cardNumber}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {cardDelId === c.id ? (
                      <>
                        <span className="text-xs text-red-600 font-medium">정말 삭제하시겠어요?</span>
                        <button onClick={() => handleDeleteCard(c.id)} disabled={cardDelLoading}
                          className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition">
                          {cardDelLoading ? '...' : '삭제'}
                        </button>
                        <button onClick={() => setCardDelId(null)} className="p-1.5 text-slate-400 hover:text-slate-600">
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setCardEditId(cardEditId === c.id ? null : c.id); setCardEditVal({ holderName: c.holderName, cardNumber: c.cardNumber, userId: c.userId ?? '' }); setCardDelId(null) }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${cardEditId === c.id ? 'bg-slate-100 border-slate-300 text-slate-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                          <Pencil size={11} /> 수정
                        </button>
                        <button onClick={() => setCardDelId(c.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
                          <Trash2 size={11} /> 삭제
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {cardEditId === c.id && (
                  <div className="mx-5 mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">카드상 이름 *</label>
                        <input value={cardEditVal.holderName} onChange={e => setCardEditVal(p => ({ ...p, holderName: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">카드번호 *</label>
                        <input value={cardEditVal.cardNumber} onChange={e => setCardEditVal(p => ({ ...p, cardNumber: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-slate-500 mb-1 block">배정 대상자</label>
                        <select value={cardEditVal.userId} onChange={e => setCardEditVal(p => ({ ...p, userId: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400">
                          <option value="">미배정</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleEditCard(c.id)} disabled={cardEditLoading || !cardEditVal.holderName.trim() || !cardEditVal.cardNumber.trim()}
                        className="px-4 py-2 text-sm font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 transition flex items-center gap-1.5">
                        {cardEditLoading ? <RefreshCw size={12} className="animate-spin" /> : null}
                        {cardEditLoading ? '저장 중...' : '저장'}
                      </button>
                      <button onClick={() => setCardEditId(null)}
                        className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition">
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ══ 업무용 차량 관리 ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-[560px] flex flex-col">
        <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ backgroundColor: '#0f4c42' }}>
          <div>
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <Car size={15} /> 업무용 차량 관리
            </h2>
            <p className="text-slate-300 text-xs mt-0.5">법인차량 등록 · 수정 · 삭제 — 운행일지/차량 신청에서 사용됩니다</p>
          </div>
          <button
            onClick={() => { setShowVehAdd(v => !v); setVehAddErr('') }}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition">
            <Car size={13} />
            차량 등록
          </button>
        </div>

        <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
          {/* 차량 추가 폼 */}
          {showVehAdd && (
            <div className="p-5 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-600 mb-3">새 법인차량 등록</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">차량명 *</label>
                  <input value={newVeh.name} onChange={e => setNewVeh(v => ({ ...v, name: e.target.value }))}
                    placeholder="니로, 아이오닉5 등"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">차량번호 *</label>
                  <input value={newVeh.plateNo} onChange={e => setNewVeh(v => ({ ...v, plateNo: e.target.value }))}
                    placeholder="예: 4055"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">관리부서</label>
                  <input value={newVeh.department} onChange={e => setNewVeh(v => ({ ...v, department: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">관리담당자</label>
                  <input value={newVeh.manager} onChange={e => setNewVeh(v => ({ ...v, manager: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">법인카드번호</label>
                  <input value={newVeh.cardNo} onChange={e => setNewVeh(v => ({ ...v, cardNo: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
              </div>
              <div className="flex gap-4 mt-3">
                {([{ key: 'hasCharge', label: '충전카드' }, { key: 'hasHipass', label: '하이패스' }] as const).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newVeh[key]}
                      onChange={e => setNewVeh(v => ({ ...v, [key]: e.target.checked }))}
                      className="w-4 h-4 rounded" />
                    <span className="text-sm text-slate-600">{label}</span>
                  </label>
                ))}
              </div>
              {vehAddErr && <p className="text-xs text-red-500 mt-2">{vehAddErr}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={handleAddVehicle} disabled={vehAddLoading}
                  className="px-5 py-2 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-50 flex items-center gap-2">
                  {vehAddLoading ? <RefreshCw size={13} className="animate-spin" /> : <Car size={13} />}
                  {vehAddLoading ? '등록 중...' : '차량 등록'}
                </button>
                <button onClick={() => { setShowVehAdd(false); setVehAddErr('') }}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 차량 목록 */}
          {vehicles.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">등록된 차량이 없습니다. 차량 등록 버튼으로 등록하세요.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">차량명</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">차량번호</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">관리부서</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">담당자</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">비고</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicles.map(v => (
                    <>
                      <tr key={v.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-semibold text-slate-800">{v.name}</td>
                        <td className="px-3 py-3 text-slate-600">{v.plateNo}</td>
                        <td className="px-3 py-3 text-slate-500">{v.department ?? '—'}</td>
                        <td className="px-3 py-3 text-slate-500">{v.manager ?? '—'}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            {v.hasCharge && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-semibold">충전카드</span>}
                            {v.hasHipass && <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[10px] font-semibold">하이패스</span>}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 justify-end">
                            {vehDelId === v.id ? (
                              <>
                                <span className="text-xs text-red-600 font-medium whitespace-nowrap">삭제할까요?</span>
                                <button onClick={() => handleDeleteVehicle(v.id)} disabled={vehDelLoading}
                                  className="px-2 py-1 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40">
                                  {vehDelLoading ? '...' : '삭제'}
                                </button>
                                <button onClick={() => setVehDelId(null)} className="p-1 text-slate-400 hover:text-slate-600">
                                  <X size={12} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setVehEditId(vehEditId === v.id ? null : v.id)
                                    setVehEditVal({ name: v.name, plateNo: v.plateNo, department: v.department ?? '', manager: v.manager ?? '', cardNo: v.cardNo ?? '', hasCharge: v.hasCharge, hasHipass: v.hasHipass })
                                    setVehDelId(null)
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                                  <Pencil size={10} /> 수정
                                </button>
                                <button onClick={() => { setVehDelId(v.id); setVehEditId(null) }}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
                                  <Trash2 size={10} /> 삭제
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {vehEditId === v.id && (
                        <tr key={`${v.id}-edit`}>
                          <td colSpan={6} className="px-4 pb-4 pt-0 bg-slate-50">
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">차량명 *</label>
                                <input value={vehEditVal.name} onChange={e => setVehEditVal(x => ({ ...x, name: e.target.value }))}
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">차량번호 *</label>
                                <input value={vehEditVal.plateNo} onChange={e => setVehEditVal(x => ({ ...x, plateNo: e.target.value }))}
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">관리부서</label>
                                <input value={vehEditVal.department} onChange={e => setVehEditVal(x => ({ ...x, department: e.target.value }))}
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">관리담당자</label>
                                <input value={vehEditVal.manager} onChange={e => setVehEditVal(x => ({ ...x, manager: e.target.value }))}
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                              </div>
                              <div className="col-span-2">
                                <label className="text-xs text-slate-500 mb-1 block">법인카드번호</label>
                                <input value={vehEditVal.cardNo} onChange={e => setVehEditVal(x => ({ ...x, cardNo: e.target.value }))}
                                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                              </div>
                            </div>
                            <div className="flex gap-4 mt-3">
                              {([{ key: 'hasCharge', label: '충전카드' }, { key: 'hasHipass', label: '하이패스' }] as const).map(({ key, label }) => (
                                <label key={key} className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" checked={vehEditVal[key]}
                                    onChange={e => setVehEditVal(x => ({ ...x, [key]: e.target.checked }))}
                                    className="w-4 h-4 rounded" />
                                  <span className="text-sm text-slate-600">{label}</span>
                                </label>
                              ))}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button onClick={() => handleEditVehicle(v.id)} disabled={vehEditLoading || !vehEditVal.name.trim() || !vehEditVal.plateNo.trim()}
                                className="px-4 py-2 text-sm font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 transition flex items-center gap-1.5">
                                {vehEditLoading ? <RefreshCw size={12} className="animate-spin" /> : null}
                                {vehEditLoading ? '저장 중...' : '저장'}
                              </button>
                              <button onClick={() => setVehEditId(null)}
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

      {/* ══ 차고지 관리 ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-[560px] flex flex-col">
        <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ backgroundColor: '#0f4c42' }}>
          <div>
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <MapPin size={15} /> 차고지 관리
            </h2>
            <p className="text-slate-300 text-xs mt-0.5">차고지명 · 주소 · 세부위치 등록 — 차량 신청의 출발지/반납지에서 사용됩니다</p>
          </div>
          <button
            onClick={() => { setShowGarAdd(v => !v); setGarAddErr('') }}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition">
            <MapPin size={13} />
            차고지 등록
          </button>
        </div>

        <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
          {/* 차고지 추가 폼 */}
          {showGarAdd && (
            <div className="p-5 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-600 mb-3">새 차고지 등록</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">차고지명 *</label>
                  <input value={newGar.name} onChange={e => setNewGar(v => ({ ...v, name: e.target.value }))}
                    placeholder="본사 차고지 등"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">주소 *</label>
                  <input value={newGar.address} onChange={e => setNewGar(v => ({ ...v, address: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">세부위치</label>
                  <input value={newGar.detail} onChange={e => setNewGar(v => ({ ...v, detail: e.target.value }))}
                    placeholder="예: 지하 1층 B구역"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                </div>
              </div>
              {garAddErr && <p className="text-xs text-red-500 mt-2">{garAddErr}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={handleAddGarage} disabled={garAddLoading}
                  className="px-5 py-2 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-50 flex items-center gap-2">
                  {garAddLoading ? <RefreshCw size={13} className="animate-spin" /> : <MapPin size={13} />}
                  {garAddLoading ? '등록 중...' : '차고지 등록'}
                </button>
                <button onClick={() => { setShowGarAdd(false); setGarAddErr('') }}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 차고지 목록 */}
          {garages.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">등록된 차고지가 없습니다. 차고지 등록 버튼으로 등록하세요.</p>
          ) : (
            garages.map(g => (
              <div key={g.id}>
                <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800">{g.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{g.address}{g.detail ? ` · ${g.detail}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {garDelId === g.id ? (
                      <>
                        <span className="text-xs text-red-600 font-medium whitespace-nowrap">삭제할까요?</span>
                        <button onClick={() => handleDeleteGarage(g.id)} disabled={garDelLoading}
                          className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition">
                          {garDelLoading ? '...' : '삭제'}
                        </button>
                        <button onClick={() => setGarDelId(null)} className="p-1.5 text-slate-400 hover:text-slate-600">
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setGarEditId(garEditId === g.id ? null : g.id); setGarEditVal({ name: g.name, address: g.address, detail: g.detail ?? '' }); setGarDelId(null) }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${garEditId === g.id ? 'bg-slate-100 border-slate-300 text-slate-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                          <Pencil size={11} /> 수정
                        </button>
                        <button onClick={() => { setGarDelId(g.id); setGarEditId(null) }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
                          <Trash2 size={11} /> 삭제
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {garEditId === g.id && (
                  <div className="mx-5 mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">차고지명 *</label>
                        <input value={garEditVal.name} onChange={e => setGarEditVal(x => ({ ...x, name: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">주소 *</label>
                        <input value={garEditVal.address} onChange={e => setGarEditVal(x => ({ ...x, address: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-slate-500 mb-1 block">세부위치</label>
                        <input value={garEditVal.detail} onChange={e => setGarEditVal(x => ({ ...x, detail: e.target.value }))}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-400" />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleEditGarage(g.id)} disabled={garEditLoading || !garEditVal.name.trim() || !garEditVal.address.trim()}
                        className="px-4 py-2 text-sm font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 transition flex items-center gap-1.5">
                        {garEditLoading ? <RefreshCw size={12} className="animate-spin" /> : null}
                        {garEditLoading ? '저장 중...' : '저장'}
                      </button>
                      <button onClick={() => setGarEditId(null)}
                        className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition">
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      </div>
      {/* ── 등록 항목 그리드 끝 ── */}

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

    </div>
  )
}
