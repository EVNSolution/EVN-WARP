'use client'

const CUR_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [
  '2016년 이전',
  ...Array.from({ length: CUR_YEAR - 2016 + 1 }, (_, i) => String(2016 + i)),
]

const MAKERS: { maker: string; model: string }[] = [
  { maker: '현대',         model: '포터'    },
  { maker: '기아',         model: '봉고'    },
  { maker: 'EVKMC',        model: '마사다'  },
  { maker: '이브이앤솔루션', model: '스테고Z' },
]

export interface VehicleData {
  vehicleMaker: string
  vehicleName:  string
  vehicleYear:  string
  totalMileage: string   // 콤마 포함 문자열 "150,000"
  truckType1:   string   // 탑/벤
  truckType2:   string   // 경유/가스/전기
  truckType3:   string   // 건탑/냉동/냉장
  truckType4:   string   // 저상/표준/하이탑
}

interface Props {
  data: VehicleData
  onChange: (next: VehicleData) => void
}

function buildSummary(d: VehicleData) {
  const parts = [
    d.vehicleMaker,
    d.vehicleName,
    d.vehicleYear
      ? (d.vehicleYear.includes('이전') ? d.vehicleYear : `${d.vehicleYear}년`)
      : '',
    d.truckType1,
    d.truckType2,
    d.truckType3,
    d.truckType4,
  ].filter(Boolean)
  return parts.join(' ')
}

function ToggleChips({ options, value, onChange, colors }: {
  options: string[]
  value: string
  onChange: (v: string) => void
  colors?: Record<string, string>
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(o => {
        const active = value === o
        return (
          <button key={o} type="button"
            onClick={() => onChange(value === o ? '' : o)}
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

function FieldLabel({ text }: { text: string }) {
  return (
    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{text}</p>
  )
}

function TextBox({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white" />
  )
}

export default function VehicleForm({ data, onChange }: Props) {
  const set = (patch: Partial<VehicleData>) => onChange({ ...data, ...patch })

  return (
    <div className="flex flex-col gap-4">

      {/* 제작사 + 차량명 (연동 선택) */}
      <>
          <div>
            <FieldLabel text="제작사 · 차량명" />
            <div className="flex gap-2 flex-wrap">
              {MAKERS.map(({ maker, model }) => {
                const active = data.vehicleMaker === maker
                return (
                  <button key={maker} type="button"
                    onClick={() => set(
                      active
                        ? { vehicleMaker: '', vehicleName: '' }
                        : { vehicleMaker: maker, vehicleName: model }
                    )}
                    className={`flex flex-col items-center px-3 py-2 rounded-xl border transition-all
                      ${active
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                    <span className="text-xs font-bold leading-tight">{maker}</span>
                    <span className={`text-[10px] mt-0.5 ${active ? 'text-slate-300' : 'text-slate-400'}`}>{model}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 연식 */}
          <div>
            <FieldLabel text="연식" />
            <div className="flex gap-1.5 flex-wrap">
              {YEAR_OPTIONS.map(y => {
                const active = data.vehicleYear === y
                return (
                  <button key={y} type="button"
                    onClick={() => set({ vehicleYear: active ? '' : y })}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all
                      ${active
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {y}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 총 주행거리 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel text="총 주행거리 (km)" />
              <TextBox
                value={data.totalMileage}
                onChange={v => {
                  const n = v.replace(/[^0-9]/g, '')
                  set({ totalMileage: n ? Number(n).toLocaleString() : '' })
                }}
                placeholder="예: 150,000" />
            </div>
          </div>

          {/* 차종 분류 4단계 */}
          <div className="flex flex-col gap-3 pt-1 border-t border-slate-100">
            <FieldLabel text="차종 분류" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-slate-400 mb-1">구분1 · 형태</p>
                <ToggleChips options={['탑', '벤']} value={data.truckType1}
                  onChange={v => set({ truckType1: v })}
                  colors={{ '탑': '#1e293b', '벤': '#374151' }} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-1">구분2 · 연료</p>
                <ToggleChips options={['경유', '가스', '전기']} value={data.truckType2}
                  onChange={v => set({ truckType2: v })}
                  colors={{ '경유': '#374151', '가스': '#1d4ed8', '전기': '#16a34a' }} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-1">구분3 · 적재함</p>
                <ToggleChips options={['건탑', '냉동', '냉장']} value={data.truckType3}
                  onChange={v => set({ truckType3: v })}
                  colors={{ '건탑': '#f97316', '냉동': '#0ea5e9', '냉장': '#6366f1' }} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-1">구분4 · 높이</p>
                <ToggleChips options={['저상', '표준', '하이탑']} value={data.truckType4}
                  onChange={v => set({ truckType4: v })}
                  colors={{ '저상': '#7c3aed', '표준': '#0d9488', '하이탑': '#b45309' }} />
              </div>
            </div>
          </div>
        </>
    </div>
  )
}
