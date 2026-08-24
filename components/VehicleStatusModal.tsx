'use client'

import { useState, useEffect } from 'react'
import { MapPin, X } from 'lucide-react'

type VehicleStatus = {
  id: string
  name: string
  plateNo: string
  currentLocation: string
}

export default function VehicleStatusModal({ onClose }: { onClose: () => void }) {
  const [statuses, setStatuses] = useState<VehicleStatus[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    fetch('/api/vehicles/status')
      .then(r => r.json())
      .then(setStatuses)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 bg-lime-50 border-b border-lime-100">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-lime-700" />
            <h2 className="text-sm font-bold text-lime-800">차량현황</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/70 hover:bg-white transition-colors">
            <X size={14} className="text-slate-500" />
          </button>
        </div>

        {/* 목록 */}
        <div className="px-6 py-4 space-y-2 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <p className="text-xs text-slate-400 text-center py-8">불러오는 중...</p>
          ) : statuses.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">등록된 차량이 없습니다.</p>
          ) : (
            statuses.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.plateNo}</p>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold text-lime-700 bg-lime-100 px-2 py-1 rounded-full shrink-0">
                  <MapPin size={11} />
                  {s.currentLocation}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
