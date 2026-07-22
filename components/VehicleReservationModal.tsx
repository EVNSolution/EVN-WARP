'use client'

import { useState, useEffect } from 'react'
import { X, Car, Save } from 'lucide-react'

type Vehicle = { id: string; name: string; plateNo: string }

export type ResvFormData = {
  vehicleId: string
  purpose: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  pickupLocation: string
  returnLocation: string
  notes: string
  userName: string
}

interface Props {
  initialDate?: string
  onClose: () => void
  onSaved: () => void
}

const EMPTY: ResvFormData = {
  vehicleId: '', purpose: '', startDate: '', startTime: '09:00',
  endDate: '', endTime: '18:00', pickupLocation: '', returnLocation: '', notes: '', userName: '',
}

export default function VehicleReservationModal({ initialDate, onClose, onSaved }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [form, setForm] = useState<ResvFormData>({
    ...EMPTY,
    startDate: initialDate ?? '',
    endDate:   initialDate ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/vehicles').then(r => r.json()).then(setVehicles).catch(() => {})
  }, [])

  function set(k: keyof ResvFormData, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    if (error) setError(null)
  }

  async function handleSave() {
    if (!form.vehicleId) return setError('차량을 선택해주세요.')
    if (!form.purpose.trim()) return setError('사용 목적을 입력해주세요.')
    if (!form.startDate || !form.endDate) return setError('사용 시작·반납 일자를 입력해주세요.')

    const startAt = `${form.startDate}T${form.startTime}:00`
    const endAt   = `${form.endDate}T${form.endTime}:00`
    if (new Date(startAt) >= new Date(endAt)) return setError('반납 일시는 시작 일시 이후여야 합니다.')

    setSaving(true)
    try {
      const res = await fetch('/api/vehicle-reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId:      form.vehicleId,
          purpose:        form.purpose,
          startAt,
          endAt,
          pickupLocation: form.pickupLocation || null,
          returnLocation: form.returnLocation || null,
          notes:          form.notes         || null,
          userName:       form.userName      || undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? '저장 실패')
      }
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 bg-lime-50 border-b border-lime-100">
          <div className="flex items-center gap-2">
            <Car size={16} className="text-lime-700" />
            <h2 className="text-sm font-bold text-lime-800">차량 신청</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/70 hover:bg-white transition-colors">
            <X size={14} className="text-slate-500" />
          </button>
        </div>

        {/* 폼 */}
        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* 차량 선택 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">차량 <span className="text-red-500">*</span></label>
            <select
              value={form.vehicleId}
              onChange={e => set('vehicleId', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300">
              <option value="">차량 선택</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.plateNo})</option>
              ))}
            </select>
          </div>

          {/* 사용자 이름 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">신청자</label>
            <input type="text" placeholder="이름 입력 (비우면 로그인 계정 사용)"
              value={form.userName}
              onChange={e => set('userName', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
            />
          </div>

          {/* 사용 목적 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">사용 목적 <span className="text-red-500">*</span></label>
            <input type="text" placeholder="예: 고객사 방문, 자재 운반"
              value={form.purpose}
              onChange={e => set('purpose', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
            />
          </div>

          {/* 출발 일시 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">사용 시작일 <span className="text-red-500">*</span></label>
              <input type="date"
                value={form.startDate}
                onChange={e => {
                  set('startDate', e.target.value)
                  if (!form.endDate || e.target.value > form.endDate) set('endDate', e.target.value)
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">시작 시간</label>
              <input type="time"
                value={form.startTime}
                onChange={e => set('startTime', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
              />
            </div>
          </div>

          {/* 반납 일시 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">반납 일자 <span className="text-red-500">*</span></label>
              <input type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={e => set('endDate', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">반납 시간</label>
              <input type="time"
                value={form.endTime}
                onChange={e => set('endTime', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
              />
            </div>
          </div>

          {/* 픽업/반납 장소 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">픽업 장소</label>
              <input type="text" placeholder="예: 본사 주차장"
                value={form.pickupLocation}
                onChange={e => set('pickupLocation', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">반납 장소</label>
              <input type="text" placeholder="예: 본사 주차장"
                value={form.returnLocation}
                onChange={e => set('returnLocation', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
              />
            </div>
          </div>

          {/* 비고 */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">비고</label>
            <textarea rows={2} placeholder="특이사항 등"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-2 justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <button onClick={onClose}
            className="px-4 py-1.5 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-white transition-colors">
            취소
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-white bg-lime-600 hover:bg-lime-700 rounded-lg transition-colors disabled:opacity-60">
            <Save size={13} />
            {saving ? '신청 중…' : '신청하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
