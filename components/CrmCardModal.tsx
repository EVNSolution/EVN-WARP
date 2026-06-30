'use client'

import { useState } from 'react'
import VehicleForm, { VehicleData } from './VehicleForm'
import { formatPhone } from '@/lib/format'

/* ── 행정구역 데이터 ─────────────────────────────────── */
const REGIONS: Record<string, string[]> = {
  '서울특별시':    ['강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구','노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구','성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구'],
  '부산광역시':    ['강서구','금정구','기장군','남구','동구','동래구','부산진구','북구','사상구','사하구','서구','수영구','연제구','영도구','중구','해운대구'],
  '대구광역시':    ['군위군','남구','달서구','달성군','동구','북구','서구','수성구','중구'],
  '인천광역시':    ['강화군','계양구','남동구','동구','미추홀구','부평구','서구','연수구','옹진군','중구'],
  '광주광역시':    ['광산구','남구','동구','북구','서구'],
  '대전광역시':    ['대덕구','동구','서구','유성구','중구'],
  '울산광역시':    ['남구','동구','북구','울주군','중구'],
  '세종특별자치시': ['세종시'],
  '경기도':       ['가평군','고양시','과천시','광명시','광주시','구리시','군포시','김포시','남양주시','동두천시','부천시','성남시','수원시','시흥시','안산시','안성시','안양시','양주시','양평군','여주시','연천군','오산시','용인시','의왕시','의정부시','이천시','파주시','평택시','포천시','하남시','화성시'],
  '강원특별자치도': ['강릉시','고성군','동해시','삼척시','속초시','양구군','양양군','영월군','원주시','인제군','정선군','철원군','춘천시','태백시','평창군','홍천군','화천군','횡성군'],
  '충청북도':     ['괴산군','단양군','보은군','영동군','옥천군','음성군','제천시','증평군','진천군','청주시','충주시'],
  '충청남도':     ['계룡시','공주시','금산군','논산시','당진시','보령시','부여군','서산시','서천군','아산시','예산군','천안시','청양군','태안군','홍성군'],
  '전북특별자치도': ['고창군','군산시','김제시','남원시','무주군','부안군','순창군','완주군','익산시','임실군','장수군','전주시','정읍시','진안군'],
  '전라남도':     ['강진군','고흥군','곡성군','광양시','구례군','나주시','담양군','목포시','무안군','보성군','순천시','신안군','여수시','영광군','영암군','완도군','장성군','장흥군','진도군','함평군','해남군','화순군'],
  '경상북도':     ['경산시','경주시','고령군','구미시','김천시','문경시','봉화군','상주시','성주군','안동시','영덕군','영양군','영주시','영천시','예천군','울릉군','울진군','의성군','청도군','청송군','칠곡군','포항시'],
  '경상남도':     ['거제시','거창군','고성군','김해시','남해군','밀양시','사천시','산청군','양산시','의령군','진주시','창녕군','창원시','통영시','하동군','함안군','함양군','합천군'],
  '제주특별자치도': ['서귀포시','제주시'],
}
const CITIES = Object.keys(REGIONS)

const CUST_SOURCES  = ['소개', '온라인', '전시장/이벤트', '직접방문', '기타']
const SHIFT_PRESETS = ['주간', '야간']

interface CrmData {
  customerSegment: string | null
  customerCategory: string | null
  source: string | null
  regionCity: string | null
  regionDist: string | null
  // B2C
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
  // B2B
  b2bCategory: string | null
  companyName: string | null
  businessRegNo: string | null
  contactTitle: string | null
  industry: string | null
  companyAddress: string | null
  companyPhone: string | null
  // 차량정보
  vehicleMaker: string | null
  vehicleName: string | null
  vehicleYear: string | null
  totalMileage: number | null
  truckType1: string | null
  truckType2: string | null
  truckType3: string | null
  truckType4: string | null
  // 화주정보
  shipperName: string | null
  cargoType: string | null
  deliveryCity: string | null
  deliveryDist: string | null
  workShift: string | null
  monthlyIncome: string | null
  cargoNote: string | null
  // 상담 탭 읽기 전용
  currentVehicle: string | null
}

interface Props {
  customerId: string | null
  dealId?: string
  name: string
  phone: string | null
  stageCode: string
  crm: CrmData
  onClose: () => void
  onSaved: (updated: Partial<CrmData>) => void
}

