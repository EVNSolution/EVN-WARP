'use client'

import { useState, useTransition, useEffect, useRef, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PIPELINE } from '@/lib/pipeline'

/* ── 선택 옵션 ── */
const SOURCES        = ['소개', '온라인', '전시장/이벤트', '직접방문', '기타']
const VEHICLE_MODELS = ['스테고Z', '마사다', '포터 EV', '봉고 EV']
const BODY_TYPES     = ['냉탑', '건탑', '기타']
const TEMP_TYPES     = ['저탑', '정탑', '하이탑']
const FUND_METHODS   = ['캐피탈', '현금', '보조금+캐피탈', '보조금+현금']
const BUY_TIMINGS    = ['즉시', '1개월 내', '3개월 내', '6개월 내', '미정']
const BUY_TYPES      = ['개인', '법인', '개인사업자']

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

export default function LeadDetailClient({ deal, customer = null }: { deal: Deal; customer?: CustomerSnap | null }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  /* ── 필드 상태 (모든 값을 string으로 관리) ── */
  const [f, setF] = useState<Record<string, string>>({
    name:             deal.name ?? '',
    phone:            deal.phone ?? '',
    source:           deal.source ?? '',
    assignee:         deal.assignee ?? '',
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

  /* ── 미팅 기록 ── */
  type MFile = { name: string; path: string; size: number; mime: string }
  type Meeting = { id: string; type: string; meetingAt: string; duration: number | null; content: string | null; result: string | null; nextAction: string | null; assignee: string | null; filesJson: string | null }

  const [meetings,    setMeetings]    = useState<Meeting[]>([])
  const [showMtgForm, setShowMtgForm] = useState(false)
  const [mtg, setMtg] = useState({ type: '통화', meetingAt: new Date().toISOString().slice(0, 16), duration: '', content: '', result: '', nextAction: '', assignee: '' })
  const [mtgFiles,    setMtgFiles]    = useState<MFile[]>([])
  const [uploading,   setUploading]   = useState(false)
  const [savingMtg,   setSavingMtg]   = useState(false)
  const fileRef      = useRef<HTMLInputElement>(null)
  const mtgSectionRef = useRef<HTMLDivElement>(null)

  const scrollToMeetings = () => {
    setShowMtgForm(true)
    setTimeout(() => mtgSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  useEffect(() => {
    fetch(`/api/deals/${deal.id}/meetings`).then(r => r.json()).then(setMeetings).catch(() => {})
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

  const handleSaveMeeting = async () => {
    setSavingMtg(true)
    try {
      const res = await fetch(`/api/deals/${deal.id}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...mtg,
          duration:  mtg.duration ? parseInt(mtg.duration) : null,
          filesJson: mtgFiles.length ? JSON.stringify(mtgFiles) : null,
        }),
      })
      const saved = await res.json()
      setMeetings(prev => [saved, ...prev])
      setMtg({ type: '통화', meetingAt: new Date().toISOString().slice(0, 16), duration: '', content: '', result: '', nextAction: '', assignee: '' })
      setMtgFiles([])
      setShowMtgForm(false)
    } finally {
      setSavingMtg(false)
    }
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
        assignee:         f.assignee         || null,
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
          <Link href="/funnel" className="text-slate-400 hover:text-slate-600 text-sm transition">← 목록</Link>
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

      {/* ── 미팅 기록 ── */}
      <div ref={mtgSectionRef} className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-700">고객 미팅 기록</h2>
          <button onClick={() => setShowMtgForm(v => !v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition
              ${showMtgForm ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
            {showMtgForm ? '취소' : '+ 미팅 추가'}
          </button>
        </div>

        {/* 미팅 추가 폼 */}
        {showMtgForm && (
          <div className="mb-5 p-5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="grid grid-cols-2 gap-4">
              {/* 유형 */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">미팅 유형</label>
                <div className="flex gap-1.5">
                  {['통화', '방문', '화상', '기타'].map(t => (
                    <button key={t} onClick={() => setMtg(m => ({ ...m, type: t }))}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition
                        ${mtg.type === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {/* 일시 + 소요시간 */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">일시</label>
                  <input type="datetime-local" value={mtg.meetingAt}
                    onChange={e => setMtg(m => ({ ...m, meetingAt: e.target.value }))}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300" />
                </div>
                <div className="w-20">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">소요(분)</label>
                  <input type="number" value={mtg.duration} placeholder="30"
                    onChange={e => setMtg(m => ({ ...m, duration: e.target.value }))}
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
              {/* 결과 */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">결과</label>
                <input value={mtg.result} onChange={e => setMtg(m => ({ ...m, result: e.target.value }))}
                  placeholder="예: 구매의향 확인, 방문 일정 합의"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300" />
              </div>
              {/* 다음 액션 */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">다음 액션</label>
                <input value={mtg.nextAction} onChange={e => setMtg(m => ({ ...m, nextAction: e.target.value }))}
                  placeholder="예: 견적서 발송, 재방문 일정 확정"
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300" />
              </div>
              {/* 파일 첨부 */}
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">첨부파일 (녹음, 회의록 등)</label>
                <div className="flex items-center gap-3">
                  <input ref={fileRef} type="file" multiple
                    accept=".mp3,.m4a,.wav,.pdf,.docx,.xlsx,.txt,.png,.jpg"
                    onChange={handleFileUpload}
                    className="hidden" />
                  <input ref={docFileRef} type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx"
                    onChange={handleDocFileChange}
                    className="hidden" />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition disabled:opacity-40">
                    {uploading ? '업로드 중...' : '파일 선택'}
                  </button>
                  {mtgFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {mtgFiles.map((f, i) => (
                        <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px]">
                          📎 {f.name}
                          <button onClick={() => setMtgFiles(prev => prev.filter((_, j) => j !== i))}
                            className="text-blue-400 hover:text-red-500 ml-1">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={handleSaveMeeting} disabled={savingMtg}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-40">
                {savingMtg ? '저장 중...' : '기록 저장'}
              </button>
            </div>
          </div>
        )}

        {/* 미팅 타임라인 */}
        {meetings.length === 0 ? (
          <div className="text-center py-10 text-slate-300 text-sm border border-dashed border-slate-200 rounded-xl">
            아직 미팅 기록이 없습니다
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map(m => {
              const files: { name: string; path: string; size: number; mime: string }[] = (() => {
                try { return m.filesJson ? JSON.parse(m.filesJson) : [] } catch { return [] }
              })()
              const dt = new Date(m.meetingAt)
              const TYPE_COLOR: Record<string, string> = {
                '통화': 'bg-blue-100 text-blue-700',
                '방문': 'bg-green-100 text-green-700',
                '화상': 'bg-violet-100 text-violet-700',
                '기타': 'bg-slate-100 text-slate-500',
              }
              return (
                <div key={m.id} className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TYPE_COLOR[m.type] ?? 'bg-slate-100 text-slate-500'}`}>
                        {m.type}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {dt.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} {dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {m.duration && <span className="text-[10px] text-slate-400">{m.duration}분</span>}
                      {m.assignee && <span className="text-[10px] text-slate-400">· {m.assignee}</span>}
                    </div>
                    <button onClick={() => handleDeleteMeeting(m.id)}
                      className="text-slate-300 hover:text-red-400 transition text-xs shrink-0">삭제</button>
                  </div>

                  {m.content && (
                    <p className="mt-2 text-xs text-slate-700 whitespace-pre-wrap">{m.content}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {m.result && (
                      <span className="text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-400">결과 </span>{m.result}
                      </span>
                    )}
                    {m.nextAction && (
                      <span className="text-[11px] text-blue-600">
                        <span className="font-semibold">→ </span>{m.nextAction}
                      </span>
                    )}
                  </div>
                  {files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {files.map((f, i) => (
                        <a key={i} href={f.path} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-600 hover:text-blue-600 hover:border-blue-200 transition">
                          {f.mime?.startsWith('audio') ? '🎙' : '📎'} {f.name}
                          <span className="text-slate-300">{(f.size / 1024).toFixed(0)}KB</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
