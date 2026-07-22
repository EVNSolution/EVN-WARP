'use client'

import { useState, useTransition, useEffect, useRef, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PIPELINE } from '@/lib/pipeline'
import AgentPicker from '@/components/AgentPicker'
import AssigneePicker from '@/components/AssigneePicker'
import CallAnalysisModal from '@/components/CallAnalysisModal'

/* ── 선택 옵션 ── */
const SOURCES        = ['소개', '온라인', '전시장/이벤트', '직접방문', '기타']
const VEHICLE_MODELS = ['스테고Z', '마사다', '포터 EV', '봉고 EV']
const BODY_TYPES     = ['냉탑', '건탑', '기타']
const TEMP_TYPES     = ['저탑', '정탑', '하이탑']
const FUND_METHODS   = ['캐피탈', '현금', '보조금+캐피탈', '보조금+현금']
const BUY_TIMINGS    = ['즉시', '1개월 내', '3개월 내', '6개월 내', '미정']
const BUY_TYPES      = ['개인', '법인', '개인사업자']
const LOST_REASONS   = ['구매시점 미달', '가격', '캐피탈 미승인', '중고차구매', '기타']

/* ── 단계별 입력 필드 정의 ── */
type FType = 'text' | 'date' | 'number' | 'chips' | 'crm'

interface FDef {
  key: string
  label: string
  type: FType
  opts?: string[]
  required?: boolean
  ph?: string
  full?: boolean
}

const STAGE_FIELDS: Record<string, FDef[]> = {}

const STAGE_REQUIRED: Record<string, string[]> = {}

const PHASE_COL: Record<number, { text: string; activeBorder: string }> = {
  1: { text: 'text-blue-700',   activeBorder: 'border-blue-500' },
  2: { text: 'text-violet-700', activeBorder: 'border-violet-500' },
  3: { text: 'text-orange-700', activeBorder: 'border-orange-400' },
  4: { text: 'text-teal-700',   activeBorder: 'border-teal-500' },
}

function parseMoney(s: string): number | null {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10)
  return isNaN(n) ? null : n
}

interface Deal {
  id: string
  name: string
  phone: string | null
  birthYear: number | null
  regionCity: string | null
  regionDist: string | null
  leadType: string | null
  source: string | null
  referrer: string | null
  collectedAt: string | null
  currentVehicle: string | null
  tradeIn: string | null
  switchReason: string | null
  purchaseTiming: string | null
  customerType: string | null
  purchaseMethod: string | null
  capitalResult: string | null
  vehicleModel: string | null
  bodyType: string | null
  tempType: string | null
  bodyOptions: string | null
  vehicleCount: number | null
  phoneConsultedAt: string | null
  faceConsultedAt: string | null
  capitalCheckedAt: string | null
  contractedAt: string | null
  deliveredAt: string | null
  vehiclePrice: number | null
  subsidyAmount: number | null
  downPayment: number | null
  totalPrice: number | null
  monthlyPayment: number | null
  loanMonths: number | null
  assignee: string | null
  agentId: string | null
  agent: { id: string; name: string; type: string; company: string | null } | null
  memo: string | null
  lostReason: string | null
  stageCode: string
  salesStatus: string
  checklistJson: string | null
  // CRM
  customerSegment: string | null
  customerCategory: string | null
  email: string | null
  gender: string | null
  birthInfo: string | null
  maritalStatus: string | null
  childrenCount: number | null
  addressDetail: string | null
  isSoleProprietor: boolean | null
  soleBusinessName: string | null
  soleBusinessNo: string | null
  soleBusinessType: string | null
  b2bCategory: string | null
  companyName: string | null
  businessRegNo: string | null
  contactTitle: string | null
  industry: string | null
  companyAddress: string | null
  companyPhone: string | null
  hasVehicle: boolean | null
  vehicleMaker: string | null
  vehicleName: string | null
  vehicleYear: string | null
  totalMileage: number | null
  truckType1: string | null
  truckType2: string | null
  truckType3: string | null
  truckType4: string | null
  shipperName: string | null
  cargoType: string | null
  deliveryCity: string | null
  deliveryDist: string | null
  deliveryFreq: string | null
  workShift: string | null
  monthlyIncome: string | null
  cargoNote: string | null
  productId: string | null
}

export type CustomerSnap = {
  id: string
  // 기본 CRM
  customerSegment: string | null; customerCategory: string | null
  source: string | null; regionCity: string | null; regionDist: string | null
  // B2C
  email: string | null; gender: string | null; birthInfo: string | null
  maritalStatus: string | null; childrenCount: number | null; addressDetail: string | null
  isSoleProprietor: boolean | null; soleBusinessName: string | null
  soleBusinessNo: string | null; soleBusinessType: string | null
  // B2B
  b2bCategory: string | null; companyName: string | null; businessRegNo: string | null
  contactTitle: string | null; industry: string | null
  companyAddress: string | null; companyPhone: string | null
  b2bRevenue1: string | null; b2bRevenue2: string | null; b2bRevenue3: string | null
  // 차량
  hasVehicle: boolean | null; vehicleMaker: string | null; vehicleName: string | null
  vehicleYear: string | null; totalMileage: number | null
  truckType1: string | null; truckType2: string | null; truckType3: string | null; truckType4: string | null
  // 화주
  shipperName: string | null; cargoType: string | null
  deliveryCity: string | null; deliveryDist: string | null
  deliveryFreq: string | null; workShift: string | null
  monthlyIncome: string | null; cargoNote: string | null
}

export type ProductOption = { id: string; name: string; code: string | null; category: string | null }