const STAGE_LABELS: Record<string, string> = {
  '1-1': '리드 발굴',  '1-2': '전화 상담',  '1-3': '대면 상담',
  '2-1': '계약 체결',  '2-2': '캐피탈 심사', '2-3': '금융 설계',
  '3-1': '특장 발주',  '3-2': '특장 제작',  '3-3': '1차 출고',
  '4-1': '보험/취등록세', '4-2': '최종 출고',
}

type Segment = 'B2C' | 'B2B'

function initials(name: string) {
  return name.length >= 2 ? name.slice(0, 2) : name
}

/* ── 재사용 컴포넌트 ── */
function SectionTitle({ label, color }: { label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-3">
      {color && <div className="w-1 h-4 rounded-full" style={{ backgroundColor: color }} />}
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text', readOnly = false }:
  { value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; readOnly?: boolean }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300
        ${readOnly ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-100' : 'border-slate-200 bg-white'}`}
    />
  )
}

function ToggleGroup({ options, value, onChange, colors }: {
  options: string[]
  value: string
  onChange: (v: string) => void
  colors?: Record<string, string>
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(o => {
        const active = value === o
        const activeColor = colors?.[o]
        return (
          <button key={o} type="button"
            onClick={() => onChange(value === o ? '' : o)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
              ${active ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}
            style={active ? { backgroundColor: activeColor ?? '#1e293b' } : {}}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

export default function CrmCardModal({ customerId, dealId, name, phone, stageCode, crm, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const [segment,          setSegment]          = useState<Segment>((crm.customerSegment as Segment) ?? 'B2C')
  const [customerCategory, setCustomerCategory] = useState(crm.customerCategory ?? '')
  const [source,           setSource]           = useState(crm.source ?? '')

  // 주소
  const [regionCity, setRegionCity] = useState(crm.regionCity ?? '')
  const [regionDist, setRegionDist] = useState(crm.regionDist ?? '')

  // B2C
  const [email,         setEmail]         = useState(crm.email ?? '')
  const [gender,        setGender]        = useState(crm.gender ?? '')
  const [birthInfo,     setBirthInfo]     = useState(crm.birthInfo ?? '')
  const [maritalStatus, setMaritalStatus] = useState(crm.maritalStatus ?? '')
  const [childrenCount, setChildrenCount] = useState(crm.childrenCount?.toString() ?? '')
  const [addressDetail,    setAddressDetail]    = useState(crm.addressDetail    ?? '')
  const [isSoleProprietor, setIsSoleProprietor] = useState<boolean | null>(crm.isSoleProprietor ?? null)
  const [soleBusinessName, setSoleBusinessName] = useState(crm.soleBusinessName ?? '')
  const [soleBusinessNo,   setSoleBusinessNo]   = useState(crm.soleBusinessNo   ?? '')
  const [soleBusinessType, setSoleBusinessType] = useState(crm.soleBusinessType ?? '')

  // B2B
  const [b2bCategory,    setB2bCategory]    = useState(crm.b2bCategory ?? '')
  const [companyName,    setCompanyName]    = useState(crm.companyName ?? '')
  const [businessRegNo,  setBusinessRegNo]  = useState(crm.businessRegNo ?? '')
  const [contactTitle,   setContactTitle]   = useState(crm.contactTitle ?? '')
  const [industry,       setIndustry]       = useState(crm.industry ?? '')
  const [companyAddress, setCompanyAddress] = useState(crm.companyAddress ?? '')
  const [companyPhone,   setCompanyPhone]   = useState(crm.companyPhone ?? '')

  // 차량정보
  const [vehicleData, setVehicleData] = useState<VehicleData>({
    vehicleMaker: crm.vehicleMaker ?? '',
    vehicleName:  crm.vehicleName  ?? '',
    vehicleYear:  crm.vehicleYear  ?? '',
    totalMileage: crm.totalMileage != null ? crm.totalMileage.toLocaleString() : '',
    truckType1:   crm.truckType1   ?? '',
    truckType2:   crm.truckType2   ?? '',
    truckType3:   crm.truckType3   ?? '',
    truckType4:   crm.truckType4   ?? '',
  })

  // 화주정보
  const SHIPPER_PRESETS = ['컬리', '쿠팡', 'CJ대한통운']
  const initShipperChip = crm.shipperName
    ? SHIPPER_PRESETS.includes(crm.shipperName) ? crm.shipperName : '직접입력'
    : ''
  const [shipperChip,      setShipperChip]      = useState(initShipperChip)
  const [shipperCustom,    setShipperCustom]    = useState(
    crm.shipperName && !SHIPPER_PRESETS.includes(crm.shipperName) ? crm.shipperName : ''
  )
  const shipperName = shipperChip === '직접입력' ? shipperCustom : shipperChip
  const [cargoType,      setCargoType]      = useState(crm.cargoType    ?? '')
  const [deliveryCity,   setDeliveryCity]   = useState(crm.deliveryCity ?? '')
  const [deliveryDist,   setDeliveryDist]   = useState(crm.deliveryDist ?? '')

  const initShiftChip = crm.workShift
    ? SHIFT_PRESETS.includes(crm.workShift) ? crm.workShift : '직접입력' : ''
  const [shiftChip,   setShiftChip]   = useState(initShiftChip)
  const [shiftCustom, setShiftCustom] = useState(
    crm.workShift && !SHIFT_PRESETS.includes(crm.workShift) ? crm.workShift : '')
  const [monthlyIncome,  setMonthlyIncome]  = useState(crm.monthlyIncome ?? '')
  const [cargoNote,      setCargoNote]      = useState(crm.cargoNote    ?? '')

  const d = () => setSaved(false)

  const b2cScore  = [email, gender, maritalStatus].filter(Boolean).length
  const b2bScore  = [companyName, businessRegNo, industry].filter(Boolean).length
  const baseScore = segment === 'B2C' ? b2cScore : b2bScore
  const cargoScore = [cargoType, deliveryCity].filter(Boolean).length
  const pct = Math.round(((baseScore + cargoScore) / 5) * 100)

  const handleSave = async () => {
    if (!customerId && !dealId) return
    setSaving(true)
    const workShift = shiftChip === '직접입력' ? shiftCustom : shiftChip
    const payload = {
      customerSegment:  segment,
      customerCategory: customerCategory || null,
      source:           source           || null,
      regionCity:       regionCity       || null,
      regionDist:       regionDist       || null,
      email:            email            || null,
      gender:           gender           || null,
      birthInfo:        birthInfo        || null,
      maritalStatus:    maritalStatus    || null,
      childrenCount:    childrenCount    ? parseInt(childrenCount) : null,
      addressDetail:    addressDetail    || null,
      isSoleProprietor: isSoleProprietor ?? null,
      soleBusinessName: isSoleProprietor ? soleBusinessName || null : null,
      soleBusinessNo:   isSoleProprietor ? soleBusinessNo   || null : null,
      soleBusinessType: isSoleProprietor ? soleBusinessType || null : null,
      b2bCategory:      b2bCategory      || null,
      companyName:      companyName      || null,
      businessRegNo:    businessRegNo    || null,
      contactTitle:     contactTitle     || null,
      industry:         industry         || null,
      companyAddress:   companyAddress   || null,
      companyPhone:     companyPhone     || null,
      vehicleMaker: vehicleData.vehicleMaker || null,
      vehicleName:  vehicleData.vehicleName  || null,
      vehicleYear:  vehicleData.vehicleYear  || null,
      totalMileage: vehicleData.totalMileage
        ? parseInt(vehicleData.totalMileage.replace(/,/g, ''), 10) : null,
      truckType1:   vehicleData.truckType1   || null,
      truckType2:   vehicleData.truckType2   || null,
      truckType3:   vehicleData.truckType3   || null,
      truckType4:   vehicleData.truckType4   || null,
      shipperName:   shipperName   || null,
      cargoType:     cargoType     || null,
      deliveryCity:  deliveryCity  || null,
      deliveryDist:  deliveryDist  || null,
      workShift:     workShift     || null,
      monthlyIncome: monthlyIncome || null,
      cargoNote:     cargoNote     || null,
    }
    if (customerId) {
      // 기존 Customer에 저장
      await fetch(`/api/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      // Customer 신규 생성 후 Deal에 연결
      const createRes = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, ...payload }),
      })
      if (createRes.ok && dealId) {
        const { id: newCustomerId } = await createRes.json()
        await fetch(`/api/deals/${dealId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId: newCustomerId }),
        })
      }
    }
    setSaving(false)
    setSaved(true)
    onSaved(payload)
  }

  const isB2B = segment === 'B2B'
  const stageLabel = STAGE_LABELS[stageCode] ?? stageCode

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-[500px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* ── 헤더 ── */}
        <div className="shrink-0 relative overflow-hidden"
          style={{ background: isB2B
            ? 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)'
            : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}>

          <button onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition text-xl leading-none">
            ×
          </button>

          <div className="px-6 pt-6 pb-4">
            <div className="flex gap-2 mb-4">
              {(['B2C', 'B2B'] as Segment[]).map(seg => (
                <button key={seg} type="button"
                  onClick={() => { setSegment(seg); d() }}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all
                    ${segment === seg
                      ? 'bg-white text-slate-800'
                      : 'bg-white/15 text-white/70 hover:bg-white/25 hover:text-white'}`}>
                  {seg === 'B2C' ? 'B2C 개인고객' : 'B2B 법인고객'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-bold text-lg text-slate-800"
                style={{ background: isB2B
                  ? 'linear-gradient(135deg, #60a5fa, #3b82f6)'
                  : 'linear-gradient(135deg, #C5D42A, #a3b818)' }}>
                {isB2B
                  ? <span className="text-white text-2xl">🏢</span>
                  : initials(name)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-xl leading-tight">{name}</div>
                {isB2B && companyName && (
                  <div className="text-blue-200 text-sm font-medium mt-0.5">{companyName}</div>
                )}
                <div className="text-white/60 text-sm mt-0.5">{phone ?? '연락처 없음'}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ background: 'rgba(197,212,42,0.2)', color: '#C5D42A' }}>
                    {stageCode}
                  </span>
                  <span className="text-white/50 text-xs">{stageLabel}</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between mb-1">
                <span className="text-white/50 text-[11px]">고객정보 완성도</span>
                <span className="text-white/70 text-[11px] font-semibold">{pct}%</span>
              </div>
              <div className="h-1 rounded-full bg-white/10">
                <div className="h-1 rounded-full transition-all"
                  style={{ width: `${pct}%`, background: isB2B ? '#60a5fa' : '#C5D42A' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── 스크롤 영역 ── */}
        <div className="flex-1 overflow-y-auto px-6 py-2">

          {/* 기본 정보 (공통) */}
          <SectionTitle label="기본 정보" color="#64748b" />
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="고객 유입경로">
                <ToggleGroup
                  options={CUST_SOURCES}
                  value={source}
                  onChange={v => { setSource(v); d() }}
                />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="고객 분류">
                <ToggleGroup
                  options={['자차지입', '임대지입', '용차', '월급기사']}
                  value={customerCategory}
                  onChange={v => {
                    setCustomerCategory(v)
                    d()
                  }}
                  colors={{ '자차지입': '#1d4ed8', '임대지입': '#7c3aed', '용차': '#0d9488', '월급기사': '#b45309' }}
                />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="개인사업자 여부">
                <div className="flex gap-2">
                  {([true, false] as const).map(v => (
                    <button key={String(v)} type="button"
                      onClick={() => { setIsSoleProprietor(isSoleProprietor === v ? null : v); d() }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all
                        ${isSoleProprietor === v
                          ? v ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-400 text-white border-slate-400'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                      {v ? '있음' : '없음'}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            {isSoleProprietor === true && (
              <>
                <div className="col-span-2">
                  <Field label="상호명">
                    <TextInput value={soleBusinessName} onChange={v => { setSoleBusinessName(v); d() }} placeholder="예: 홍길동 물류" />
                  </Field>
                </div>
                <Field label="사업자등록번호">
                  <TextInput value={soleBusinessNo} onChange={v => { setSoleBusinessNo(v); d() }} placeholder="000-00-00000" />
                </Field>
                <Field label="업종">
                  <TextInput value={soleBusinessType} onChange={v => { setSoleBusinessType(v); d() }} placeholder="예: 화물운송" />
                </Field>
              </>
            )}
          </div>

          {/* B2C: 개인정보 */}
          {!isB2B && (
            <>
              <SectionTitle label="개인 기본정보" color="#1d4ed8" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="성별">
                  <ToggleGroup options={['남', '여']} value={gender}
                    onChange={v => { setGender(v); d() }} />
                </Field>
                <Field label="결혼여부">
                  <ToggleGroup options={['미혼', '기혼', '이혼']} value={maritalStatus}
                    onChange={v => { setMaritalStatus(v); d() }} />
                </Field>
                <div className="col-span-2">
                  <Field label="생일">
                    <div className="flex flex-col gap-1.5">
                      <TextInput
                        value={birthInfo}
                        onChange={v => { setBirthInfo(v); d() }}
                        placeholder="예: 1985-03-15  또는  1985  또는  30대"
                      />
                      <div className="flex gap-1 flex-wrap">
                        {['10대', '20대', '30대', '40대', '50대', '60대+'].map(age => (
                          <button key={age} type="button"
                            onClick={() => { setBirthInfo(age); d() }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all
                              ${birthInfo === age
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                            {age}
                          </button>
                        ))}
                      </div>
                    </div>
                  </Field>
                </div>
                <Field label="자녀 수">
                  <TextInput value={childrenCount} onChange={v => { setChildrenCount(v); d() }} type="number" placeholder="0" />
                </Field>
                <div />
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <Field label="시 / 도">
                    <select
                      value={regionCity}
                      onChange={e => { setRegionCity(e.target.value); setRegionDist(''); d() }}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
                      <option value="">선택</option>
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="시 / 구 / 군">
                    <select
                      value={regionDist}
                      onChange={e => { setRegionDist(e.target.value); d() }}
                      disabled={!regionCity}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-50 disabled:text-slate-400">
                      <option value="">{regionCity ? '선택' : '시/도 먼저 선택'}</option>
                      {(REGIONS[regionCity] ?? []).map(dist => <option key={dist} value={dist}>{dist}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="상세 주소 (동·번지 등)">
                    <TextInput value={addressDetail} onChange={v => { setAddressDetail(v); d() }} placeholder="예: 역삼동 123-4, 스테고빌딩 3층" />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="이메일">
                    <TextInput value={email} onChange={v => { setEmail(v); d() }} type="email" placeholder="example@email.com" />
                  </Field>
                </div>
              </div>
            </>
          )}

          {/* B2B: 법인정보 */}
          {isB2B && (
            <>
              <SectionTitle label="법인 기본정보" color="#1d4ed8" />
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Field label="고객 분류">
                    <ToggleGroup
                      options={['화주', '운송사', '기타']}
                      value={b2bCategory}
                      onChange={v => { setB2bCategory(v); d() }}
                      colors={{ '화주': '#0d9488', '운송사': '#1d4ed8', '기타': '#6b7280' }}
                    />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="회사명 *">
                    <TextInput value={companyName} onChange={v => { setCompanyName(v); d() }} placeholder="(주)회사명" />
                  </Field>
                </div>
                <Field label="사업자등록번호">
                  <TextInput value={businessRegNo} onChange={v => { setBusinessRegNo(v); d() }} placeholder="000-00-00000" />
                </Field>
                <Field label="업종 / 사업분야">
                  <TextInput value={industry} onChange={v => { setIndustry(v); d() }} placeholder="예: 냉동물류, 식품유통" />
                </Field>
                <Field label="담당자 직책">
                  <TextInput value={contactTitle} onChange={v => { setContactTitle(v); d() }} placeholder="예: 대표이사, 구매팀장" />
                </Field>
                <Field label="회사 대표전화">
                  <TextInput value={companyPhone} onChange={v => { setCompanyPhone(formatPhone(v)); d() }} placeholder="02-0000-0000" />
                </Field>
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <Field label="시 / 도">
                    <select
                      value={regionCity}
                      onChange={e => { setRegionCity(e.target.value); setRegionDist(''); d() }}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
                      <option value="">선택</option>
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="시 / 구 / 군">
                    <select
                      value={regionDist}
                      onChange={e => { setRegionDist(e.target.value); d() }}
                      disabled={!regionCity}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-50 disabled:text-slate-400">
                      <option value="">{regionCity ? '선택' : '시/도 먼저 선택'}</option>
                      {(REGIONS[regionCity] ?? []).map(dist => <option key={dist} value={dist}>{dist}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="회사 상세 주소">
                    <TextInput value={companyAddress} onChange={v => { setCompanyAddress(v); d() }} placeholder="예: 테헤란로 123, 스테고빌딩 5층" />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="업무 이메일">
                    <TextInput value={email} onChange={v => { setEmail(v); d() }} type="email" placeholder="contact@company.com" />
                  </Field>
                </div>
              </div>
            </>
          )}

          {/* 차량정보 — B2C 개인고객 전용 */}
          {!isB2B && (
            <>
              <SectionTitle label="차량정보" color="#f97316" />
              <VehicleForm
                data={vehicleData}
                onChange={next => { setVehicleData(next); d() }}
              />
            </>
          )}

          {/* 화주정보 — B2C 개인고객 전용 */}
          {!isB2B && (
            <>
          <SectionTitle label="화주정보" color="#0d9488" />
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="화주명">
                <ToggleGroup
                  options={[...SHIPPER_PRESETS, '직접입력']}
                  value={shipperChip}
                  onChange={v => { setShipperChip(v); d() }}
                  colors={{ '컬리': '#7c3aed', '쿠팡': '#ea580c', 'CJ': '#dc2626', '이마트': '#16a34a', '네이버': '#15803d', '직접입력': '#475569' }}
                />
                {shipperChip === '직접입력' && (
                  <div className="mt-2">
                    <TextInput
                      value={shipperCustom}
                      onChange={v => { setShipperCustom(v); d() }}
                      placeholder="화주명 직접 입력"
                    />
                  </div>
                )}
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="화물 유형">
                <TextInput value={cargoType} onChange={v => { setCargoType(v); d() }} placeholder="예: 냉동, 냉장, 상온, 위험물" />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="배송 지역">
                <div className="grid grid-cols-2 gap-2">
                  <select value={deliveryCity}
                    onChange={e => { setDeliveryCity(e.target.value); setDeliveryDist(''); d() }}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
                    <option value="">시 / 도</option>
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={deliveryDist}
                    onChange={e => { setDeliveryDist(e.target.value); d() }}
                    disabled={!deliveryCity}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-50 disabled:text-slate-400">
                    <option value="">{deliveryCity ? '구 / 군' : '시/도 먼저'}</option>
                    {(REGIONS[deliveryCity] ?? []).map(d2 => <option key={d2} value={d2}>{d2}</option>)}
                  </select>
                </div>
              </Field>
            </div>
            <Field label="근무 패턴">
              <div className="flex gap-1.5 flex-wrap">
                {[...SHIFT_PRESETS, '직접입력'].map(opt => (
                  <button key={opt} type="button"
                    onClick={() => { setShiftChip(shiftChip === opt ? '' : opt); d() }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                      ${shiftChip === opt ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {opt}
                  </button>
                ))}
              </div>
              {shiftChip === '직접입력' && (
                <input value={shiftCustom} onChange={e => { setShiftCustom(e.target.value); d() }}
                  placeholder="직접 입력"
                  className="mt-2 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
              )}
            </Field>
            <Field label="월 수익 규모">
              <TextInput value={monthlyIncome} onChange={v => { setMonthlyIncome(v); d() }} placeholder="예: 300만원" />
            </Field>
            <div className="col-span-2">
              <Field label="화물 특이사항">
                <textarea value={cargoNote} rows={3}
                  onChange={e => { setCargoNote(e.target.value); d() }}
                  placeholder="온도 조건, 포장 방식, 특수 취급 등"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-slate-300" />
              </Field>
            </div>
          </div>
            </>
          )}

          <div className="h-4" />
        </div>

        {/* ── 하단 버튼 ── */}
        <div className="shrink-0 border-t border-slate-100 px-6 py-4 flex items-center justify-between bg-white">
          <button onClick={onClose}
            className="px-5 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
            닫기
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 text-sm font-semibold rounded-lg text-white transition disabled:opacity-50 flex items-center gap-2"
            style={{ background: isB2B ? '#1d4ed8' : '#1e293b' }}>
            {saving
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />저장 중...</>
              : saved ? '✓ 저장됨' : '저장하기'}
          </button>
        </div>
      </div>
    </>
  )
}
