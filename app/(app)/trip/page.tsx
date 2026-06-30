import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { Plus, MapPin, Plane, ChevronRight } from 'lucide-react'

const STATUS_LIST = ['전체', '초안', '승인요청', '승인', '반려'] as const

const statusStyle: Record<string, { bg: string; text: string }> = {
  '초안':   { bg: 'bg-slate-100', text: 'text-slate-500' },
  '승인요청': { bg: 'bg-amber-100', text: 'text-amber-700' },
  '승인':   { bg: 'bg-green-100', text: 'text-green-700' },
  '반려':   { bg: 'bg-red-100',   text: 'text-red-600'   },
}

export default async function TripListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await auth()
  const { status = '전체' } = await searchParams

  const where: any = {}
  if (status !== '전체') where.status = status

  const [trips, myPending] = await Promise.all([
    prisma.tripReport.findMany({ where, orderBy: { createdAt: 'desc' } }),
    // 내가 승인해야 할 건수
    prisma.tripReport.count({
      where: { approverId: (session?.user as any)?.id, status: '승인요청' },
    }),
  ])

  const userId = (session?.user as any)?.id as string

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8f9fa' }}>
      {/* 헤더 */}
      <div className="px-8 py-6 bg-white border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">출장보고서</h1>
          <p className="text-sm text-slate-400 mt-0.5">출장 계획 · 결과 보고 · 승인</p>
        </div>
        <div className="flex items-center gap-3">
          {myPending > 0 && (
            <Link href="/trip?status=승인요청"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all">
              승인 대기 <span className="bg-amber-400 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{myPending}</span>
            </Link>
          )}
          <Link href="/trip/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Plus size={16} />
            새 출장보고서
          </Link>
        </div>
      </div>

      {/* 상태 탭 */}
      <div className="px-8 pt-5 pb-0 flex items-center gap-1 border-b border-slate-200 bg-white">
        {STATUS_LIST.map(s => {
          const isActive = s === status
          const cnt = s === '전체' ? trips.length : trips.filter(t => t.status === s).length
          return (
            <Link key={s} href={`/trip?status=${s}`}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-all border-b-2 ${
                isActive
                  ? 'text-indigo-600 border-indigo-500 bg-indigo-50/50'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
              }`}>
              {s}
              {cnt > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                }`}>{cnt}</span>
              )}
            </Link>
          )
        })}
      </div>

      {/* 목록 */}
      <div className="px-8 py-6">
        {trips.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <MapPin size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">출장보고서가 없습니다.</p>
            <Link href="/trip/new" className="mt-4 inline-flex items-center gap-1 text-sm text-indigo-500 hover:underline">
              <Plus size={14} />첫 출장보고서 작성하기
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {trips.map(trip => {
              const st = statusStyle[trip.status] ?? statusStyle['초안']
              const isMyApproval = trip.approverId === userId && trip.status === '승인요청'
              return (
                <Link key={trip.id} href={`/trip/${trip.id}`}
                  className={`flex items-center gap-4 px-5 py-4 bg-white rounded-xl border transition-all hover:shadow-md hover:border-indigo-200 group ${
                    isMyApproval ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'
                  }`}>

                  {/* 아이콘 */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    trip.type === '해외출장' ? 'bg-indigo-100' : 'bg-orange-100'
                  }`}>
                    {trip.type === '해외출장'
                      ? <Plane size={16} className="text-indigo-600" />
                      : <MapPin size={16} className="text-orange-500" />
                    }
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-slate-900 truncate">{trip.title}</span>
                      {isMyApproval && (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-white">승인 필요</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{trip.userName}</span>
                      <span>·</span>
                      <span>{trip.destination}</span>
                      <span>·</span>
                      <span>{trip.startDate} ~ {trip.endDate}</span>
                      {trip.approverName && (
                        <>
                          <span>·</span>
                          <span>승인자: {trip.approverName}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 상태 뱃지 */}
                  <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>
                    {trip.status}
                  </span>

                  <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
