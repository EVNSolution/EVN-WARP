'use client'

import { useState, useEffect } from 'react'
import { Car, CheckCircle2, Loader2, XCircle } from 'lucide-react'

interface Vehicle { id: string; name: string; plateNo: string; department?: string | null }
interface Reservation {
  id: string; vehicleId: string; userName: string; status: string
  startAt: string; endAt: string; purpose: string
  vehicle: { name: string; plateNo: string }
}

const fmtDt = (v: string) => {
  const d = new Date(v)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
const toLocal = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function MobileVehiclePage() {
  const [vehicles, setVehicles]           = useState<Vehicle[]>([])
  const [myReservations, setMyReservations] = useState<Reservation[]>([])
  const [vehicleId, setVehicleId]         = useState('')
  const [purpose, setPurpose]             = useState('')
  const [startAt, setStartAt]             = useState(() => toLocal(new Date()))
  const [endAt, setEndAt]                 = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 2); return toLocal(d)
  })
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [vRes, rRes] = await Promise.all([
        fetch('/api/vehicles'),
        fetch('/api/vehicle-reservations'),
      ])
      const vs: Vehicle[] = await vRes.json()
      const rs: Reservation[] = await rRes.json()
      setVehicles(vs)
      // 현재 사용자의 예약만 필터링 (API는 모두 반환하므로 클라에서 필터)
      // userName은 서버에서 받아야 하나, 여기선 모두 보여주고 UI에서 구분
      setMyReservations(rs.filter(r => r.status !== '취소').slice(0, 10))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function submit() {
    if (!vehicleId || !purpose.trim() || !startAt || !endAt) {
      setError('차량, 목적, 시작·반납 일시를 모두 입력하세요.')
      return
    }
    if (new Date(endAt) <= new Date(startAt)) {
      setError('반납 일시는 출발 일시 이후여야 합니다.')
      return
    }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/vehicle-reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId, purpose: purpose.trim(), startAt, endAt }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? '저장 실패')
      setDone(true)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-5 space-y-6">
        <h1 className="text-lg font-bold text-gray-900">차량 신청</h1>

        {/* 신청 폼 */}
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 size={48} className="text-blue-500" />
            <p className="font-semibold text-gray-900">예약이 신청되었습니다</p>
            <button onClick={() => setDone(false)}
              className="px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold active:bg-blue-700">
              다시 신청
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">신규 신청</h2>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">차량 <span className="text-red-400">*</span></label>
              <select
                value={vehicleId}
                onChange={e => setVehicleId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400">
                <option value="">차량 선택</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.plateNo})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">사용 목적 <span className="text-red-400">*</span></label>
              <input
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="예: 고객 방문, 현장 출장"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">출발 일시</label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={e => setStartAt(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">반납 일시</label>
                <input
                  type="datetime-local"
                  value={endAt}
                  onChange={e => setEndAt(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">
                <XCircle size={16} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 active:bg-blue-700 disabled:opacity-60">
              {saving && <Loader2 size={16} className="animate-spin" />}
              신청하기
            </button>
          </div>
        )}

        {/* 예약 현황 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">최근 예약 현황</h2>
          {myReservations.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-6 text-center text-sm text-gray-400">
              예약 내역이 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {myReservations.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Car size={14} className="text-blue-500" />
                      <span className="font-semibold text-sm text-gray-900">{r.vehicle.name}</span>
                      <span className="text-xs text-gray-400">{r.vehicle.plateNo}</span>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                      ${r.status === '신청' ? 'bg-amber-100 text-amber-700'
                        : r.status === '승인' ? 'bg-emerald-100 text-emerald-700'
                        : r.status === '완료' ? 'bg-gray-100 text-gray-500'
                        : 'bg-red-100 text-red-600'}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{fmtDt(r.startAt)} → {fmtDt(r.endAt)}</div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">{r.userName} · {r.purpose}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
