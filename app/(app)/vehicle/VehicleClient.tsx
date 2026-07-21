'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronLeft, ChevronRight, Car, X, Save } from 'lucide-react'

export type VehicleRow = {
  id: string; name: string; plateNo: string
  department: string | null; manager: string | null
  cardNo: string | null; hasCharge: boolean; hasHipass: boolean
}
export type LogRow = {
  id: string; vehicleId: string; date: string
  driverName: string; department: string | null
  departure: string; destination: string; purpose: string
  odometerBefore: number; odometerAfter: number; distance: number
  isBusinessUse: boolean; notes: string | null
}

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'
const PERIOD_LABELS: Record<Period, string> = { daily: '일간', weekly: '주간', monthly: '월간', yearly: '연간' }

function getISOWeek(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return { year: date.getUTCFullYear(), week: Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7) }
}

function periodRange(period: Period, anchor: string): { from: string; to: string; label: string } {
  if (period === 'daily') {
    return { from: anchor, to: anchor, label: anchor }
  }
  if (period === 'weekly') {
    const d    = new Date(anchor)
    const dow  = d.getUTCDay() || 7
    const mon  = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow + 1))
    const sun  = new Date(Date.UTC(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate() + 6))
    const from = mon.toISOString().slice(0, 10)
    const to   = sun.toISOString().slice(0, 10)
    const { year, week } = getISOWeek(mon)
    return { from, to, label: `${year}년 ${week}주차` }
  }
  if (period === 'monthly') {
    const [y, m] = anchor.slice(0, 7).split('-').map(Number)
    const from   = `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-01`
    const last   = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const to     = `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(last).padStart(2,'0')}`
    return { from, to, label: `${y}년 ${m}월` }
  }
  // yearly
  const y    = Number(anchor.slice(0, 4))
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}년` }
}

function shiftAnchor(period: Period, anchor: string, dir: -1 | 1): string {
  if (period === 'daily') {
    const d = new Date(anchor)
    d.setUTCDate(d.getUTCDate() + dir)
    return d.toISOString().slice(0, 10)
  }
  if (period === 'weekly') {
    const d = new Date(anchor)
    d.setUTCDate(d.getUTCDate() + dir * 7)
    return d.toISOString().slice(0, 10)
  }
  if (period === 'monthly') {
    const [y, m] = anchor.slice(0, 7).split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1 + dir, 1))
    return d.toISOString().slice(0, 10)
  }
  // yearly
  const y = Number(anchor.slice(0, 4)) + dir
  return `${y}-01-01`
}

interface ModalState {
  date: string; vehicleId: string; driverName: string; department: string
  departure: string; destination: string; purpose: string
  odometerBefore: string; odometerAfter: string
  isBusinessUse: boolean; notes: string
}

const EMPTY_MODAL = (vehicleId: string, date: string, driverName: string): ModalState => ({
  date, vehicleId, driverName, department: '',
  departure: '', destination: '', purpose: '',
  odometerBefore: '', odometerAfter: '',
  isBusinessUse: true, notes: '',
})

interface Props { vehicles: VehicleRow[]; myName: string }

export default function VehicleClient({ vehicles, myName }: Props) {
  const today   = new Date().toISOString().slice(0, 10)
  const [period,    setPeriod]    = useState<Period>('monthly')
  const [anchor,    setAnchor]    = useState(today)
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '')
  const [logs,      setLogs]      = useState<LogRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [modal,     setModal]     = useState<ModalState | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  // 차량 등록 모달
  const [addVehicle, setAddVehicle] = useState(false)
  const [vName, setVName]           = useState('')
  const [vPlate, setVPlate]         = useState('')
  const [vDept, setVDept]           = useState('')
  const [vMgr, setVMgr]             = useState('')
  const [vCard, setVCard]           = useState('')
  const [vCharge, setVCharge]       = useState(false)
  const [vHipass, setVHipass]       = useState(false)
  const [vSaving, setVSaving]       = useState(false)

  const { from, to, label } = periodRange(period, anchor)

  const fetchLogs = useCallback(async () => {
    if (!vehicleId) return
    setLoading(true)
    const res  = await fetch(`/api/vehicle-logs?vehicleId=${vehicleId}&from=${from}&to=${to}`)
    const data = await res.json()
    setLogs(data)
    setLoading(false)
  }, [vehicleId, from, to])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const vehicle = vehicles.find(v => v.id === vehicleId)

  // 요약 통계
  const totalDist    = logs.reduce((s, l) => s + l.distance, 0)
  const bizDist      = logs.filter(l => l.isBusinessUse).reduce((s, l) => s + l.distance, 0)
  const firstOdom    = logs.length > 0 ? logs[0].odometerBefore : null
  const lastOdom     = logs.length > 0 ? logs[logs.length - 1].odometerAfter : null

  async function handleSave() {
    if (!modal) return
    setError('')
    if (!modal.departure.trim() || !modal.destination.trim() || !modal.purpose.trim()) {
      setError('출발지, 도착지, 운행목적은 필수입니다.'); return
    }
    const before = Number(modal.odometerBefore)
    const after  = Number(modal.odometerAfter)
    if (!before || !after || after < before) {
      setError('주행거리를 올바르게 입력해주세요.'); return
    }
    setSaving(true)
    const res = await fetch('/api/vehicle-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleId:      modal.vehicleId,
        date:           modal.date,
        driverName:     modal.driverName || myName,
        department:     modal.department || null,
        departure:      modal.departure,
        destination:    modal.destination,
        purpose:        modal.purpose,
        odometerBefore: before,
        odometerAfter:  after,
        isBusinessUse:  modal.isBusinessUse,
        notes:          modal.notes || null,
      }),
    })
    setSaving(false)
    if (!res.ok) { setError((await res.json()).error ?? '저장 실패'); return }
    setModal(null)
    fetchLogs()
  }

  async function handleAddVehicle() {
    if (!vName.trim() || !vPlate.trim()) return
    setVSaving(true)
    const res = await fetch('/api/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: vName, plateNo: vPlate, department: vDept||null, manager: vMgr||null, cardNo: vCard||null, hasCharge: vCharge, hasHipass: vHipass }),
    })
    setVSaving(false)
    if (res.ok) {
      const v = await res.json()
      setVehicleId(v.id)
      setAddVehicle(false)
      setVName(''); setVPlate(''); setVDept(''); setVMgr(''); setVCard('')
      setVCharge(false); setVHipass(false)
      window.location.reload()
    }
  }

  return (
    <div className="p-6" style={{ maxWidth: '1440px' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 mb-4 rounded-xl" style={{ backgroundColor: '#111111' }}>
        <div>
          <h1 className="text-xl font-bold text-white">차량관리</h1>
          <p className="text-xs mt-0.5" style={{ color: '#C5D42A' }}>법인차량 운행일지</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setAddVehicle(true)}
            className="flex items-center gap-1.5 text-white border border-white/20 px-3 py-1.5 rounded-lg text-sm hover:bg-white/10 transition-colors">
            <Car size={13} /> 차량 등록
          </button>
          <button
            onClick={() => setModal(EMPTY_MODAL(vehicleId, today, myName))}
            className="flex items-center gap-1.5 text-white border border-white/20 px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
            <Plus size={14} /> 운행 기록
          </button>
        </div>
      </div>

      {/* 차량 선택 */}
      {vehicles.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {vehicles.map(v => (
            <button key={v.id} onClick={() => setVehicleId(v.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors border ${
                v.id === vehicleId
                  ? 'border-transparent text-[#111] font-black'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              style={v.id === vehicleId ? { backgroundColor: '#C5D42A' } : {}}>
              {v.name} ({v.plateNo})
            </button>
          ))}
        </div>
      )}

      {vehicles.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <Car size={32} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">등록된 차량이 없습니다.</p>
          <button onClick={() => setAddVehicle(true)}
            className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
            차량 등록하기
          </button>
        </div>
      )}

      {vehicles.length > 0 && (
        <>
          {/* 차량 정보 카드 */}
          {vehicle && (
            <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 mb-4 flex items-center gap-6 text-xs text-slate-500">
              <div className="flex items-center gap-1.5"><Car size={13} className="text-slate-400" /><span className="font-semibold text-slate-700">{vehicle.name}</span><span className="text-slate-400">({vehicle.plateNo})</span></div>
              {vehicle.department && <span>관리부서: <strong className="text-slate-700">{vehicle.department}</strong></span>}
              {vehicle.manager    && <span>담당자: <strong className="text-slate-700">{vehicle.manager}</strong></span>}
              {vehicle.cardNo     && <span>법인카드: <strong className="text-slate-700">{vehicle.cardNo}</strong></span>}
              {vehicle.hasCharge  && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-semibold">충전카드</span>}
              {vehicle.hasHipass  && <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full font-semibold">하이패스</span>}
            </div>
          )}

          {/* 기간 탭 + 날짜 네비게이션 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-0 border-b border-slate-200">
              {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                <button key={p} onClick={() => { setPeriod(p); setAnchor(today) }}
                  className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                    period === p ? 'border-[#C5D42A] text-[#7a9200]' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setAnchor(a => shiftAnchor(period, a, -1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50">
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center">{label}</span>
              <button onClick={() => setAnchor(a => shiftAnchor(period, a, 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* 운행일지 테이블 */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-4">
            {loading ? (
              <div className="py-10 text-center text-sm text-slate-400">불러오는 중...</div>
            ) : logs.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                {label} 운행 기록이 없습니다.
                <button onClick={() => setModal(EMPTY_MODAL(vehicleId, today, myName))}
                  className="block mx-auto mt-3 px-4 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors">
                  + 운행 기록 추가
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['운행일자','운전자','소속','출발지','도착지','운행목적','운행 전(km)','운행 후(km)','운행거리(km)','업무용','비고'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{log.date}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{log.driverName}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{log.department ?? '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{log.departure}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{log.destination}</td>
                        <td className="px-3 py-2.5 text-slate-700 max-w-[200px] truncate">{log.purpose}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap text-slate-600 font-mono">{log.odometerBefore.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap text-slate-600 font-mono">{log.odometerAfter.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap font-bold text-indigo-600 font-mono">{log.distance.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${log.isBusinessUse ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                            {log.isBusinessUse ? '업무용' : '개인'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 max-w-[120px] truncate">{log.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold">
                      <td colSpan={6} className="px-3 py-2.5 text-slate-600">합계 ({logs.length}건)</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 font-mono">
                        {firstOdom !== null ? firstOdom.toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 font-mono">
                        {lastOdom !== null ? lastOdom.toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-indigo-700 font-bold font-mono">{totalDist.toLocaleString()}</td>
                      <td colSpan={2} className="px-3 py-2.5 text-slate-500 text-xs">
                        업무용 {bizDist.toLocaleString()}km
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: period === 'monthly' ? '월초 주행거리' : '시작 주행거리', value: firstOdom !== null ? `${firstOdom.toLocaleString()} km` : '—' },
              { label: period === 'monthly' ? '월말 주행거리' : '종료 주행거리', value: lastOdom !== null ? `${lastOdom.toLocaleString()} km` : '—' },
              { label: '총 운행거리',   value: `${totalDist.toLocaleString()} km` },
              { label: '업무용 거리',   value: `${bizDist.toLocaleString()} km` },
            ].map(({ label: l, value: v }) => (
              <div key={l} className="bg-white border border-slate-200 rounded-xl px-5 py-4">
                <p className="text-xs text-slate-400 mb-1">{l}</p>
                <p className="text-lg font-bold text-slate-800">{v}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── 운행기록 입력 모달 ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">운행 기록 추가</h2>
              <button onClick={() => setModal(null)}><X size={16} className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* 차량 선택 */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">차량</label>
                <select value={modal.vehicleId} onChange={e => setModal(m => m && ({ ...m, vehicleId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNo})</option>)}
                </select>
              </div>
              {/* 날짜 + 운전자 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">운행일자</label>
                  <input type="date" value={modal.date} onChange={e => setModal(m => m && ({ ...m, date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">운전자</label>
                  <input type="text" value={modal.driverName} onChange={e => setModal(m => m && ({ ...m, driverName: e.target.value }))}
                    placeholder={myName}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              {/* 소속 */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">소속</label>
                <input type="text" value={modal.department} onChange={e => setModal(m => m && ({ ...m, department: e.target.value }))}
                  placeholder="부서/팀명"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              {/* 출발지 / 도착지 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">출발지 *</label>
                  <input type="text" value={modal.departure} onChange={e => setModal(m => m && ({ ...m, departure: e.target.value }))}
                    placeholder="예: 동작"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">도착지 *</label>
                  <input type="text" value={modal.destination} onChange={e => setModal(m => m && ({ ...m, destination: e.target.value }))}
                    placeholder="예: 고객사 A"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              {/* 운행목적 */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">운행목적 *</label>
                <input type="text" value={modal.purpose} onChange={e => setModal(m => m && ({ ...m, purpose: e.target.value }))}
                  placeholder="예: 고객사 미팅 및 제품 납품"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              {/* 주행거리 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">운행 전 주행거리 (km) *</label>
                  <input type="number" value={modal.odometerBefore} onChange={e => setModal(m => m && ({ ...m, odometerBefore: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">운행 후 주행거리 (km) *</label>
                  <input type="number" value={modal.odometerAfter} onChange={e => setModal(m => m && ({ ...m, odometerAfter: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              {/* 운행거리 자동계산 */}
              {modal.odometerBefore && modal.odometerAfter && Number(modal.odometerAfter) >= Number(modal.odometerBefore) && (
                <div className="bg-indigo-50 rounded-lg px-4 py-2 text-center">
                  <span className="text-xs text-slate-500">운행거리: </span>
                  <span className="text-sm font-bold text-indigo-600">{(Number(modal.odometerAfter) - Number(modal.odometerBefore)).toLocaleString()} km</span>
                </div>
              )}
              {/* 업무용 여부 */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-slate-500">업무용 여부</label>
                <div className="flex gap-2">
                  {[true, false].map(v => (
                    <button key={String(v)} type="button"
                      onClick={() => setModal(m => m && ({ ...m, isBusinessUse: v }))}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        modal.isBusinessUse === v
                          ? v ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-500 text-white border-slate-500'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}>
                      {v ? '업무용' : '개인용'}
                    </button>
                  ))}
                </div>
              </div>
              {/* 비고 */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">비고</label>
                <input type="text" value={modal.notes} onChange={e => setModal(m => m && ({ ...m, notes: e.target.value }))}
                  placeholder="특이사항"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModal(null)}
                className="px-4 py-1.5 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">취소</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-60">
                <Save size={13} />{saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 차량 등록 모달 ── */}
      {addVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setAddVehicle(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">차량 등록</h2>
              <button onClick={() => setAddVehicle(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">차량명 *</label>
                  <input value={vName} onChange={e => setVName(e.target.value)} placeholder="니로, 아이오닉5 등"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">차량번호 *</label>
                  <input value={vPlate} onChange={e => setVPlate(e.target.value)} placeholder="예: 4055"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">관리부서</label>
                  <input value={vDept} onChange={e => setVDept(e.target.value)} placeholder="경영관리팀 등"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">관리담당자</label>
                  <input value={vMgr} onChange={e => setVMgr(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">법인카드번호</label>
                <input value={vCard} onChange={e => setVCard(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="flex gap-4">
                {[{ key: 'charge', label: '충전카드', v: vCharge, set: setVCharge }, { key: 'hipass', label: '하이패스', v: vHipass, set: setVHipass }].map(({ key, label: lb, v, set }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={v} onChange={e => set(e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-sm text-slate-600">{lb}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setAddVehicle(false)}
                className="px-4 py-1.5 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">취소</button>
              <button onClick={handleAddVehicle} disabled={vSaving || !vName || !vPlate}
                className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-60">
                {vSaving ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
