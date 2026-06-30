import { prisma } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit, CheckCircle2, Plus, CornerDownRight, ChevronRight, Download, PauseCircle } from 'lucide-react'
import SuspendTaskButton from '@/components/SuspendTaskButton'

const STATUS_STYLE: Record<string, string> = {
  '진행중': 'bg-blue-100 text-blue-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-gray-100 text-gray-500',
  '지연':   'bg-red-100 text-red-600',
}
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const GANTT_COLORS = [
  'bg-indigo-500','bg-orange-500','bg-teal-500',
  'bg-violet-500','bg-green-500','bg-rose-500',
]


function dDay(endDate: Date) {
  const diff = Math.ceil((endDate.getTime() - Date.now()) / 86400000)
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, cls: 'text-red-500' }
  if (diff === 0) return { label: 'D-day', cls: 'text-orange-500' }
  return { label: `D-${diff}`, cls: 'text-slate-500' }
}

function GanttSection({ taskStart, taskEnd, countermeasures }: {
  taskStart: Date; taskEnd: Date; countermeasures: any[]
}) {
  const total = taskEnd.getTime() - taskStart.getTime()
  if (total <= 0) return null

  const totalDays = total / 86400000
  const cols: { label: string; pct: number }[] = []

  if (totalDays <= 120) {
    // 주 단위 컬럼: taskStart 이후 첫 번째 월요일부터
    let cur = new Date(taskStart)
    const dow = cur.getDay()
    if (dow !== 1) cur.setDate(cur.getDate() + (dow === 0 ? 1 : 8 - dow))
    while (cur.getTime() < taskEnd.getTime()) {
      const pct = (cur.getTime() - taskStart.getTime()) / total * 100
      if (pct >= 0 && pct < 100) cols.push({ label: `${cur.getMonth()+1}/${cur.getDate()}`, pct })
      cur = new Date(cur); cur.setDate(cur.getDate() + 7)
    }
  } else {
    // 월 단위 컬럼
    let cur = new Date(taskStart.getFullYear(), taskStart.getMonth() + 1, 1)
    while (cur.getTime() < taskEnd.getTime()) {
      const pct = (cur.getTime() - taskStart.getTime()) / total * 100
      if (pct < 100) cols.push({ label: `${cur.getMonth()+1}월`, pct })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
  }

  return (
    <div>
      {/* 시간 컬럼 헤더 */}
      <div className="flex items-end gap-3 mb-1 px-4">
        <span className="w-6 shrink-0" />
        <div className="w-[22%] shrink-0" />
        <div className="flex-1 relative h-5 border-b border-slate-200">
          {cols.map((col, i) => (
            <span key={i}
              className="absolute text-[10px] text-slate-400 -translate-x-1/2 bottom-1 whitespace-nowrap"
              style={{ left: `${col.pct}%` }}>
              {col.label}
            </span>
          ))}
        </div>
      </div>
      {/* 실행안 행 */}
      {countermeasures.map((c: any, i: number) => {
        const color = GANTT_COLORS[i % GANTT_COLORS.length]
        let barLeft = 0, barWidth = 0, hasBar = false
        if (c.startDate && c.endDate) {
          const ms = new Date(c.startDate).getTime()
          const me = new Date(c.endDate).getTime()
          barLeft  = Math.max(0, (ms - taskStart.getTime()) / total * 100)
          barWidth = Math.min(100 - barLeft, (me - ms) / total * 100)
          hasBar   = true
        }
        return (
          <div key={c.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-2.5 mb-1.5">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${color}`}>
              {c.index}
            </span>
            <p className="w-[22%] shrink-0 text-sm font-medium text-slate-800 leading-snug line-clamp-2">
              {c.description}
            </p>
            <div className="flex-1 min-w-0">
              <div className="relative h-5 bg-slate-100 rounded overflow-hidden">
                {cols.map((col, j) => (
                  <div key={j} className="absolute top-0 bottom-0 w-px bg-white/60"
                    style={{ left: `${col.pct}%` }} />
                ))}
                {hasBar && (
                  <div className={`absolute h-5 rounded ${color}`}
                    style={{ left: `${barLeft}%`, width: `${Math.max(barWidth, 3)}%` }} />
                )}
              </div>
              {hasBar && (
                <p className="text-[10px] text-slate-400 text-right mt-0.5">
                  {c.startDate.slice(5).replace('-', '/')} ~ {c.endDate.slice(5).replace('-', '/')}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default async function A3DetailPage(props: PageProps<'/a3/[id]'>) {
  const { id } = await props.params
  const task = await prisma.strategyTask.findUnique({
    where: { id },
    include: {
      team: true,
      parent: { include: { team: true } },
      subTasks: {
        include: { team: true },
        orderBy: { subSeq: 'asc' },
      },
      kpiItems: { orderBy: { index: 'asc' } },
      monthlyTargets: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
      countermeasures: { orderBy: { index: 'asc' } },
    },
  })
  if (!task) notFound()

  const dd = dDay(new Date(task.endDate))
  const statusCls  = STATUS_STYLE[task.status] ?? 'bg-gray-100 text-gray-500'
  const strategyLabel = task.strategy === 'A' ? '확장과 성장' : 'AI 기반 조직운영'
  const isSubTask  = !!task.parentId

  return (
    <div className="p-8">
      {/* 상단 내비게이션 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/a3" className="text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          {task.parent && (
            <>
              <Link href={`/a3/${task.parent.id}`}
                className="text-sm text-slate-400 hover:text-indigo-600 font-mono transition-colors">
                {task.parent.code}
              </Link>
              <ChevronRight size={14} className="text-slate-300" />
            </>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-slate-500 font-semibold">{task.code}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCls}`}>{task.status}</span>
            <span className={`text-xs font-medium ${dd.cls}`}>{dd.label}</span>
            {task.confirmed && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 size={12} /> 위원회 확정
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/a3/${task.id}/export`}
            className="flex items-center gap-2 text-sm text-indigo-600 border border-indigo-200 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors font-medium">
            <Download size={14} /> 과제정의서 PPT
          </a>
          {!task.suspended && (
            <Link href={`/a3/${task.id}/edit`}
              className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
              <Edit size={14} /> 수정
            </Link>
          )}
          <SuspendTaskButton
            taskId={task.id}
            suspended={task.suspended}
            suspendedAt={task.suspendedAt?.toISOString()}
            suspendReason={task.suspendReason}
          />
        </div>
      </div>

      {/* 중단 배너 */}
      {task.suspended && (
        <div className="mb-5 bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <PauseCircle size={18} className="text-orange-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-orange-800 mb-0.5">이 과제는 중단되었습니다</p>
            {task.suspendReason && <p className="text-sm text-orange-700 leading-relaxed">{task.suspendReason}</p>}
            {task.suspendedAt && (
              <p className="text-xs text-orange-400 mt-1">
                중단일: {new Date(task.suspendedAt).toLocaleDateString('ko-KR')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 과제 제목 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${task.strategy === 'A' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
            전략과제 {task.strategy} · {strategyLabel}
          </span>
          {isSubTask && (
            <span className="text-xs text-indigo-500 flex items-center gap-1">
              <CornerDownRight size={11} /> 하부 과제
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{task.title}</h1>
      </div>

      {/* 기본 정보 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-slate-400">담당 팀</span>
          <p className="font-semibold text-slate-800 mt-0.5">{task.team.name}</p>
        </div>
        <div>
          <span className="text-slate-400">과제 오너</span>
          <p className="font-semibold text-slate-800 mt-0.5">{task.owner}</p>
        </div>
        <div className="col-span-2">
          <span className="text-slate-400">기간</span>
          <p className="font-semibold text-slate-800 mt-0.5">
            {new Date(task.startDate).toLocaleDateString('ko-KR')} ~ {new Date(task.endDate).toLocaleDateString('ko-KR')}
          </p>
        </div>
      </div>

      {/* KPI */}
      {task.kpiItems.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
          <h2 className="text-base font-semibold text-slate-800 mb-3">KPI</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {task.kpiItems.map((kpi: any) => (
              <div key={kpi.id}
                className={`rounded-lg px-4 py-3 border ${kpi.type === '정량' ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${kpi.type === '정량' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                    {kpi.type}
                  </span>
                  {kpi.subType && <span className="text-xs text-slate-400">{kpi.subType}</span>}
                </div>
                <p className="text-xs text-slate-500 mb-0.5">{kpi.label}</p>
                <p className={`text-lg font-bold ${kpi.type === '정량' ? 'text-indigo-700' : 'text-amber-700'}`}>
                  {kpi.targetNum != null ? kpi.targetNum.toLocaleString('ko-KR') : kpi.target}{kpi.unit ? ` ${kpi.unit}` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 하부 과제 목록 (최상위 과제만) */}
      {!isSubTask && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">
              하부 과제
              {task.subTasks.length > 0 && (
                <span className="ml-2 text-sm font-normal text-slate-400">{task.subTasks.length}건</span>
              )}
            </h2>
            <Link href={`/a3/new?parentId=${task.id}`}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              <Plus size={14} /> 하부 과제 추가
            </Link>
          </div>
          {task.subTasks.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">등록된 하부 과제가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {task.subTasks.map((sub: any) => {
                const subDd = dDay(new Date(sub.endDate))
                const subStatusCls = STATUS_STYLE[sub.status] ?? 'bg-gray-100 text-gray-500'
                return (
                  <Link key={sub.id} href={`/a3/${sub.id}`}
                    className="flex items-center gap-3 border border-slate-100 rounded-lg px-4 py-2.5 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                    <CornerDownRight size={13} className="text-indigo-300 shrink-0" />
                    <span className="text-xs font-mono text-slate-400 w-40 shrink-0">{sub.code}</span>
                    <span className="flex-1 text-sm font-medium text-slate-800 truncate">{sub.title}</span>
                    <span className="text-xs text-slate-400 shrink-0">오너 {sub.owner}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${subStatusCls}`}>{sub.status}</span>
                    <span className={`text-xs shrink-0 ${subDd.cls}`}>{subDd.label}</span>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400 shrink-0" />
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* 1. 문제와 목표 */}
      {(task.problemStatement || task.goalStatement) && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">1. 문제와 목표</h2>
          {task.problemStatement && (
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">문제 (정량)</p>
              <ul className="space-y-1">
                {task.problemStatement.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-slate-500 shrink-0" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {task.goalStatement && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">달성 목표 (정량)</p>
              <ul className="space-y-1">
                {task.goalStatement.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* 2. 대책과 실행안 (간트) */}
      {task.countermeasures.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">2. 대책과 실행안</h2>
          <GanttSection
            taskStart={new Date(task.startDate)}
            taskEnd={new Date(task.endDate)}
            countermeasures={task.countermeasures}
          />
        </section>
      )}

      {/* 3. 월별 목표 및 리소스 — 실제 데이터가 있을 때만 표시 */}
      {task.monthlyTargets.some((m: any) => m.revenueTarget != null || m.budget != null || m.personnel != null) && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">3. 월별 목표 및 리소스</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="text-left py-2 pr-2 font-medium w-16 sticky left-0 bg-white">구분</th>
                  {task.monthlyTargets.map((m: any, i: number) => (
                    <th key={i} className="text-center py-2 px-1.5 font-medium min-w-[52px]">{MONTHS[m.month - 1]}</th>
                  ))}
                  <th className="text-center py-2 px-2 font-medium text-slate-400 min-w-[60px]">합계</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-2 text-slate-500 sticky left-0 bg-white whitespace-nowrap">매출 (만원)</td>
                  {task.monthlyTargets.map((m: any, i: number) => (
                    <td key={i} className="text-center py-2 px-1.5 font-medium text-slate-700">
                      {m.revenueTarget != null ? m.revenueTarget.toLocaleString() : '—'}
                    </td>
                  ))}
                  <td className="text-center py-2 px-2 font-semibold text-indigo-600">
                    {task.monthlyTargets.reduce((s: number, m: any) => s + (m.revenueTarget ?? 0), 0).toLocaleString()}
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-2 text-slate-500 sticky left-0 bg-white whitespace-nowrap">예산 (만원)</td>
                  {task.monthlyTargets.map((m: any, i: number) => (
                    <td key={i} className="text-center py-2 px-1.5 font-medium text-slate-700">
                      {m.budget != null ? m.budget.toLocaleString() : '—'}
                    </td>
                  ))}
                  <td className="text-center py-2 px-2 font-semibold text-orange-600">
                    {task.monthlyTargets.reduce((s: number, m: any) => s + (m.budget ?? 0), 0).toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-2 text-slate-500 sticky left-0 bg-white whitespace-nowrap">인력 (명)</td>
                  {task.monthlyTargets.map((m: any, i: number) => (
                    <td key={i} className="text-center py-2 px-1.5 font-medium text-slate-700">
                      {m.personnel != null ? m.personnel : '—'}
                    </td>
                  ))}
                  <td className="text-center py-2 px-2 font-semibold text-teal-600">
                    Max {task.monthlyTargets.reduce((max: number, m: any) => Math.max(max, m.personnel ?? 0), 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
