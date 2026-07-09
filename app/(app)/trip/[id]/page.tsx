import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Plane, Edit2, ArrowLeft } from 'lucide-react'
import TripActions from './TripActions'
import TripExpenseEditor from '@/components/TripExpenseEditor'
import TripDayTable from '@/components/TripDayTable'

const statusStyle: Record<string, { bg: string; text: string; border: string }> = {
  '초안':   { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  '승인요청': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  '승인':   { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  '반려':   { bg: 'bg-red-100',   text: 'text-red-600',   border: 'border-red-200'   },
}

const Row = ({ label, value }: { label: string; value?: string | number | null }) =>
  value != null && value !== '' ? (
    <tr className="border-b border-slate-50">
      <td className="py-2.5 pr-4 text-xs font-semibold text-slate-400 w-28 whitespace-nowrap align-top pt-3">{label}</td>
      <td className="py-2.5 text-sm text-slate-800 whitespace-pre-wrap">{String(value)}</td>
    </tr>
  ) : null

const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
      <h2 className="text-sm font-bold text-slate-700">{title}</h2>
    </div>
    <div className="px-5 py-2">
      <table className="w-full">{children}</table>
    </div>
  </div>
)

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const currentUser = session?.user as any

  const [trip, users] = await Promise.all([
    prisma.tripReport.findUnique({ where: { id } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } }),
  ])
  if (!trip) notFound()

  const st = statusStyle[trip.status] ?? statusStyle['초안']
  const isAuthor = trip.userId === currentUser?.id

  // approversJson(신규) + approverId(구버전) 양쪽 모두 확인
  const approversArr: { userId: string }[] = (() => {
    try { return JSON.parse((trip as any).approversJson ?? '[]') } catch { return [] }
  })()
  const isApprover =
    trip.approverId === currentUser?.id ||
    approversArr.some(a => a.userId === currentUser?.id)

  const isPreApprover = (trip as any).preApproverId === currentUser?.id
  const isAdmin    = currentUser?.role === 'admin'
  const isOverseas = trip.type === '해외출장'

  // 현재 처리 차례인 결재자 계산 (동의 전원 완료 후 결재 차례)
  const consentors   = approversArr.filter((a: any) => (a.type ?? '결재') === '동의')
  const finalApprovers = approversArr.filter((a: any) => (a.type ?? '결재') === '결재')
  const allConsentDone = consentors.every((a: any) => a.status !== '대기')
  const activeApprover: any =
    consentors.find((a: any) => a.status === '대기') ??
    (allConsentDone ? finalApprovers.find((a: any) => a.status === '대기') : null) ??
    null
  const currentApproverType: '동의' | '결재' | null =
    activeApprover?.userId === currentUser?.id
      ? ((activeApprover.type ?? '결재') as '동의' | '결재')
      : null

  const budgetTotal = (trip.budgetTransport ?? 0) + (trip.budgetAccomm ?? 0) +
    (trip.budgetMeal ?? 0) + (trip.budgetOther ?? 0)
  const actualTotal = (trip.actualTransport ?? 0) + (trip.actualAccomm ?? 0) +
    (trip.actualMeal ?? 0) + (trip.actualOther ?? 0)

  return (
    <div style={{ backgroundColor: '#f8f9fa' }}>

      {/* 헤더 */}
      <div className="px-8 py-5 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Link href="/notes?tab=notes" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
              <ArrowLeft size={18} />
            </Link>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOverseas ? 'bg-indigo-100' : 'bg-orange-100'}`}>
              {isOverseas
                ? <Plane size={20} className="text-indigo-600" />
                : <MapPin size={20} className="text-orange-500" />
              }
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-slate-900">{trip.title}</h1>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${st.bg} ${st.text} ${st.border}`}>
                  {trip.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {trip.type} · {trip.userName} · {trip.startDate} ~ {trip.endDate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/trip/${trip.id}/print`} target="_blank"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-all">
              🖨 인쇄
            </Link>
            {(isAuthor || isAdmin) && (trip.status === '초안' || trip.status === '반려') && (
              <Link href={`/trip/${trip.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all">
                <Edit2 size={14} />
                수정
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 pb-12 space-y-5 max-w-5xl">

        {/* 사전품의 기록 배너 */}
        {(trip as any).preApprovalStatus && (
          <div className={`rounded-xl border px-5 py-4 ${
            (trip as any).preApprovalStatus === '승인'
              ? 'bg-blue-50 border-blue-200'
              : (trip as any).preApprovalStatus === '반려'
              ? 'bg-red-50 border-red-200'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <p className="text-xs font-bold mb-1 text-slate-600">사전품의 기록</p>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                (trip as any).preApprovalStatus === '승인'
                  ? 'bg-blue-100 text-blue-700'
                  : (trip as any).preApprovalStatus === '반려'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {(trip as any).preApprovalStatus === '승인' ? '사전승인 완료'
                  : (trip as any).preApprovalStatus === '반려' ? '사전품의 반려'
                  : '사전품의 검토 중'}
              </span>
              {(trip as any).preApprovalRequestedAt && (
                <span className="text-xs text-slate-500">
                  요청: {new Date((trip as any).preApprovalRequestedAt).toLocaleDateString('ko-KR')}
                </span>
              )}
              {(trip as any).preApprovedAt && (
                <span className="text-xs text-slate-500">
                  · 처리: {new Date((trip as any).preApprovedAt).toLocaleDateString('ko-KR')}
                </span>
              )}
            </div>
            {(trip as any).preApprovalComment && (
              <p className="text-sm mt-2 text-slate-700 whitespace-pre-wrap">
                {(trip as any).preApprovalComment}
              </p>
            )}
          </div>
        )}

        {/* 반려 의견 배너 */}
        {trip.status === '반려' && trip.approvalComment && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs font-bold text-red-500 mb-1">반려 사유</p>
            <p className="text-sm text-red-700 whitespace-pre-wrap">{trip.approvalComment}</p>
          </div>
        )}

        {/* 승인 완료 배너 */}
        {trip.status === '승인' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm">✓</div>
            <div>
              <p className="text-sm font-bold text-green-700">승인 완료</p>
              <p className="text-xs text-green-600">
                {trip.approverName}님이 승인하였습니다.
                {trip.approvedAt && ` (${new Date(trip.approvedAt).toLocaleDateString('ko-KR')})`}
                {trip.approvalComment && ` · ${trip.approvalComment}`}
              </p>
            </div>
          </div>
        )}

        {/* ① 기본 정보 */}
        <Sec title="① 기본 정보">
          <Row label="출장 구분" value={trip.type} />
          <Row label="출장자" value={(() => {
              try {
                const arr = JSON.parse((trip as any).travelersJson ?? '[]')
                if (arr.length > 0) return arr.map((t: any) => t.userName).join(', ')
              } catch {}
              return trip.userName
            })()} />
          <Row label="팀" value={trip.teamName} />
          <Row label="출장지" value={trip.destination} />
          <Row label="출장 기간" value={`${trip.startDate} ~ ${trip.endDate}`} />
          <Row label="교통편" value={trip.transport} />
          <Row label="숙박" value={trip.accommodation} />
        </Sec>

        {/* ② 방문 정보 */}
        <Sec title="② 방문 정보">
          <Row label="출장 목적" value={trip.purpose} />
          <Row label="방문처" value={trip.visitTarget} />
          <Row label="동행자" value={trip.companions} />
        </Sec>

        {/* ③ 일자별 일정 & 비용 명세 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-bold text-slate-700">③ 일자별 일정 및 비용 명세</h2>
            <p className="text-xs text-slate-400 mt-0.5">영수증을 비용 셀에 드래그하거나 📎를 클릭하면 금액이 자동 인식됩니다</p>
          </div>
          <div className="px-5 py-4">
            <TripDayTable
              tripId={trip.id}
              startDate={trip.startDate}
              endDate={trip.endDate}
              isOverseas={isOverseas}
            />
          </div>
        </div>

        {/* ④ 승인 정보 */}
        {(() => {
          const approvers: any[] = (() => {
            try { return JSON.parse((trip as any).approversJson ?? '[]') } catch { return [] }
          })()
          const statusStyle: Record<string, string> = {
            '대기': 'bg-slate-100 text-slate-500',
            '승인': 'bg-green-100 text-green-700',
            '반려': 'bg-red-100 text-red-600',
          }
          return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h2 className="text-sm font-bold text-slate-700">④ 승인 정보</h2>
              </div>
              <div className="px-5 py-3 space-y-2">
                {trip.submittedAt && (
                  <p className="text-xs text-slate-400">제출일: {new Date(trip.submittedAt).toLocaleDateString('ko-KR')}</p>
                )}
                {approvers.length > 0 ? (
                  <div className="space-y-2">
                    {approvers.map((a: any, i: number) => (
                      <div key={a.userId} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800">{a.userName}</span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusStyle[a.status] ?? statusStyle['대기']}`}>
                              {a.status}
                            </span>
                            {a.approvedAt && (
                              <span className="text-xs text-slate-400">{new Date(a.approvedAt).toLocaleDateString('ko-KR')}</span>
                            )}
                          </div>
                          {a.comment && <p className="text-xs text-slate-500 mt-0.5">{a.comment}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Row label="승인자" value={trip.approverName} />
                )}
                {trip.approvalComment && <Row label="최종 의견" value={trip.approvalComment} />}
              </div>
            </div>
          )
        })()}

        {/* 승인 / 제출 액션 (Client Component) */}
        <TripActions
          tripId={trip.id}
          status={trip.status}
          isAuthor={isAuthor || isAdmin}
          isApprover={isApprover}
          approverId={trip.approverId ?? ''}
          approversJson={(trip as any).approversJson ?? '[]'}
          preApprovalStatus={(trip as any).preApprovalStatus ?? null}
          preApproverId={(trip as any).preApproverId ?? null}
          isPreApprover={isPreApprover}
          users={users}
          currentApproverType={currentApproverType}
        />

      </div>
    </div>
  )
}
