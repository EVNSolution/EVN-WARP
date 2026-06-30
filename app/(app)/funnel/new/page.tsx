'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import VehicleForm, { VehicleData } from '@/components/VehicleForm'
import { formatPhone } from '@/lib/format'

/* ── 행정구역 ── */
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

const SOURCES = ['소개', '온라인', '전시장/이벤트', '직접방문', '기타']

type Segment = 'B2C' | 'B2B'

/* ── 공통 스타일 상수 ── */
const INPUT_CLS  = 'w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300'
const SELECT_CLS = 'w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-300'

/* ── 로컬 컴포넌트 ── */
function SectionCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-3.5 border-b border-slate-100" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
        <span className="font-bold text-sm text-slate-700">{title}</span>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
      {text}{required && <span className="text-red-400 ml-0.5">*</span>}
    </p>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label text={label} required={required} />
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} className={INPUT_CLS} />
  )
}

function RegionPicker({ city, dist, onCity, onDist, labels }: {
  city: string; dist: string
  onCity: (v: string) => void; onDist: (v: string) => void
  labels?: [string, string]
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        {labels && <Label text={labels[0]} />}
        <select value={city} onChange={e => { onCity(e.target.value); onDist('') }} className={SELECT_CLS}>
          <option value="">시 / 도</option>
          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        {labels && <Label text={labels[1]} />}
        <select value={dist} onChange={e => onDist(e.target.value)} disabled={!city} className={SELECT_CLS}>
          <option value="">{city ? '구 / 군' : '시/도 먼저 선택'}</option>
          {(REGIONS[city] ?? []).map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
    </div>
  )
}

function Chips({ options, value, onChange, colors }: {
  options: string[]; value: string; onChange: (v: string) => void; colors?: Record<string, string>
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(o => {
        const active = value === o
        return (
          <button key={o} type="button" onClick={() => onChange(value === o ? '' : o)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
              ${active ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}
            style={active ? { backgroundColor: colors?.[o] ?? '#1e293b' } : {}}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

/* ── 섹션 내부 구분선 ── */
function Divider() {
  return <div className="col-span-2 border-t border-slate-100" />
}

export default function NewLeadPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  /* 기본정보 */
  const [segment,   setSegment]   = useState<Segment>('B2C')
  const [name,      setName]      = useState('')
  const [phone,     setPhone]     = useState('')
  const [source,    setSource]    = useState('')
  const stageCode = '1-1'
  const [assignee,  setAssignee]  = useState('')
  const [memo,      setMemo]      = useState('')

  /* B2C 공통 (기본정보 섹션) */
  const [customerCategory, setCustomerCategory] = useState('')
  const [isSoleProprietor, setIsSoleProprietor] = useState<boolean | null>(null)
  const [soleBusinessName, setSoleBusinessName] = useState('')
  const [soleBusinessNo,   setSoleBusinessNo]   = useState('')
  const [soleBusinessType, setSoleBusinessType] = useState('')

  /* B2C 개인정보 */
  const [email,         setEmail]         = useState('')
  const [gender,        setGender]        = useState('')
  const [birthInfo,     setBirthInfo]     = useState('')
  const [maritalStatus, setMaritalStatus] = useState('')
  const [childrenCount, setChildrenCount] = useState('')
  const [regionCity,    setRegionCity]    = useState('')
  const [regionDist,    setRegionDist]    = useState('')
  const [addressDetail, setAddressDetail] = useState('')

  /* B2B 법인정보 */
  const [b2bCategory,    setB2bCategory]    = useState('')
  const [companyName,    setCompanyName]    = useState('')
  const [businessRegNo,  setBusinessRegNo]  = useState('')
  const [industry,       setIndustry]       = useState('')
  const [contactTitle,   setContactTitle]   = useState('')
  const [companyPhone,   setCompanyPhone]   = useState('')
  const [companyAddress, setCompanyAddress] = useState('')

  /* 차량정보 */
  const [vehicleData, setVehicleData] = useState<VehicleData>({
    vehicleMaker: '', vehicleName: '', vehicleYear: '',
    totalMileage: '', truckType1: '', truckType2: '', truckType3: '', truckType4: '',
  })

  /* 화주정보 (B2C 전용) */
  const SHIPPER_PRESETS = ['컬리', '쿠팡', 'CJ', '이마트', '네이버']
  const [shipperChip,   setShipperChip]   = useState('')
  const [shipperCustom, setShipperCustom] = useState('')
  const shipperName = shipperChip === '직접입력' ? shipperCustom : shipperChip
  const cargoType = ''
  const [deliveryCity,  setDeliveryCity]  = useState('')
  const [deliveryDist,  setDeliveryDist]  = useState('')
  const [deliveryFreq,  setDeliveryFreq]  = useState('')
  const [workShift,     setWorkShift]     = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [cargoNote,     setCargoNote]     = useState('')

  const isB2B = segment === 'B2B'

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = '고객명은 필수입니다.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          /* 공통 기본 */
          name: name.trim(), phone, source, stageCode, salesStatus: '진행중',
          customerSegment: segment,
          customerCategory: !isB2B ? (customerCategory || null) : null,
          assignee, memo,
          collectedAt: new Date().toISOString(),
          /* 개인사업자 (B2C 전용) */
          isSoleProprietor:  !isB2B ? isSoleProprietor  : null,
          soleBusinessName:  !isB2B && isSoleProprietor ? soleBusinessName  || null : null,
          soleBusinessNo:    !isB2B && isSoleProprietor ? soleBusinessNo    || null : null,
          soleBusinessType:  !isB2B && isSoleProprietor ? soleBusinessType  || null : null,
          /* B2C 개인정보 */
          email, gender, birthInfo, maritalStatus,
          childrenCount: childrenCount ? parseInt(childrenCount) : null,
          regionCity, regionDist, addressDetail,
          /* B2B 법인정보 */
          b2bCategory, companyName, businessRegNo, industry,
          contactTitle, companyPhone, companyAddress,
          /* 차량정보 */
          vehicleMaker: vehicleData.vehicleMaker || null,
          vehicleName:  vehicleData.vehicleName  || null,
          vehicleYear:  vehicleData.vehicleYear  || null,
          totalMileage: vehicleData.totalMileage
            ? parseInt(vehicleData.totalMileage.replace(/,/g, ''), 10) : null,
          truckType1: vehicleData.truckType1 || null,
          truckType2: vehicleData.truckType2 || null,
          truckType3: vehicleData.truckType3 || null,
          truckType4: vehicleData.truckType4 || null,
          /* 화주정보 (B2C 전용) */
          shipperName:   !isB2B ? (shipperName   || null) : null,
          cargoType:     !isB2B ? (cargoType     || null) : null,
          deliveryCity:  !isB2B ? (deliveryCity  || null) : null,
          deliveryDist:  !isB2B ? (deliveryDist  || null) : null,
          deliveryFreq:  !isB2B ? (deliveryFreq  || null) : null,
          workShift:     !isB2B ? (workShift     || null) : null,
          monthlyIncome: !isB2B ? (monthlyIncome || null) : null,
          cargoNote:     !isB2B ? (cargoNote     || null) : null,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        setErrors({ name: j.error ?? '등록 실패' })
        setSaving(false)
        return
      }
      const deal = await res.json()
      router.push(`/funnel/${deal.id}`)
    } catch {
      setErrors({ name: '네트워크 오류가 발생했습니다.' })
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── 상단 헤더 ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/funnel"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition text-lg leading-none">
            ←
          </Link>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">영업 파이프라인</p>
            <h1 className="text-base font-bold text-slate-800 leading-tight">신규 고객 등록</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/funnel"
            className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
            취소
          </Link>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-50 flex items-center gap-2">
            {saving
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />등록 중...</>
              : '등록하기'}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-5">

        {/* ① 기본 정보 */}
        <SectionCard title="기본 정보" color="#1d4ed8">
          {/* B2C / B2B 세그먼트 */}
          <div className="flex gap-2 mb-5">
            {(['B2C', 'B2B'] as Segment[]).map(seg => (
              <button key={seg} type="button" onClick={() => setSegment(seg)}
                className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all
                  ${segment === seg
                    ? seg === 'B2C' ? 'bg-slate-800 text-white border-slate-800' : 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                {seg === 'B2C' ? '👤 B2C 개인고객' : '🏢 B2B 법인고객'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            {/* 고객명 / 연락처 */}
            <Field label="고객명" required>
              <TextInput value={name} onChange={setName} placeholder={isB2B ? '담당자 이름' : '고객 이름'} />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
            </Field>
            <Field label="연락처">
              <TextInput value={phone} onChange={v => setPhone(formatPhone(v))} placeholder="010-0000-0000" />
            </Field>

            {/* 유입경로 */}
            <div className="col-span-2">
              <Field label="유입 경로">
                <Chips options={SOURCES} value={source} onChange={setSource} />
              </Field>
            </div>

            {/* B2C 전용: 고객분류 + 개인사업자 */}
            {!isB2B && (
              <>
                <div className="col-span-2">
                  <Field label="고객 분류">
                    <Chips
                      options={['자차지입', '임대지입', '용차', '월급기사']}
                      value={customerCategory}
                      onChange={v => {
                        setCustomerCategory(v)
                      }}
                    />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Divider />
                </div>
                <div className="col-span-2">
                  <Field label="개인사업자 여부">
                    <Chips
                      options={['있음', '없음']}
                      value={isSoleProprietor === true ? '있음' : isSoleProprietor === false ? '없음' : ''}
                      onChange={v => setIsSoleProprietor(v === '있음' ? true : v === '없음' ? false : null)}
                    />
                  </Field>
                </div>
                {isSoleProprietor === true && (
                  <>
                    <div className="col-span-2">
                      <Field label="상호명">
                        <TextInput value={soleBusinessName} onChange={setSoleBusinessName} placeholder="예: 홍길동 물류" />
                      </Field>
                    </div>
                    <Field label="사업자등록번호">
                      <TextInput value={soleBusinessNo} onChange={setSoleBusinessNo} placeholder="000-00-00000" />
                    </Field>
                    <Field label="업종">
                      <TextInput value={soleBusinessType} onChange={setSoleBusinessType} placeholder="예: 화물운송" />
                    </Field>
                  </>
                )}
                <div className="col-span-2">
                  <Divider />
                </div>
              </>
            )}

            {/* 담당 영업사원 */}
            <Field label="담당 영업사원">
              <TextInput value={assignee} onChange={setAssignee} placeholder="이름" />
            </Field>

            {/* 메모 */}
            <div className="col-span-2">
              <Field label="메모">
                <textarea value={memo} rows={2} onChange={e => setMemo(e.target.value)}
                  placeholder="면담 중 특이사항, 니즈 등"
                  className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300" />
              </Field>
            </div>
          </div>
        </SectionCard>

        {/* ② B2C 개인정보 */}
        {!isB2B && (
          <SectionCard title="개인 정보 (B2C)" color="#7c3aed">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field label="성별">
                <Chips options={['남', '여']} value={gender} onChange={setGender} />
              </Field>
              <Field label="결혼여부">
                <Chips options={['미혼', '기혼', '이혼']} value={maritalStatus} onChange={setMaritalStatus} />
              </Field>
              <div className="col-span-2">
                <Field label="생년월일 / 연령대">
                  <TextInput value={birthInfo} onChange={setBirthInfo}
                    placeholder="예: 1985-03-15  또는  1985  또는  30대" />
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {['10대','20대','30대','40대','50대','60대+'].map(age => (
                      <button key={age} type="button" onClick={() => setBirthInfo(birthInfo === age ? '' : age)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                          ${birthInfo === age
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                        {age}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <Field label="자녀 수">
                <TextInput value={childrenCount} onChange={setChildrenCount} type="number" placeholder="0" />
              </Field>
              <div className="col-span-2">
                <Divider />
              </div>
              <div className="col-span-2">
                <Field label="거주 지역">
                  <RegionPicker
                    city={regionCity} dist={regionDist}
                    onCity={setRegionCity} onDist={setRegionDist}
                  />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="상세 주소">
                  <TextInput value={addressDetail} onChange={setAddressDetail} placeholder="예: 역삼동 123-4, 스테고빌딩 3층" />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="이메일">
                  <TextInput value={email} onChange={setEmail} placeholder="example@email.com" type="email" />
                </Field>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ② B2B 법인정보 */}
        {isB2B && (
          <SectionCard title="법인 정보 (B2B)" color="#1d4ed8">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div className="col-span-2">
                <Field label="고객 분류">
                  <Chips options={['화주', '운송사', '기타']} value={b2bCategory} onChange={setB2bCategory}
                    colors={{ '화주': '#0d9488', '운송사': '#1d4ed8', '기타': '#6b7280' }} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="회사명">
                  <TextInput value={companyName} onChange={setCompanyName} placeholder="(주)회사명" />
                </Field>
              </div>
              <Field label="사업자등록번호">
                <TextInput value={businessRegNo} onChange={setBusinessRegNo} placeholder="000-00-00000" />
              </Field>
              <Field label="업종 / 사업분야">
                <TextInput value={industry} onChange={setIndustry} placeholder="예: 냉동물류, 식품유통" />
              </Field>
              <Field label="담당자 직책">
                <TextInput value={contactTitle} onChange={setContactTitle} placeholder="예: 대표이사, 구매팀장" />
              </Field>
              <Field label="회사 대표전화">
                <TextInput value={companyPhone} onChange={v => setCompanyPhone(formatPhone(v))} placeholder="02-0000-0000" />
              </Field>
              <div className="col-span-2">
                <Divider />
              </div>
              <div className="col-span-2">
                <Field label="회사 소재지">
                  <RegionPicker
                    city={regionCity} dist={regionDist}
                    onCity={setRegionCity} onDist={setRegionDist}
                  />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="회사 상세 주소">
                  <TextInput value={companyAddress} onChange={setCompanyAddress} placeholder="예: 테헤란로 123, 스테고빌딩 5층" />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="업무 이메일">
                  <TextInput value={email} onChange={setEmail} placeholder="contact@company.com" type="email" />
                </Field>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ③ 차량정보 (B2C 전용) */}
        {!isB2B && (
          <SectionCard title="차량 정보" color="#f97316">
            <VehicleForm data={vehicleData} onChange={setVehicleData} />
          </SectionCard>
        )}

        {/* ④ 화주정보 (B2C 전용) */}
        {!isB2B && (
          <SectionCard title="화주 정보" color="#0d9488">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div className="col-span-2">
                <Field label="화주명">
                  <Chips
                    options={[...SHIPPER_PRESETS, '직접입력']}
                    value={shipperChip}
                    onChange={setShipperChip}
                    colors={{ '컬리': '#7c3aed', '쿠팡': '#ea580c', 'CJ': '#dc2626', '이마트': '#16a34a', '네이버': '#15803d', '직접입력': '#475569' }}
                  />
                  {shipperChip === '직접입력' && (
                    <div className="mt-2">
                      <TextInput value={shipperCustom} onChange={setShipperCustom} placeholder="화주명 직접 입력" />
                    </div>
                  )}
                </Field>
              </div>
              <div className="col-span-2">
                <Divider />
              </div>
              <div className="col-span-2">
                <Field label="배송 지역">
                  <RegionPicker
                    city={deliveryCity} dist={deliveryDist}
                    onCity={setDeliveryCity} onDist={setDeliveryDist}
                  />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="배송 빈도">
                  <Chips options={['주1일', '주2일', '주3일', '주4일', '주5일', '주6일', '주7일']} value={deliveryFreq} onChange={setDeliveryFreq} />
                </Field>
              </div>
              <Field label="근무 시간">
                <Chips options={['주간', '야간']} value={workShift} onChange={setWorkShift}
                  colors={{ '주간': '#f59e0b', '야간': '#6366f1' }} />
              </Field>
              <Field label="월 수익 규모">
                <TextInput value={monthlyIncome} onChange={setMonthlyIncome} placeholder="예: 300만원" />
              </Field>
              <div className="col-span-2">
                <Field label="화물 특이사항">
                  <textarea value={cargoNote} rows={3} onChange={e => setCargoNote(e.target.value)}
                    placeholder="온도 조건, 포장 방식, 특수 취급 등"
                    className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-slate-200 placeholder:text-slate-300" />
                </Field>
              </div>
            </div>
          </SectionCard>
        )}

        {/* 하단 저장 */}
        <div className="flex justify-end gap-3 pb-8">
          <Link href="/funnel"
            className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
            취소
          </Link>
          <button onClick={handleSubmit} disabled={saving}
            className="px-6 py-2.5 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition disabled:opacity-50 flex items-center gap-2">
            {saving
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />등록 중...</>
              : '등록하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