function localNow() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function toDatetimeLocal(isoStr: string) {
  const d = new Date(isoStr)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function LeadDetailClient({ deal, customer = null, products = [] }: { deal: Deal; customer?: CustomerSnap | null; products?: ProductOption[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  /* ── 필드 상태 (모든 값을 string으로 관리) ── */
  const [f, setF] = useState<Record<string, string>>({
    name:             deal.name ?? '',
    phone:            deal.phone ?? '',
    source:           deal.source ?? '',
    assignee:         deal.assignee ?? '',
    memo:             deal.memo ?? '',
    phoneConsultedAt: deal.phoneConsultedAt?.slice(0, 10) ?? '',
    currentVehicle:   deal.currentVehicle ?? '',
    tradeIn:          deal.tradeIn ?? '',
    switchReason:     deal.switchReason ?? '',
    faceConsultedAt:  deal.faceConsultedAt?.slice(0, 10) ?? '',
    vehicleModel:     deal.vehicleModel ?? '',
    bodyType:         deal.bodyType ?? '',
    tempType:         deal.tempType ?? '',
    bodyOptions:      deal.bodyOptions ?? '',
    purchaseMethod:   deal.purchaseMethod ?? '',
    customerType:     deal.customerType ?? '',
    purchaseTiming:   deal.purchaseTiming ?? '',
    capitalCheckedAt: deal.capitalCheckedAt?.slice(0, 10) ?? '',
    capitalResult:    deal.capitalResult ?? '',
    contractedAt:     deal.contractedAt?.slice(0, 10) ?? '',
    vehiclePrice:     deal.vehiclePrice?.toString() ?? '',
    subsidyAmount:    deal.subsidyAmount?.toString() ?? '',
    downPayment:      deal.downPayment?.toString() ?? '',
    totalPrice:       deal.totalPrice?.toString() ?? '',
    monthlyPayment:   deal.monthlyPayment?.toString() ?? '',
    loanMonths:       deal.loanMonths?.toString() ?? '',
    deliveredAt:      deal.deliveredAt?.slice(0, 10) ?? '',
    vehicleCount:     deal.vehicleCount?.toString() ?? '',
  })

  const setFv = (key: string, val: string) => {
    setF(prev => ({ ...prev, [key]: val }))
    setSaved(false)
  }

  /* ── 판매 제품 ── */
  const [selectedProductId, setSelectedProductId] = useState<string | null>(deal.productId ?? null)

  /* ── 소개인 Agent ── */
  const [agentValue, setAgentValue] = useState<{ id: string; name: string } | null>(
    deal.agent ? { id: deal.agent.id, name: deal.agent.name } : null
  )

  /* ── 기타 상태 ── */
  const [checks, setChecks] = useState<Record<string, boolean | string>>(() => {
    try { return deal.checklistJson ? JSON.parse(deal.checklistJson) : {} }
    catch { return {} }
  })
  // 커스텀 체크리스트 항목 (pipeline-checklists.json 기반)
  const [checksMap, setChecksMap] = useState<Record<string, import('@/lib/pipeline').PipelineCheck[]>>({})
  const [stageCode,   setStageCode]   = useState(deal.stageCode)
  const [salesStatus, setSalesStatus] = useState(deal.salesStatus)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(true)
  const [msg,         setMsg]         = useState('')
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set())

  /* ── 이탈 모달 ── */
  const [showLostModal,    setShowLostModal]    = useState(false)
  const [pendingLostReason, setPendingLostReason] = useState('')
  const [pendingLostNote,   setPendingLostNote]   = useState('')

  /* ── 미팅 기록 ── */
  type MFile = { name: string; path: string; size: number; mime: string }
  type Meeting = { id: string; type: string; meetingAt: string; duration: number | null; content: string | null; result: string | null; nextAction: string | null; assignee: string | null; filesJson: string | null; isPlan?: number | boolean | null }

  const [meetings,       setMeetings]       = useState<Meeting[]>([])
  const [expandedMtgIds, setExpandedMtgIds] = useState<Set<string>>(new Set())
  const [showMtgForm,    setShowMtgForm]    = useState(false)
  const [editingMtgId,   setEditingMtgId]   = useState<string | null>(null)
  const [mtgTab,         setMtgTab]         = useState<'record' | 'plan'>('record')
  const [mtg, setMtg] = useState({ type: '통화', meetingAt: localNow(), duration: '', content: '', result: '', nextAction: '', assignee: '', expenseTransport: '', expenseAccomm: '', expenseMeal: '', expenseOther: '', expenseNote: '' })
  const [mtgFiles,    setMtgFiles]    = useState<MFile[]>([])
  const [uploading,   setUploading]   = useState(false)
  const [savingMtg,   setSavingMtg]   = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const fileRef      = useRef<HTMLInputElement>(null)
  const imgRef       = useRef<HTMLInputElement>(null)
  const mtgSectionRef = useRef<HTMLDivElement>(null)

  const scrollToMeetings = () => {
    setShowMtgForm(true)
    setTimeout(() => mtgSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  useEffect(() => {
    fetch(`/api/deals/${deal.id}/meetings`)
      .then(r => r.json())
      .then((data: Meeting[]) => {
        setMeetings(data)
        if (data.length > 0) setExpandedMtgIds(new Set([data[0].id]))
      })
      .catch(() => {})
  }, [deal.id])

  /* ── 인라인 딜 문서 ── */
  type DealDoc = { id: string; docKey: string; docLabel: string; fileName: string; filePath: string; fileSize: number; uploadedAt: string }
  const [dealDocs,     setDealDocs]     = useState<DealDoc[]>([])
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const docFileRef = useRef<HTMLInputElement>(null)
  const pendingDocRef = useRef<{ docKey: string; docLabel: string; stageCode: string } | null>(null)

  useEffect(() => {
    fetch(`/api/deals/${deal.id}/documents`).then(r => r.json()).then(setDealDocs).catch(() => {})
  }, [deal.id])

  const handleDocUploadClick = (docKey: string, docLabel: string, sc: string) => {
    pendingDocRef.current = { docKey, docLabel, stageCode: sc }
    docFileRef.current?.click()
  }

  const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const pending = pendingDocRef.current
    if (!file || !pending) return
    setUploadingDoc(pending.docKey)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('stageCode', pending.stageCode)
      fd.append('docKey', pending.docKey)
      fd.append('docLabel', pending.docLabel)
      const res = await fetch(`/api/deals/${deal.id}/documents`, { method: 'POST', body: fd })
      const doc = await res.json()
      setDealDocs(prev => [...prev, doc])
    } finally {
      setUploadingDoc(null)
      pendingDocRef.current = null
      if (docFileRef.current) docFileRef.current.value = ''
    }
  }

  const handleDocDelete = async (docId: string, docKey: string) => {
    if (!confirm('이 파일을 삭제할까요?')) return
    await fetch(`/api/deals/${deal.id}/documents/${docId}`, { method: 'DELETE' })
    setDealDocs(prev => prev.filter(d => d.id !== docId))
  }

  useEffect(() => {
    fetch('/api/pipeline-checklists').then(r => r.json()).then((data: Record<string, { key: string; label: string }[]>) => {
      const isB2B = (customer?.customerSegment ?? deal.customerSegment) === 'B2B'
      const merged: typeof checksMap = {}
      for (const ph of PIPELINE) {
        for (const proc of ph.processes) {
          // B2B 전용 체크리스트가 있고 현재 고객이 B2B면 우선 사용
          const baseChecks = (isB2B && proc.checksB2B) ? proc.checksB2B : proc.checks
          const apiChecks  = data[proc.code]
          if (apiChecks && !isB2B) {
            // label만 JSON에서 덮어씀 (B2B 전용 항목은 JSON 오버라이드 미적용)
            merged[proc.code] = baseChecks.map(p => {
              const a = apiChecks.find(c => c.key === p.key)
              return a ? { ...p, label: a.label } : p
            })
          } else {
            merged[proc.code] = baseChecks
          }
        }
      }
      setChecksMap(merged)
    }).catch(() => {})
  }, [])

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('dealId', deal.id)
      files.forEach(f => fd.append('files', f))
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const j = await res.json()
      setMtgFiles(prev => [...prev, ...j.files])
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('dealId', deal.id)
      files.forEach(f => fd.append('files', f))
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const j = await res.json()
      setMtgFiles(prev => [...prev, ...j.files])
    } finally {
      setUploading(false)
      if (imgRef.current) imgRef.current.value = ''
    }
  }

  const handleSaveMeeting = async () => {
    setSavingMtg(true)
    try {
      const body = {
        ...mtg,
        isPlan:           editingMtgId
                            ? (meetings.find(m => m.id === editingMtgId)?.isPlan ? true : false)
                            : mtgTab === 'plan',
        meetingAt:        mtg.meetingAt ? new Date(mtg.meetingAt).toISOString() : new Date().toISOString(),
        duration:         mtg.duration         ? parseInt(mtg.duration)         : null,
        expenseTransport: mtg.expenseTransport ? Number(mtg.expenseTransport) : null,
        expenseAccomm:    mtg.expenseAccomm    ? Number(mtg.expenseAccomm)    : null,
        expenseMeal:      mtg.expenseMeal      ? Number(mtg.expenseMeal)      : null,
        expenseOther:     mtg.expenseOther     ? Number(mtg.expenseOther)     : null,
        filesJson:        mtgFiles.length ? JSON.stringify(mtgFiles) : null,
      }

      if (editingMtgId) {
        const res = await fetch(`/api/deals/${deal.id}/meetings/${editingMtgId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const updated = await res.json()
        setMeetings(prev => prev.map(m => m.id === editingMtgId ? { ...m, ...updated } : m))
        setEditingMtgId(null)
      } else {
        const res = await fetch(`/api/deals/${deal.id}/meetings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const saved = await res.json()
        setMeetings(prev => [saved, ...prev])
        setExpandedMtgIds(new Set([saved.id]))
      }

      setMtg({ type: '통화', meetingAt: localNow(), duration: '', content: '', result: '', nextAction: '', assignee: '', expenseTransport: '', expenseAccomm: '', expenseMeal: '', expenseOther: '', expenseNote: '' })
      setMtgFiles([])
      setShowMtgForm(false)
    } finally {
      setSavingMtg(false)
    }
  }

  const handleEditMeeting = (m: Meeting) => {
    setMtg({
      type:       m.type,
      meetingAt:  toDatetimeLocal(m.meetingAt),
      duration:   m.duration != null ? String(m.duration) : '',
      content:    m.content    ?? '',
      result:     m.result     ?? '',
      nextAction: m.nextAction ?? '',
      assignee:   m.assignee   ?? '',
      expenseTransport: '', expenseAccomm: '', expenseMeal: '', expenseOther: '', expenseNote: '',
    })
    setMtgFiles([])
    setEditingMtgId(m.id)
    setShowMtgForm(true)
    setTimeout(() => mtgSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const handleDeleteMeeting = async (mid: string) => {
    await fetch(`/api/deals/${deal.id}/meetings/${mid}`, { method: 'DELETE' })
    setMeetings(prev => prev.filter(m => m.id !== mid))
  }

  const allCodes   = PIPELINE.flatMap(ph => ph.processes.map(p => p.code))
  const currentIdx = allCodes.indexOf(stageCode)

  /* ── 체크리스트 토글 ── */
  const toggleCheck = (key: string) => {
    setChecks(prev => {
      if (prev[key]) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: new Date().toISOString() }
    })
    setSaved(false)
  }

  /* ── 날짜 포맷 (MM.DD) ── */
  const fmtDate = (v: unknown): string => {
    if (!v || typeof v !== 'string' || !v.match(/^\d{4}/)) return ''
    try {
      const d = new Date(v)
      return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    } catch { return '' }
  }

  /* ── 고객 데이터 연동 필드 자동 확인 ── */
  const isFieldSatisfied = (field: string): boolean => {
    if (field === 'vehicle') {
      return !!(customer?.vehicleMaker || customer?.vehicleName || deal.vehicleMaker || deal.vehicleName)
    }
    if (field === 'shipper') {
      return !!(customer?.shipperName || customer?.cargoType || deal.shipperName || deal.cargoType)
    }
    if (field === 'b2bRevenue') {
      return !!(customer?.b2bRevenue1 || customer?.b2bRevenue2 || customer?.b2bRevenue3)
    }
    if (field === 'purchaseTiming') {
      const v = String(checks['1-2-2'] ?? '')
      return !!v && v !== '미정'
    }
    return false
  }

  const getVehiclePieces = (): string[] => {
    const maker  = customer?.vehicleMaker || deal.vehicleMaker || ''
    const name   = customer?.vehicleName  || deal.vehicleName  || ''
    const year   = customer?.vehicleYear  || deal.vehicleYear  || ''
    const types  = [
      customer?.truckType1 || deal.truckType1 || '',
      customer?.truckType2 || deal.truckType2 || '',
      customer?.truckType3 || deal.truckType3 || '',
      customer?.truckType4 || deal.truckType4 || '',
    ].filter(Boolean).join('/')
    return [maker, name, year, types].filter(Boolean)
  }

  const getShipperPieces = (): string[] => {
    const name  = customer?.shipperName  || deal.shipperName  || ''
    const cargo = customer?.cargoType    || deal.cargoType    || ''
    const city  = customer?.deliveryCity || deal.deliveryCity || ''
    const dist  = customer?.deliveryDist || deal.deliveryDist || ''
    const area  = [city, dist].filter(Boolean).join(' ')
    return [name, cargo, area].filter(Boolean)
  }

  const getVehicleSummary = (): string => getVehiclePieces().join(' · ')
  const getShipperSummary = (): string => getShipperPieces().join(' · ')

  const getB2bRevenueSummary = (): string => {
    const curYear = new Date().getFullYear()
    const entries: [number, string][] = [
      [curYear - 1, customer?.b2bRevenue1 ?? ''],
      [curYear - 2, customer?.b2bRevenue2 ?? ''],
      [curYear - 3, customer?.b2bRevenue3 ?? ''],
    ]
    const latest = entries.find(([, v]) => !!v)
    if (!latest) return ''
    return `${latest[0]}년 ${latest[1]}억`
  }

  /* ── 단계 필수 항목 충족 여부 ── */
  const canAdvance = (code: string) =>
    (STAGE_REQUIRED[code] ?? []).every(k => !!f[k]?.trim())

  /* ── 다음 단계로 이동 ── */
  const advanceStage = () => {
    const idx = allCodes.indexOf(stageCode)
    if (idx < 0 || idx >= allCodes.length - 1) return
    const next = allCodes[idx + 1]
    const nextName = PIPELINE.flatMap(ph => ph.processes).find(p => p.code === next)?.name ?? next
    if (!confirm(`[${stageCode}] 단계를 완료하고 [${next}] ${nextName} 단계로 이동할까요?`)) return
    setStageCode(next)
    setSaved(false)
    setMsg(`[${stageCode}] 완료 → [${next}] 단계로 이동했습니다`)
    setTimeout(() => setMsg(''), 4000)
  }

  /* ── 이탈 처리 ── */
  const handleMarkLost = async () => {
    const reason = pendingLostReason === '기타' && pendingLostNote.trim()
      ? `기타: ${pendingLostNote.trim()}`
      : pendingLostReason
    if (!reason) return
    await fetch(`/api/deals/${deal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salesStatus: '이탈', lostReason: reason }),
    })
    setSalesStatus('이탈')
    setShowLostModal(false)
    setPendingLostReason('')
    setPendingLostNote('')
    setMsg('이탈 처리되었습니다')
    setTimeout(() => setMsg(''), 4000)
    startTransition(() => router.refresh())
  }

  /* ── 저장 ── */
  const handleSave = async () => {
    setSaving(true)
    await fetch(`/api/deals/${deal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stageCode,
        salesStatus,
        checklistJson: JSON.stringify(checks),
        name:             f.name.trim() || deal.name,
        phone:            f.phone            || null,
        source:           f.source           || null,
        agentId:          agentValue?.id     || null,
        productId:        selectedProductId  || null,
        assignee:         f.assignee         || null,
        memo:             f.memo             || null,
        phoneConsultedAt: f.phoneConsultedAt  || null,
        currentVehicle:   f.currentVehicle   || null,
        tradeIn:          f.tradeIn          || null,
        switchReason:     f.switchReason     || null,
        faceConsultedAt:  f.faceConsultedAt  || null,
        vehicleModel:     f.vehicleModel     || null,
        bodyType:         f.bodyType         || null,
        tempType:         f.tempType         || null,
        bodyOptions:      f.bodyOptions      || null,
        purchaseMethod:   f.purchaseMethod   || null,
        customerType:     f.customerType     || null,
        purchaseTiming:   f.purchaseTiming   || null,
        capitalCheckedAt: f.capitalCheckedAt || null,
        capitalResult:    f.capitalResult    || null,
        contractedAt:     f.contractedAt     || null,
        vehiclePrice:     parseMoney(f.vehiclePrice),
        subsidyAmount:    parseMoney(f.subsidyAmount),
        downPayment:      parseMoney(f.downPayment),
        totalPrice:       parseMoney(f.totalPrice),
        monthlyPayment:   parseMoney(f.monthlyPayment),
        loanMonths:       f.loanMonths  ? parseInt(f.loanMonths)  : null,
        deliveredAt:      f.deliveredAt || null,
        vehicleCount:     f.vehicleCount ? parseInt(f.vehicleCount) : null,
      }),
    })
    setSaving(false)
    setSaved(true)
    startTransition(() => router.refresh())
  }

  /* ── 단계 요약 텍스트 (collapsed 상태용) ── */
  const getStageSummary = (code: string): string => {
    const parts: string[] = []
    if (code === '1-1') {
      if (f.source)   parts.push(f.source)
      if (f.assignee) parts.push(`담당: ${f.assignee}`)
    } else if (code === '1-3') {
      if (f.faceConsultedAt) parts.push(`대면 ${f.faceConsultedAt}`)
    } else if (code === '2-1') {
      if (f.contractedAt) parts.push(`계약 ${f.contractedAt}`)
      if (f.vehiclePrice) parts.push(`${Number(f.vehiclePrice).toLocaleString()}원`)
    } else if (code === '2-2') {
      if (f.capitalResult)  parts.push(f.capitalResult)
      if (f.monthlyPayment) parts.push(`월 ${Number(f.monthlyPayment).toLocaleString()}원`)
    } else if (code === '2-3') {
      if (f.deliveredAt) parts.push(`출고 ${f.deliveredAt}`)
    }
    return parts.join(' · ')
  }

  /* ── 단일 필드 렌더링 ── */
  const renderField = (fd: FDef) => {
    const val    = f[fd.key] ?? ''
    const spanCls = fd.full ? 'col-span-2' : ''
    const INPUT = 'w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300'

    if (fd.type === 'crm') {
      /* ─ 고객 마스터가 연결된 경우: 읽기 전용으로 고객 데이터 표시 ─ */
      if (customer) {
        const hasVeh = customer.vehicleMaker || customer.vehicleName || customer.truckType1
        const hasShi = customer.shipperName  || customer.cargoType   || customer.deliveryCity
        const vRows: { label: string; val: string | null }[] = [
          { label: '제조사',  val: customer.vehicleMaker },
          { label: '차종',    val: customer.vehicleName  },
          { label: '연식',    val: customer.vehicleYear  },
          { label: '주행',    val: customer.totalMileage != null ? `${customer.totalMileage.toLocaleString()}km` : null },
          { label: '트럭구분', val: [customer.truckType1, customer.truckType2, customer.truckType3, customer.truckType4].filter(Boolean).join('/') || null },
        ]
        const sRows: { label: string; val: string | null }[] = [
          { label: '화주명',   val: customer.shipperName  },
          { label: '화물',     val: customer.cargoType    },
          { label: '배송지역', val: [customer.deliveryCity, customer.deliveryDist].filter(Boolean).join(' ') || null },
          { label: '배송빈도', val: customer.deliveryFreq },
          { label: '월소득',   val: customer.monthlyIncome },
        ]
        return (
          <div key={fd.key} className={`${spanCls} rounded-xl border border-emerald-200 bg-emerald-50/40 overflow-hidden`}>
            <div className="flex items-center justify-between px-3 py-2 bg-emerald-100/60 border-b border-emerald-200">
              <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">고객 마스터 연동 · 차량 &amp; 화주 정보</p>
              <Link href={`/customers/${customer.id}?returnTo=/funnel/${deal.id}`}
                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 transition">
                고객 정보에서 수정 →
              </Link>
            </div>
            <div className="grid grid-cols-2 divide-x divide-emerald-100">
              {/* 차량 정보 */}
              <div className="px-3 py-2.5">
                <p className="text-[9px] font-bold text-slate-500 mb-1.5">차량 정보</p>
                {hasVeh ? (
                  <dl className="space-y-0.5">
                    {vRows.filter(r => r.val).map(r => (
                      <div key={r.label} className="flex gap-1.5 text-xs">
                        <dt className="text-slate-400 shrink-0 w-14">{r.label}</dt>
                        <dd className="font-medium text-slate-700">{r.val}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-xs text-slate-400 italic">고객 프로필에서 입력해 주세요</p>
                )}
              </div>
              {/* 화주 정보 */}
              <div className="px-3 py-2.5">
                <p className="text-[9px] font-bold text-slate-500 mb-1.5">화주 정보</p>
                {hasShi ? (
                  <dl className="space-y-0.5">
                    {sRows.filter(r => r.val).map(r => (
                      <div key={r.label} className="flex gap-1.5 text-xs">
                        <dt className="text-slate-400 shrink-0 w-14">{r.label}</dt>
                        <dd className="font-medium text-slate-700">{r.val}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-xs text-slate-400 italic">고객 프로필에서 입력해 주세요</p>
                )}
              </div>
            </div>
          </div>
        )
      }

      /* ─ 연결된 고객 없음 ─ */
      return (
        <div key={fd.key} className={`${spanCls} flex items-center justify-between p-3 rounded-xl border border-amber-100 bg-amber-50`}>
          <div>
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-0.5">고객 정보 미연결</p>
            <p className="text-xs text-slate-500">고객관리 페이지에서 고객을 등록하거나 연결해 주세요</p>
          </div>
          <Link href="/customers"
            className="shrink-0 ml-3 text-xs font-bold text-amber-700 hover:text-amber-900 px-3 py-1.5 rounded-lg border border-amber-200 bg-white transition">
            고객관리 →
          </Link>
        </div>
      )
    }

    if (fd.type === 'chips') {
      return (
        <div key={fd.key} className={spanCls}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            {fd.label}{fd.required && <span className="text-red-400 ml-0.5">*</span>}
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {(fd.opts ?? []).map(o => (
              <button key={o} type="button"
                onClick={() => setFv(fd.key, val === o ? '' : o)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition
                  ${val === o ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                {o}
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (fd.type === 'number') {
      return (
        <div key={fd.key} className={spanCls}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            {fd.label}{fd.required && <span className="text-red-400 ml-0.5">*</span>}
          </p>
          <input type="text" inputMode="numeric"
            value={val ? Number(val).toLocaleString() : ''}
            placeholder={fd.ph}
            onChange={e => setFv(fd.key, e.target.value.replace(/[^0-9]/g, ''))}
            className={INPUT} />
        </div>
      )
    }

    return (
      <div key={fd.key} className={spanCls}>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
          {fd.label}{fd.required && <span className="text-red-400 ml-0.5">*</span>}
        </p>
        <input type={fd.type === 'date' ? 'date' : 'text'}
          value={val} placeholder={fd.ph}
          onChange={e => setFv(fd.key, e.target.value)}
          className={INPUT} />
      </div>
    )
  }

  /* ── 단계 카드 렌더링 ── */
  const renderStageCard = (
    proc: { code: string; name: string; checks: { key: string; label: string }[]; documents: { key: string; label: string }[] },
    phase: number
  ) => {
    const col       = PHASE_COL[phase]
    const procIdx   = allCodes.indexOf(proc.code)
    const isPast    = procIdx < currentIdx
    const isCurrent = proc.code === stageCode
    const isFuture  = procIdx > currentIdx
    const isOpen    = isCurrent || expanded.has(proc.code)

    const fDefs       = STAGE_FIELDS[proc.code] ?? []
    const req         = STAGE_REQUIRED[proc.code] ?? []
    const stageChecks = checksMap[proc.code] ?? proc.checks
    const doneCnt     = stageChecks.filter(c =>
      c.field ? isFieldSatisfied(c.field) : !!checks[c.key]
    ).length
    const totalCnt    = stageChecks.length

    const toggleExpand = () =>
      setExpanded(prev => {
        const s = new Set(prev)
        s.has(proc.code) ? s.delete(proc.code) : s.add(proc.code)
        return s
      })

    /* 미래 단계: 잠금 표시 */
    if (isFuture) {
      return (
        <div key={proc.code} className="rounded-xl border border-slate-200 bg-slate-50/60">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => { setStageCode(proc.code); setSaved(false) }}
                className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-slate-400 transition" />
              <span className={`text-xs font-bold ${col.text} opacity-40`}>{proc.code}</span>
              <span className="text-sm text-slate-400">{proc.name}</span>
            </div>
            {req.length > 0 && (
              <span className="text-[10px] text-slate-300">
                필요: {req.map(k => fDefs.find(fd => fd.key === k)?.label ?? k).join(', ')}
              </span>
            )}
          </div>
        </div>
      )
    }

    /* 과거 단계 접힘 */
    if (isPast && !isOpen) {
      return (
        <div key={proc.code} className="rounded-xl border border-green-200 bg-green-50/40">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => { setStageCode(proc.code); setSaved(false) }}
                className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-[9px] font-bold">✓</button>
              <span className={`text-xs font-bold ${col.text}`}>{proc.code}</span>
              <span className="text-sm font-medium text-slate-600">{proc.name}</span>
              {totalCnt > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                  ${doneCnt === totalCnt ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {doneCnt}/{totalCnt}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {getStageSummary(proc.code) && (
                <span className="text-xs text-slate-400 truncate max-w-[200px]">{getStageSummary(proc.code)}</span>
              )}
              <button onClick={toggleExpand}
                className="text-xs text-slate-400 hover:text-slate-700 transition px-2 py-0.5">
                수정
              </button>
            </div>
          </div>
        </div>
      )
    }

    /* 확장 상태 (현재 단계 or 수정 중인 과거 단계) */
    return (
      <div key={proc.code}
        className={`rounded-xl border-2 overflow-hidden transition-shadow
          ${isCurrent
            ? 'border-amber-400 shadow-sm shadow-amber-100'
            : 'border-green-300'}`}>

        {/* 헤더 */}
        <div className={`px-4 py-3 flex items-center justify-between
          ${isCurrent ? 'bg-amber-50' : 'bg-green-50'}`}>
          <div className="flex items-center gap-2">
            <button onClick={() => { setStageCode(proc.code); setSaved(false) }}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold transition
                ${isCurrent
                  ? 'bg-amber-400 border-amber-400 text-white'
                  : 'bg-green-500 border-green-500 text-white'}`}>
              {isCurrent ? '●' : '✓'}
            </button>
            <span className={`text-xs font-bold ${col.text}`}>{proc.code}</span>
            <span className="text-sm font-semibold text-slate-800">{proc.name}</span>
            {isCurrent && (
              <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">현재 단계</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {totalCnt > 0 && (
              <span className={`text-xs font-semibold ${doneCnt === totalCnt ? 'text-green-600' : 'text-slate-400'}`}>
                {doneCnt}/{totalCnt}
              </span>
            )}
            {isPast && (
              <button onClick={toggleExpand}
                className="text-xs text-slate-400 hover:text-slate-600 transition px-2 py-0.5">
                접기
              </button>
            )}
          </div>
        </div>

        {/* 입력 필드 */}
        {fDefs.length > 0 && (
          <div className="px-4 py-4 border-b border-slate-100 bg-white">
            <div className="grid grid-cols-2 gap-3">
              {fDefs.map(fd => renderField(fd))}
            </div>
          </div>
        )}

        {/* 체크리스트 */}
        {stageChecks.length > 0 && (
          <div className="px-4 py-3 bg-white">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">체크리스트</p>
            <div className="space-y-2">
              {stageChecks.map(c => {
                /* ── 공통: 체크 여부 판단 ── */
                const checked: boolean = c.field
                  ? isFieldSatisfied(c.field)
                  : c.opts
                    ? !!checks[c.key]
                    : !!checks[c.key]

                /* ── 공통: 컨테이너 스타일 ── */
                const containerCls = `rounded-lg border px-3 py-2.5 transition-colors ${
                  checked ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'
                }`

                /* ── 고객 데이터 연동 항목 (차량정보, 화주정보, 구매예상시점) ── */
                if (c.field) {
                  let pieces: string[]
                  if (c.field === 'vehicle') pieces = getVehiclePieces()
                  else if (c.field === 'shipper') pieces = getShipperPieces()
                  else if (c.field === 'b2bRevenue') {
                    const s = getB2bRevenueSummary()
                    pieces = s ? [s] : []
                  }
                  else if (c.field === 'purchaseTiming') {
                    const v = String(checks['1-2-2'] ?? '')
                    pieces = v && v !== '미정' ? [v] : []
                  } else pieces = []

                  return (
                    <div key={c.key} className={containerCls}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm shrink-0 ${checked ? 'text-green-500' : 'text-slate-300'}`}>
                          {checked ? '✓' : '○'}
                        </span>
                        <span className={`text-xs font-medium shrink-0 ${checked ? 'text-green-700' : 'text-slate-600'}`}>
                          {c.label}
                        </span>
                        <div className="flex-1" />
                        <div className="flex gap-1 flex-wrap items-center justify-end">
                          {checked && pieces.map((piece, i) => (
                            <span key={i}
                              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-green-100 text-green-700 border border-green-200 whitespace-nowrap">
                              {piece}
                            </span>
                          ))}
                          {c.field !== 'purchaseTiming' && (
                            <Link href={customer ? `/customers/${customer.id}?returnTo=/funnel/${deal.id}` : '/customers'}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors whitespace-nowrap shrink-0 ${
                                checked
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              }`}>
                              {checked ? '수정' : '입력 →'}
                            </Link>
                          )}
                          {c.field === 'purchaseTiming' && !checked && (
                            <span className="text-[10px] text-amber-600 font-semibold">1-2 잠재리드에서 수정</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                }

                /* ── 칩 선택형 항목 (구매예상시점, 자금조달 등) ── */
                if (c.opts) {
                  const selectedVal  = String(checks[c.key] ?? '')
                  const atKey        = `${c.key}-at`
                  const noteKey      = `${c.key}-note`
                  const needsNote    = selectedVal === '직접입력'
                  const optDate      = fmtDate(checks[atKey])
                  return (
                    <div key={c.key} className={`${containerCls} space-y-2`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm shrink-0 ${checked ? 'text-green-500' : 'text-slate-300'}`}>
                          {checked ? '✓' : '○'}
                        </span>
                        <span className={`text-xs font-medium ${checked ? 'text-green-700' : 'text-slate-600'}`}>
                          {c.label}
                        </span>
                        {optDate && (
                          <span className="text-[10px] text-slate-400 font-medium">{optDate}</span>
                        )}
                        <div className="flex-1" />
                        <div className="flex gap-1 flex-wrap">
                          {c.opts.map(opt => (
                            <button key={opt} type="button"
                              onClick={() => {
                                setChecks(prev => {
                                  const selecting = prev[c.key] !== opt
                                  return {
                                    ...prev,
                                    [c.key]: selecting ? opt : '',
                                    [atKey]: selecting ? new Date().toISOString() : '',
                                  }
                                })
                                setSaved(false)
                              }}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                                selectedVal === opt
                                  ? 'bg-slate-800 text-white border-slate-800'
                                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                              }`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      {needsNote && (
                        <input
                          value={String(checks[noteKey] ?? '')}
                          onChange={e => { setChecks(prev => ({ ...prev, [noteKey]: e.target.value })); setSaved(false) }}
                          placeholder="자금 방법 직접 입력..."
                          className="ml-6 w-[calc(100%-1.5rem)] text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300 text-slate-600 placeholder:text-slate-300"
                        />
                      )}
                    </div>
                  )
                }

                /* ── 외부 시스템 연계 버튼 (Build-up EV 등) ── */
                if (c.extLink) {
                  return (
                    <div key={c.key} className={containerCls}>
                      <div className="flex items-center gap-2.5">
                        <button type="button" onClick={() => { toggleCheck(c.key); setSaved(false) }}
                          className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                          <span className={`text-sm shrink-0 ${checked ? 'text-green-500' : 'text-slate-300'}`}>
                            {checked ? '✓' : '○'}
                          </span>
                          <span className={`text-xs font-medium ${checked ? 'text-green-700 line-through' : 'text-slate-600'}`}>
                            {c.label}
                          </span>
                        </button>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200 whitespace-nowrap cursor-not-allowed opacity-60"
                          title="향후 시스템 연계 예정">
                          Build-up EV →
                        </span>
                      </div>
                    </div>
                  )
                }

                /* ── 인라인 파일 업로드 항목 ── */
                if (c.upload) {
                  const uploaded = dealDocs.filter(d => d.docKey === c.upload)
                  const isUploading = uploadingDoc === c.upload
                  const hasFile = uploaded.length > 0
                  const docChecked = hasFile
                  const cls = `rounded-lg border px-3 py-2.5 transition-colors ${
                    docChecked ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'
                  }`
                  const uploadDate = fmtDate(uploaded[0]?.uploadedAt)
                  return (
                    <div key={c.key} className={cls}>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className={`text-sm shrink-0 ${docChecked ? 'text-green-500' : 'text-slate-300'}`}>
                          {docChecked ? '✓' : '○'}
                        </span>
                        <span className={`text-xs font-medium shrink-0 ${docChecked ? 'text-green-700' : 'text-slate-600'}`}>
                          {c.label}
                        </span>
                        {uploadDate && (
                          <span className="text-[10px] text-slate-400 font-medium">{uploadDate}</span>
                        )}
                        <div className="flex-1" />
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {uploaded.map(doc => (
                            <div key={doc.id} className="flex items-center gap-1">
                              <a href={doc.filePath} target="_blank" rel="noreferrer"
                                className="text-[10px] text-blue-600 hover:underline max-w-[120px] truncate font-medium">
                                {doc.fileName}
                              </a>
                              <button type="button" onClick={() => handleDocDelete(doc.id, c.upload!)}
                                className="text-[10px] text-red-300 hover:text-red-500 transition">✕</button>
                            </div>
                          ))}
                          <button type="button"
                            onClick={() => handleDocUploadClick(c.upload!, c.uploadLabel ?? c.label, proc.code)}
                            disabled={isUploading}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition whitespace-nowrap ${
                              isUploading
                                ? 'opacity-50 cursor-not-allowed border-slate-200 text-slate-400'
                                : hasFile
                                  ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            }`}>
                            {isUploading ? '업로드 중...' : hasFile ? '재업로드' : '업로드 →'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }

                /* ── 일반 수동 체크 항목 ── */
                const noteKey = `${c.key}-note`
                const hasNote = !!c.noteLabel

                return (
                  <div key={c.key} className="flex flex-col gap-1.5">
                    <button type="button" onClick={() => { toggleCheck(c.key); setSaved(false) }}
                      className={`${containerCls} flex items-center gap-2.5 w-full text-left`}>
                      <span className={`text-sm shrink-0 ${checked ? 'text-green-500' : 'text-slate-300'}`}>
                        {checked ? '✓' : '○'}
                      </span>
                      <span className={`text-xs font-medium ${checked ? 'text-green-700 line-through' : 'text-slate-600'}`}>
                        {c.label}
                      </span>
                      {fmtDate(checks[c.key]) && (
                        <span className="ml-auto text-[10px] text-slate-400 font-medium pr-1">
                          {fmtDate(checks[c.key])}
                        </span>
                      )}
                    </button>
                    {hasNote && checked && (
                      <div className="ml-7 flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">{c.noteLabel}</span>
                        <input
                          value={String(checks[noteKey] ?? '')}
                          onChange={e => {
                            setChecks(prev => ({ ...prev, [noteKey]: e.target.value }))
                            setSaved(false)
                          }}
                          placeholder={`${c.noteLabel} 입력...`}
                          className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300 text-slate-600 placeholder:text-slate-300"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 증빙서류 */}
        {isOpen && proc.documents.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-white">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">증빙서류</p>
            <div className="space-y-1.5">
              {proc.documents.map(doc => {
                const uploaded   = dealDocs.filter(d => d.docKey === doc.key)
                const hasFile    = uploaded.length > 0
                const isUploading = uploadingDoc === doc.key
                const uploadDate = fmtDate(uploaded[0]?.uploadedAt)
                return (
                  <div key={doc.key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${hasFile ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                    <span className={`text-sm shrink-0 ${hasFile ? 'text-green-500' : 'text-slate-300'}`}>
                      {hasFile ? '✓' : '○'}
                    </span>
                    <span className={`text-xs font-medium flex-1 ${hasFile ? 'text-green-700' : 'text-slate-600'}`}>
                      {doc.label}
                    </span>
                    {uploadDate && (
                      <span className="text-[10px] text-slate-400 font-medium">{uploadDate}</span>
                    )}
                    <div className="flex items-center gap-1.5">
                      {uploaded.map(u => (
                        <div key={u.id} className="flex items-center gap-1">
                          <a href={u.filePath} target="_blank" rel="noreferrer"
                            className="text-[10px] text-blue-600 hover:underline max-w-[100px] truncate font-medium">
                            {u.fileName}
                          </a>
                          <button type="button" onClick={() => handleDocDelete(u.id, doc.key)}
                            className="text-[10px] text-red-300 hover:text-red-500 transition">✕</button>
                        </div>
                      ))}
                      <button type="button"
                        onClick={() => handleDocUploadClick(doc.key, doc.label, proc.code)}
                        disabled={isUploading}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition whitespace-nowrap ${
                          isUploading
                            ? 'opacity-50 cursor-not-allowed border-slate-200 text-slate-400'
                            : hasFile
                              ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}>
                        {isUploading ? '업로드 중...' : hasFile ? '재업로드' : '업로드 →'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 하단 액션바 — 열린 카드 전체 표시 */}
        {isOpen && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400 min-w-0 truncate">
              {isCurrent && procIdx < allCodes.length - 1
                ? canAdvance(proc.code)
                  ? '필수 항목 입력 완료 — 다음 단계로 이동할 수 있습니다'
                  : req.length > 0
                    ? `필수: ${req.map(k => fDefs.find(fd => fd.key === k)?.label ?? k).join(', ')}`
                    : ''
                : ''}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {salesStatus !== '이탈' && salesStatus !== '완료' && (
                <button onClick={() => setShowLostModal(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition">
                  구매의사 포기
                </button>
              )}
              <button onClick={scrollToMeetings}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition">
                미팅 / 상담 기록
              </button>
              {isCurrent && procIdx < allCodes.length - 1 && (
                <button disabled={!canAdvance(proc.code)} onClick={advanceStage}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition
                    ${canAdvance(proc.code)
                      ? 'bg-slate-800 text-white hover:bg-slate-700'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                  다음 단계로 →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ── 전체 진행률 ── */
  const allChecksArr = PIPELINE.flatMap(ph => ph.processes.flatMap(p => checksMap[p.code] ?? p.checks))
  const totalChecks  = allChecksArr.length
  const doneChecks   = allChecksArr.filter(c =>
    c.field ? isFieldSatisfied(c.field) : !!checks[c.key]
  ).length
  const pct = totalChecks ? Math.round((doneChecks / totalChecks) * 100) : 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 알림 배너 */}
      {msg && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
          ✓ {msg}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Link href="/funnel" className="text-slate-400 hover:text-slate-600 text-sm transition">← 리드 목록</Link>
            {customer && (
              <>
                <span className="text-slate-300 text-sm">|</span>
                <Link href="/customers" className="text-slate-400 hover:text-slate-600 text-sm transition">← 고객 목록</Link>
              </>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {(() => {
                const seg = customer?.customerSegment ?? deal.customerSegment
                const company = customer?.companyName ?? deal.companyName
                return (seg === 'B2B' && company) ? company : (f.name || deal.name)
              })()}
              {customer?.customerCategory && (
                <span className="ml-2 text-sm font-semibold text-slate-400">{customer.customerCategory}</span>
              )}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {(() => {
                const seg = customer?.customerSegment ?? deal.customerSegment
                const company = customer?.companyName ?? deal.companyName
                if (seg === 'B2B' && company) {
                  return <span className="text-sm font-medium text-slate-700">{f.name || deal.name}</span>
                }
                return null
              })()}
              <span className="text-sm text-slate-500">{f.phone || deal.phone}</span>
              {(() => {
                const seg = customer?.customerSegment ?? deal.customerSegment
                return seg
                  ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${seg === 'B2B' ? 'bg-violet-700' : 'bg-sky-600'}`}>{seg}</span>
                  : null
              })()}
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white bg-slate-600">{stageCode}</span>
              {f.assignee && <span className="text-xs text-slate-400">담당: {f.assignee}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (!confirm(`"${deal.name}" 리드를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return
              await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' })
              router.push('/funnel')
            }}
            className="px-3 py-2 text-sm font-bold rounded-xl border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition">
            삭제
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2 text-sm font-bold rounded-xl transition disabled:opacity-50
              ${saved ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
            {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장하기'}
          </button>
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-600">전체 프로세스 진행률</span>
            <span className="text-slate-400">{doneChecks} / {totalChecks} 완료</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="text-2xl font-bold text-slate-700 w-14 text-right">{pct}%</span>
      </div>

      {/* ── 리드 기본 정보 ── */}
      <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200 space-y-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">리드 기본 정보</p>
        <div className="grid grid-cols-2 gap-4">
          {/* 유입경로 */}
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">유입경로</label>
            <div className="flex gap-1.5 flex-wrap">
              {['소개', '자체발굴', '인바운드', 'SNS', '전시회', '기타', '소개인'].map(s => (
                <button key={s} type="button"
                  onClick={() => { setFv('source', f.source === s ? '' : s); if (s !== '소개인') setAgentValue(null) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                    ${f.source === s
                      ? s === '소개인' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 소개인 AgentPicker (소개인 선택 시) */}
          {(f.source === '소개인' || f.source === 'Agent') && (
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">소개인</label>
              <AgentPicker value={agentValue} onChange={setAgentValue} />
              {deal.agent && !agentValue && (
                <p className="text-xs text-slate-400 mt-1">기존: {deal.agent.name}</p>
              )}
            </div>
          )}

          {/* 담당자 */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">담당 영업사원</label>
            <AssigneePicker value={f.assignee} onChange={v => setFv('assignee', v)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>

          {/* 모델명 */}
          {products.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">모델명</label>
              <select
                value={selectedProductId ?? ''}
                onChange={e => { setSelectedProductId(e.target.value || null); setSaved(false) }}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
                <option value="">제품 선택 안 함</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code ? `${p.code} — ` : ''}{p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 메모 */}
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">메모</label>
            <textarea value={f.memo ?? ''} rows={3}
              onChange={e => setFv('memo', e.target.value)}
              placeholder="상담 내용, 고객 니즈 등..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
        </div>
      </div>

      {/* 단계 아코디언 */}
      <div className="space-y-2.5">
        {PIPELINE.map(phase => (
          <div key={phase.phase}>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${PHASE_COL[phase.phase].text}`}>
              {phase.name}
            </p>
            <div className="space-y-2">
              {phase.processes.map(proc => renderStageCard(proc, phase.phase))}
            </div>
          </div>
        ))}
      </div>

      {/* 이탈 */}
      <div className="mt-2.5">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-red-500">이탈</p>
        {salesStatus === '이탈' ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
            <span className="text-sm font-bold text-red-600">구매 포기</span>
            <span className="text-xs text-red-400">{deal.lostReason || '원인 미기재'}</span>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">모든 영업 단계에서 구매 의사를 포기한 경우 기록합니다</span>
            <button
              onClick={() => setShowLostModal(true)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 text-red-500 hover:bg-red-50 transition">
              구매의사 포기
            </button>
          </div>
        )}
      </div>

      {/* ── 미팅 기록 / 계획 ── */}
      <div ref={mtgSectionRef} id="meetings" className="mt-8">
        <div className="flex items-center justify-between mb-4">
          {/* 탭 */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(['record', 'plan'] as const).map(tab => {
              const count = meetings.filter(m => tab === 'plan' ? (m.isPlan === 1 || m.isPlan === true) : !m.isPlan).length
              return (
                <button key={tab} onClick={() => { setMtgTab(tab); setShowMtgForm(false); setEditingMtgId(null) }}
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${mtgTab === tab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                  {tab === 'record' ? '기록' : '계획'}
                  <span className="ml-1 text-slate-400 font-normal">({count})</span>
                </button>
              )
            })}
          </div>
          <button onClick={() => {
              if (showMtgForm) {
                setShowMtgForm(false)
                setEditingMtgId(null)
                setMtg({ type: '통화', meetingAt: localNow(), duration: '', content: '', result: '', nextAction: '', assignee: '', expenseTransport: '', expenseAccomm: '', expenseMeal: '', expenseOther: '', expenseNote: '' })
              } else {
                setShowMtgForm(true)
              }
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition
              ${showMtgForm ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
            {showMtgForm ? '취소' : mtgTab === 'plan' ? '+ 미팅 계획' : '+ 미팅 기록'}
          </button>
        </div>

        {/* 미팅 추가/수정 폼 */}
        {showMtgForm && (
          <div className="mb-5 p-5 bg-slate-50 rounded-xl border border-slate-200">
            {editingMtgId && (
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-3">미팅 기록 수정</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              {/* 유형 */}
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">미팅 유형</label>
                <div className="flex gap-1.5">
                  {['통화', '문자', '방문', '화상', '기타'].map(t => (
                    <button key={t} onClick={() => setMtg(m => ({ ...m, type: t }))}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition
                        ${mtg.type === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {/* 일시 */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">일시</label>
                  <input type="datetime-local" value={mtg.meetingAt}
                    onChange={e => setMtg(m => ({ ...m, meetingAt: e.target.value }))}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300" />
                </div>
              </div>
              {/* 내용 */}
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">미팅 내용</label>
                <textarea value={mtg.content} rows={3}
                  onChange={e => setMtg(m => ({ ...m, content: e.target.value }))}
                  placeholder="상담 내용, 고객 요청사항 등..."
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-slate-300" />
              </div>
              {/* AI 음성파일 입력 + 회의록 등록 + 이미지 등록 */}
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">파일 첨부</label>
                <input ref={fileRef} type="file" multiple
                  accept=".mp3,.m4a,.wav,.pdf,.docx,.xlsx,.txt"
                  onChange={handleFileUpload}
                  className="hidden" />
                <input ref={imgRef} type="file" multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.heic"
                  onChange={handleImageUpload}
                  className="hidden" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowAnalysis(true)}
                    className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2 text-xs font-semibold rounded-lg border-2 border-dashed border-indigo-200 text-indigo-500 hover:bg-indigo-50 hover:border-indigo-400 transition">
                    🎙 AI 음성파일 입력
                  </button>
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition disabled:opacity-40">
                    📎 {uploading ? '업로드 중...' : '회의록 등록'}
                  </button>
                  <button type="button" onClick={() => imgRef.current?.click()} disabled={uploading}
                    className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition disabled:opacity-40">
                    📷 {uploading ? '업로드 중...' : '이미지 등록'}
                  </button>
                </div>
                {mtgFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {mtgFiles.map((f, i) => (
                      <span key={i} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px]
                        ${f.mime?.startsWith('image') ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                        {f.mime?.startsWith('image') ? '📷' : '📎'} {f.name}
                        <button onClick={() => setMtgFiles(prev => prev.filter((_, j) => j !== i))}
                          className="text-slate-400 hover:text-red-500 ml-1">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={handleSaveMeeting} disabled={savingMtg}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-40">
                {savingMtg ? '저장 중...' : editingMtgId ? '수정 저장' : mtgTab === 'plan' ? '계획 저장' : '기록 저장'}
              </button>
            </div>
          </div>
        )}

        {/* 미팅 타임라인 — 아코디언 */}
        {(() => {
          const tabMeetings = meetings.filter(m =>
            mtgTab === 'plan' ? (m.isPlan === 1 || m.isPlan === true) : !m.isPlan
          )
          const sortedMeetings = mtgTab === 'plan'
            ? [...tabMeetings].sort((a, b) => new Date(a.meetingAt).getTime() - new Date(b.meetingAt).getTime())
            : tabMeetings
          return sortedMeetings.length === 0 ? (
          <div className="text-center py-10 text-slate-300 text-sm border border-dashed border-slate-200 rounded-xl">
            {mtgTab === 'plan' ? '예정된 미팅 계획이 없습니다' : '아직 미팅 기록이 없습니다'}
          </div>
        ) : (
          <div className={`border rounded-xl overflow-hidden divide-y divide-slate-100 ${mtgTab === 'plan' ? 'border-blue-200' : 'border-slate-200'}`}>
            {/* 요약 헤더 */}
            <div className={`px-4 py-2 flex items-center gap-3 text-[11px] text-slate-400 ${mtgTab === 'plan' ? 'bg-blue-50' : 'bg-slate-50'}`}>
              <span className="font-semibold text-slate-600">{sortedMeetings.length}건</span>
              {mtgTab === 'plan' && sortedMeetings[0] && (
                <span>다음: {new Date(sortedMeetings[0].meetingAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ({sortedMeetings[0].type})</span>
              )}
              {mtgTab === 'record' && sortedMeetings[0] && (
                <span>최근: {new Date(sortedMeetings[0].meetingAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ({sortedMeetings[0].type})</span>
              )}
            </div>
            {sortedMeetings.map((m, idx) => {
              const files: { name: string; path: string; size: number; mime: string }[] = (() => {
                try { return m.filesJson ? JSON.parse(m.filesJson) : [] } catch { return [] }
              })()
              const dt = new Date(m.meetingAt)
              const isOpen = expandedMtgIds.has(m.id)
              const TYPE_COLOR: Record<string, string> = {
                '통화': 'bg-blue-100 text-blue-700',
                '문자': 'bg-sky-100 text-sky-700',
                '방문': 'bg-green-100 text-green-700',
                '화상': 'bg-violet-100 text-violet-700',
                '기타': 'bg-slate-100 text-slate-500',
              }
              const toggleMtg = () => setExpandedMtgIds(prev => {
                const next = new Set(prev)
                next.has(m.id) ? next.delete(m.id) : next.add(m.id)
                return next
              })
              // 요약용 첫 줄
              const summary = m.result || (m.content ? m.content.split('\n')[0].slice(0, 60) : '')

              return (
                <div key={m.id} className="bg-white">
                  {/* 헤더 행 — 항상 표시 */}
                  <button type="button" onClick={toggleMtg}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors group">
                    {/* 타임라인 도트 — 유형별 색상 */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-2 h-2 rounded-full mt-0.5 ${
                        m.type === '통화' ? 'bg-blue-400' :
                        m.type === '문자' ? 'bg-sky-400' :
                        m.type === '방문' ? 'bg-green-400' :
                        m.type === '화상' ? 'bg-violet-400' : 'bg-slate-400'
                      }`} />
                    </div>
                    {/* 유형 배지 */}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${TYPE_COLOR[m.type] ?? 'bg-slate-100 text-slate-500'}`}>
                      {m.type}
                    </span>
                    {/* 날짜 */}
                    <span className="text-xs font-semibold text-slate-600 shrink-0 tabular-nums">
                      {dt.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                      <span className="text-slate-400 font-normal ml-1">
                        {dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                    {m.duration && <span className="text-[10px] text-slate-400 shrink-0">{m.duration}분</span>}
                    {/* 요약 */}
                    {!isOpen && summary && (
                      <span className="text-xs text-slate-500 truncate flex-1">{summary}</span>
                    )}
                    {isOpen && <span className="flex-1" />}
                    {/* 다음 액션 칩 */}
                    {!isOpen && m.nextAction && (
                      <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0 truncate max-w-[160px]">
                        → {m.nextAction}
                      </span>
                    )}
                    {/* 첨부 표시 */}
                    {files.length > 0 && <span className="text-[10px] text-slate-400 shrink-0">📎{files.length}</span>}
                    {/* 펼침 화살표 */}
                    <span className={`text-slate-300 text-xs shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </button>

                  {/* 펼쳐진 상세 */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-50">
                      {m.content && (
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed mb-3 bg-slate-50 rounded-lg px-3 py-2.5">
                          {m.content}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-2">
                        {m.result && (
                          <span className="text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-400">결과 </span>{m.result}
                          </span>
                        )}
                        {m.nextAction && (
                          <span className="text-[11px] text-blue-600 font-semibold">
                            → {m.nextAction}
                          </span>
                        )}
                        {m.assignee && (
                          <span className="text-[11px] text-slate-400">담당: {m.assignee}</span>
                        )}
                      </div>
                      {files.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {files.map((f, i) => (
                            <a key={i} href={f.path} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-600 hover:text-blue-600 hover:border-blue-200 transition">
                              {f.mime?.startsWith('audio') ? '🎙' : f.mime?.startsWith('image') ? '📷' : '📎'} {f.name}
                              <span className="text-slate-300">{(f.size / 1024).toFixed(0)}KB</span>
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleEditMeeting(m)}
                          className="text-[11px] text-slate-400 hover:text-indigo-500 transition">수정</button>
                        <button onClick={() => handleDeleteMeeting(m.id)}
                          className="text-[11px] text-slate-300 hover:text-red-400 transition">삭제</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
        })()}
      </div>

      {/* 증빙서류 업로드용 숨김 input — 항상 마운트되어야 docFileRef.current?.click() 작동 */}
      <input ref={docFileRef} type="file"
        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx"
        onChange={handleDocFileChange}
        className="hidden" />

      {/* AI 통화 분석 모달 */}
      {showAnalysis && (
        <CallAnalysisModal
          onClose={() => setShowAnalysis(false)}
          onApply={({ content, result, nextAction, duration }) => {
            setMtg(m => ({
              ...m,
              type:       '통화',
              content,
              result,
              nextAction,
              duration:   duration != null ? String(duration) : m.duration,
            }))
            setShowMtgForm(true)
          }}
        />
      )}

      {/* 이탈 원인 모달 */}
      {showLostModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-bold text-slate-800 mb-1">구매의사 포기</h3>
            <p className="text-xs text-slate-400 mb-4">이탈 원인을 선택해 주세요</p>
            <div className="space-y-2">
              {LOST_REASONS.map(r => (
                <button key={r} onClick={() => setPendingLostReason(r)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition
                    ${pendingLostReason === r
                      ? 'bg-red-50 border-red-300 text-red-700 font-semibold'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                  {r}
                </button>
              ))}
            </div>
            {pendingLostReason === '기타' && (
              <input
                type="text"
                value={pendingLostNote}
                onChange={e => setPendingLostNote(e.target.value)}
                placeholder="이탈 원인을 직접 입력해 주세요"
                className="mt-3 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            )}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowLostModal(false); setPendingLostReason(''); setPendingLostNote('') }}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">
                취소
              </button>
              <button
                disabled={!pendingLostReason || (pendingLostReason === '기타' && !pendingLostNote.trim())}
                onClick={handleMarkLost}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
                이탈 처리
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
