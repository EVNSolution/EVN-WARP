import { prisma } from '@/lib/db'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Plus,
  Users, Building2, MapPin, Globe, Mail, Phone,
  FileText, BarChart2, BookOpen, Star, Briefcase, TrendingUp,
  UserPlus, Coffee, Link2, GraduationCap,
  Target, FileCheck, CalendarDays, Code2, PenTool,
  Package, Wrench, Settings, ClipboardCheck,
  PieChart, Landmark, Award,
  Building, Receipt, RefreshCw, Scale, Car, Palette,
} from 'lucide-react'
import CalendarView, { type CalActivity, type CalVehicleReservation } from '@/components/CalendarView'
import FilterSelects from './FilterSelects'
import PersonalScopeToggle from './PersonalScopeToggle'
import { auth } from '@/auth'

/* ── 상수 ── */
const TYPE_META: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
  // 현행 유형 (8개 카테고리)
  '내부회의':        { icon: <Users size={9} />,          bg: 'bg-blue-100',    text: 'text-blue-700' },
  '외부미팅':        { icon: <Building2 size={9} />,      bg: 'bg-purple-100',  text: 'text-purple-700' },
  '이메일':          { icon: <Mail size={9} />,           bg: 'bg-sky-100',     text: 'text-sky-700' },
  '전화·통화':       { icon: <Phone size={9} />,          bg: 'bg-cyan-100',    text: 'text-cyan-700' },
  '국내출장':        { icon: <MapPin size={9} />,         bg: 'bg-orange-100',  text: 'text-orange-700' },
  '해외출장':        { icon: <Globe size={9} />,          bg: 'bg-red-100',     text: 'text-red-700' },
  '발표/전시·행사':  { icon: <Star size={9} />,           bg: 'bg-rose-100',    text: 'text-rose-700' },
  '교육/연수':       { icon: <BookOpen size={9} />,       bg: 'bg-amber-100',   text: 'text-amber-700' },
  '세미나·컨퍼런스': { icon: <GraduationCap size={9} />, bg: 'bg-amber-100',   text: 'text-amber-800' },
  '문서·자료작성':   { icon: <FileText size={9} />,       bg: 'bg-slate-100',   text: 'text-slate-600' },
  '개발·구현':       { icon: <Code2 size={9} />,          bg: 'bg-slate-100',    text: 'text-slate-600' },
  '도면·설계':       { icon: <PenTool size={9} />,        bg: 'bg-slate-100',    text: 'text-slate-600' },
  '제품제작·조립':   { icon: <Package size={9} />,        bg: 'bg-slate-100',    text: 'text-slate-600' },
  '콘텐츠·디자인':   { icon: <Palette size={9} />,        bg: 'bg-slate-100',    text: 'text-slate-600' },
  'AS출동':          { icon: <Wrench size={9} />,         bg: 'bg-yellow-100',   text: 'text-yellow-700' },
  '설치·시운전':     { icon: <Settings size={9} />,       bg: 'bg-yellow-100',   text: 'text-yellow-700' },
  '정기점검':        { icon: <ClipboardCheck size={9} />, bg: 'bg-yellow-100',   text: 'text-yellow-700' },
  '고객미팅':        { icon: <Briefcase size={9} />,      bg: 'bg-violet-100',  text: 'text-violet-700' },
  '신규영업':        { icon: <Target size={9} />,         bg: 'bg-violet-100',  text: 'text-violet-700' },
  '제안/견적':       { icon: <FileCheck size={9} />,      bg: 'bg-violet-100',  text: 'text-violet-700' },
  '고객행사':        { icon: <CalendarDays size={9} />,   bg: 'bg-violet-100',  text: 'text-violet-700' },
  '인재영입':        { icon: <UserPlus size={9} />,       bg: 'bg-teal-100',    text: 'text-teal-700' },
  '외부 네트워킹':   { icon: <Coffee size={9} />,         bg: 'bg-green-100',   text: 'text-green-700' },
  '파트너십 타진':   { icon: <Link2 size={9} />,          bg: 'bg-emerald-100', text: 'text-emerald-700' },
  '견적서 발행':     { icon: <TrendingUp size={9} />,     bg: 'bg-teal-100',    text: 'text-teal-700' },
  'PO 발행':        { icon: <TrendingUp size={9} />,     bg: 'bg-teal-100',    text: 'text-teal-700' },
  '수주 확정':      { icon: <TrendingUp size={9} />,     bg: 'bg-teal-100',    text: 'text-teal-700' },
  '세금계산서 발행': { icon: <TrendingUp size={9} />,    bg: 'bg-teal-100',    text: 'text-teal-700' },
  '실적추가':        { icon: <TrendingUp size={9} />,     bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'IR 발표':         { icon: <PieChart size={9} />,      bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  '투자자 미팅':     { icon: <Landmark size={9} />,      bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  '투자행사':        { icon: <Award size={9} />,         bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  '대관·신청':       { icon: <Building size={9} />,      bg: 'bg-stone-100',   text: 'text-stone-700' },
  '세무·회계':       { icon: <Receipt size={9} />,       bg: 'bg-stone-100',   text: 'text-stone-700' },
  '신고·갱신':       { icon: <RefreshCw size={9} />,     bg: 'bg-stone-100',   text: 'text-stone-700' },
  '법무·계약':       { icon: <Scale size={9} />,          bg: 'bg-stone-100',   text: 'text-stone-700' },
  '경영기획':        { icon: <BarChart2 size={9} />,     bg: 'bg-stone-100',   text: 'text-stone-700' },
  // 레거시 (기존 데이터 호환)
  '외부회의':  { icon: <Building2 size={9} />, bg: 'bg-purple-100', text: 'text-purple-700' },
  '발표/보고': { icon: <BarChart2 size={9} />, bg: 'bg-teal-100',   text: 'text-teal-700' },
  '전시/행사': { icon: <Star size={9} />,      bg: 'bg-rose-100',   text: 'text-rose-700' },
  '사무업무':  { icon: <Briefcase size={9} />, bg: 'bg-slate-100',  text: 'text-slate-600' },
}
type WeekDay = { dateStr: string; day: number; inMonth: boolean; dow: number }
type SearchParams = { month?: string; tab?: string; user?: string; uid?: string; teamName?: string }

/* ── 출장보고 목록 ── */
const TRIP_STATUS: Record<string, { bg: string; text: string }> = {
  '초안':   { bg: 'bg-slate-100', text: 'text-slate-500' },
  '승인요청': { bg: 'bg-amber-100', text: 'text-amber-700' },
  '승인':   { bg: 'bg-green-100', text: 'text-green-700' },
  '반려':   { bg: 'bg-red-100',   text: 'text-red-600'   },
}

function TripList({ items }: { items: any[] }) {
  if (items.length === 0) {
    return <div className="px-5 py-8 text-center text-xs text-slate-400">출장 기록이 없습니다.</div>
  }
  return (
    <div className="divide-y divide-slate-100">
      {items.map((trip: any) => {
        const st = TRIP_STATUS[trip.status] ?? TRIP_STATUS['초안']
        const isOverseas = trip.type === '해외출장'
        return (
          <Link key={trip.id} href={`/trip/${trip.id}`}
            className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isOverseas ? 'bg-red-100' : 'bg-orange-100'}`}>
              {isOverseas
                ? <Globe size={10} className="text-red-600" />
                : <MapPin size={10} className="text-orange-600" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{trip.title}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{trip.destination} · {trip.startDate} ~ {trip.endDate}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-slate-400">{trip.userName}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${st.bg} ${st.text}`}>{trip.status}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export default async function NotesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { month: monthParam, tab, user: userParam, uid: uidParam, teamName: teamParam } = await searchParams
  const activeTab  = tab === 'notes' ? 'notes' : 'calendar'

  const session  = await auth()
  const myName   = (session?.user as any)?.name as string | undefined
  const myUserId = (session?.user as any)?.id   as string | undefined

  // 전체 팀 목록 조회 (팀 선택 드롭다운용)
  const allTeams = await prisma.team.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })

  /* ── 날짜 계산 ── */
  const now      = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const defMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const monthId  = monthParam ?? defMonth
  const [year, month] = monthId.split('-').map(Number)

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1))
  const lastOfMonth  = new Date(Date.UTC(year, month, 0))
  const fromDate     = firstOfMonth.toISOString().slice(0, 10)
  const toDate       = lastOfMonth.toISOString().slice(0, 10)

  // 캘린더 시작: 해당 월 1일이 속한 주의 일요일
  const calStartDow = firstOfMonth.getUTCDay()
  const calStart    = new Date(Date.UTC(year, month - 1, 1 - calStartDow))

  // 캘린더 종료: 해당 월 말일이 속한 주의 토요일
  const calEndDow = lastOfMonth.getUTCDay()
  const calEnd    = new Date(Date.UTC(year, month - 1, lastOfMonth.getUTCDate() + (6 - calEndDow)))

  // 캘린더 실제 표시 범위 (앞뒤 월 포함)
  const calFromDate = calStart.toISOString().slice(0, 10)
  const calToDate   = calEnd.toISOString().slice(0, 10)

  // 주 배열 생성 (4~6주)
  const weeks: WeekDay[][] = []
  const cur = new Date(calStart)
  while (cur <= calEnd) {
    const week: WeekDay[] = []
    for (let i = 0; i < 7; i++) {
      week.push({
        dateStr: cur.toISOString().slice(0, 10),
        day:     cur.getUTCDate(),
        inMonth: cur.getUTCMonth() + 1 === month && cur.getUTCFullYear() === year,
        dow:     cur.getUTCDay(),
      })
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    weeks.push(week)
  }

  // 이전 / 다음 월
  const prevM     = new Date(Date.UTC(year, month - 2, 1))
  const nextM     = new Date(Date.UTC(year, month, 1))
  const prevMonth = `${prevM.getUTCFullYear()}-${String(prevM.getUTCMonth() + 1).padStart(2, '0')}`
  const nextMonth = `${nextM.getUTCFullYear()}-${String(nextM.getUTCMonth() + 1).padStart(2, '0')}`

  // 월/탭 이동 시 현재 작성자·팀 필터를 유지한 링크를 만든다
  const buildHref = (over: { month?: string; tab?: string; user?: string | null; team?: string | null } = {}) => {
    const params = new URLSearchParams()
    params.set('month', over.month ?? monthId)
    params.set('tab', over.tab ?? activeTab)
    const u = over.user !== undefined ? over.user : userParam
    const t = over.team !== undefined ? over.team : teamParam
    if (u) params.set('user', u)
    if (t) params.set('teamName', t)
    return `/notes?${params.toString()}`
  }

  /* ── DB 조회 ── */
  const [activities, userRows, tripReports, recentVehicleLogs, rawReservations] = await Promise.all([
    prisma.workActivity.findMany({
      where: {
        date: { gte: calFromDate, lte: calToDate },
        ...((uidParam || userParam) ? { OR: [
          ...(uidParam  ? [{ userId: uidParam }] : []),
          ...(userParam ? [{ userName: userParam }, { user: { name: userParam } }] : []),
        ] } : {}),
        ...(teamParam  ? { team: { name: teamParam } } : {}),
      },
      include: {
        task: { select: { id: true, code: true, title: true, strategy: true } },
        team: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: [{ date: 'asc' }],
    }),
    prisma.workActivity.findMany({
      where: { date: { gte: fromDate, lte: toDate }, userName: { not: null } },
      select: { userName: true },
      distinct: ['userName'],
      orderBy: { userName: 'asc' },
    }),
    prisma.tripReport.findMany({
      where: {
        ...((uidParam || userParam) ? { OR: [
          ...(uidParam  ? [{ userId: uidParam }] : []),
          ...(userParam ? [{ userName: userParam }] : []),
        ] } : {}),
        ...(teamParam ? { teamName: teamParam } : {}),
      },
      orderBy: { startDate: 'desc' },
    }),
    prisma.vehicleLog.findMany({
      include: { vehicle: { select: { name: true, plateNo: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    }),
    prisma.vehicleReservation.findMany({
      where: {
        AND: [
          { startAt: { lte: new Date(calToDate + 'T23:59:59Z') } },
          { endAt:   { gte: new Date(calFromDate + 'T00:00:00Z') } },
        ],
      },
      include: { vehicle: { select: { name: true, plateNo: true } } },
      orderBy: { startAt: 'asc' },
    }),
  ])
  const userNames = userRows.map(r => r.userName!).filter(Boolean)

  // CalendarView에 넘길 직렬화 데이터
  const calActivities: CalActivity[] = []
  for (const a of activities) {
    const resolvedName = a.userName ?? a.user?.name ?? myName ?? null
    const base: CalActivity = {
      id:           a.id,
      date:         a.date,
      type:         a.type,
      title:        a.title,
      content:      a.content      ?? null,
      mentions:     a.mentions     ?? null,
      referenceUrl: (a as any).referenceUrl ?? null,
      planStatus:   a.planStatus,
      taskTitle:    a.task?.title  ?? null,
      taskCode:     a.task?.code   ?? null,
      teamName:     a.team.name,
      userName:     resolvedName,
    }
    const actEndDate = (a as any).endDate as string | null
    if (actEndDate && actEndDate > a.date) {
      // 출장 등 다일 활동 — 날짜 범위로 펼치기
      const cur = new Date(a.date)
      const end = new Date(actEndDate)
      while (cur <= end) {
        const dateStr = cur.toISOString().slice(0, 10)
        if (dateStr >= calFromDate && dateStr <= calToDate) {
          calActivities.push({ ...base, date: dateStr })
        }
        cur.setDate(cur.getDate() + 1)
      }
    } else {
      calActivities.push(base)
    }
  }

  // TripReport를 날짜 범위로 펼쳐 캘린더에 추가
  for (const trip of tripReports) {
    const start = new Date(trip.startDate)
    const end   = new Date(trip.endDate)
    const cur   = new Date(start)
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10)
      if (dateStr >= calFromDate && dateStr <= calToDate) {
        calActivities.push({
          id:           trip.id,
          date:         dateStr,
          type:         trip.type,
          title:        trip.title,
          content:      trip.purpose ?? null,
          mentions:     null,
          referenceUrl: null,
          planStatus:   '완료',
          taskTitle:    null,
          taskCode:     null,
          teamName:     trip.teamName ?? '',
          userName:     trip.userName ?? null,
          tripId:       trip.id,
          tripStart:    trip.startDate,
          tripEnd:      trip.endDate,
        })
      }
      cur.setDate(cur.getDate() + 1)
    }
  }

  // CalVehicleReservation 직렬화
  const calReservations: CalVehicleReservation[] = rawReservations.map((r: any) => ({
    id:             r.id,
    vehicleId:      r.vehicleId,
    vehicleName:    r.vehicle?.name ?? '차량',
    plateNo:        r.vehicle?.plateNo ?? null,
    userName:       r.userName,
    teamName:       r.teamName ?? null,
    purpose:        r.purpose,
    startAt:        r.startAt instanceof Date ? r.startAt.toISOString() : String(r.startAt),
    endAt:          r.endAt   instanceof Date ? r.endAt.toISOString()   : String(r.endAt),
    pickupLocation: r.pickupLocation ?? null,
    returnLocation: r.returnLocation ?? null,
    notes:          r.notes   ?? null,
    status:         r.status,
  }))

  // 업무노트 탭 섹션 데이터
  const meetings = activities.filter(a => a.type === '내부회의' || a.type === '외부미팅' || a.type === '외부회의')
  const expenseActivities = activities.filter(a =>
    a.expenseTransport != null || a.expenseAccomm != null || a.expenseMeal != null || a.expenseOther != null
  )

  return (
    <div className="p-6" style={{ maxWidth: '1440px' }}>

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between px-6 py-4 mb-4 rounded-xl" style={{ backgroundColor: '#111111' }}>
        <div>
          <h1 className="text-xl font-bold text-white">업무공간</h1>
          <p className="text-xs mt-0.5" style={{ color: '#C5D42A' }}>업무활동 · 협업 기록</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-white/20 rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Link href={buildHref({ month: prevMonth })}
              className="px-2.5 py-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors border-r border-white/20">
              <ChevronLeft size={16} />
            </Link>
            <span className="px-5 py-1.5 text-sm font-bold text-white min-w-[130px] text-center">
              {year}년 {month}월
            </span>
            <Link href={buildHref({ month: nextMonth })}
              className="px-2.5 py-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors border-l border-white/20">
              <ChevronRight size={16} />
            </Link>
          </div>
          {/* 개인 / 전체 토글 — 작성자 필터만 전환, 팀 필터는 별도 유지. 마지막 선택을 기억해 다음 방문에도 적용 */}
          {myName && (
            <PersonalScopeToggle
              hrefPersonal={`${buildHref({ user: myName })}${myUserId ? `&uid=${encodeURIComponent(myUserId)}` : ''}`}
              hrefAll={buildHref({ user: null })}
              isPersonalActive={uidParam ? uidParam === myUserId : userParam === myName}
              hasExplicitScope={!!(userParam || uidParam)}
            />
          )}
          {/* ── 팀 · 작성자 선택 ── */}
          <FilterSelects
            monthId={monthId}
            activeTab={activeTab}
            userParam={userParam}
            teamParam={teamParam}
            userNames={userNames}
            teams={allTeams}
          />
          <Link href={`/notes/new?date=${todayStr}`}
            className="flex items-center gap-1.5 text-white border border-white/20 px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
            <Plus size={14} /> 활동 추가
          </Link>
        </div>
      </div>

      {/* ── 탭 ── */}
      <div className="flex gap-0 mb-4 border-b border-slate-200">
        {(['캘린더', '업무노트'] as const).map(label => {
          const val    = label === '캘린더' ? 'calendar' : 'notes'
          const active = activeTab === val
          const tabHref = `${buildHref({ tab: val })}${userParam && uidParam ? `&uid=${encodeURIComponent(uidParam)}` : ''}`
          return (
            <Link key={label} href={tabHref}
              className={`px-6 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                active
                  ? 'border-[#C5D42A] text-[#7a9200] bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {label}
            </Link>
          )
        })}
      </div>

      {/* ══════════════════════════════════════
          캘린더 탭 — CalendarView 클라이언트 컴포넌트
      ══════════════════════════════════════ */}
      {activeTab === 'calendar' && (
        <CalendarView weeks={weeks} activities={calActivities} reservations={calReservations} todayStr={todayStr} />
      )}


      {/* ══════════════════════════════
          업무노트 탭
      ══════════════════════════════ */}
      {activeTab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ① 회의록 */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-[520px] flex flex-col">
            <div className="px-5 py-3 border-b border-blue-100 bg-blue-50/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-blue-500" />
                <h2 className="text-sm font-bold text-blue-900">회의록</h2>
                <span className="text-xs text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded-full font-semibold">{meetings.length}건</span>
              </div>
              <div className="flex gap-2">
                <Link href={`/notes/new?type=내부회의&date=${todayStr}`}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded-lg bg-white transition-colors">
                  <Plus size={11} /> 내부회의
                </Link>
                <Link href={`/notes/new?type=외부미팅&date=${todayStr}`}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-2 py-1 rounded-lg bg-white transition-colors">
                  <Plus size={11} /> 외부미팅
                </Link>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NoteList items={meetings} emptyText="이 월에 회의 기록이 없습니다." />
            </div>
          </section>

          {/* ② 출장보고 */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-[520px] flex flex-col">
            <div className="px-5 py-3 border-b border-orange-100 bg-orange-50/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-orange-500" />
                <h2 className="text-sm font-bold text-orange-900">출장보고</h2>
                <span className="text-xs text-orange-500 bg-orange-100 px-1.5 py-0.5 rounded-full font-semibold">{tripReports.length}건</span>
              </div>
              <div className="flex gap-2">
                <Link href="/trip/new"
                  className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 border border-orange-200 px-2 py-1 rounded-lg bg-white transition-colors">
                  <Plus size={11} /> 국내출장
                </Link>
                <Link href="/trip/new?type=해외출장"
                  className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 border border-orange-200 px-2 py-1 rounded-lg bg-white transition-colors">
                  <Globe size={11} /> 해외출장
                </Link>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TripList items={tripReports} />
            </div>
          </section>

          {/* ③ 차량관리 */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-[520px] flex flex-col">
            <div className="px-5 py-3 border-b border-emerald-100 bg-emerald-50/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Car size={14} className="text-emerald-600" />
                <h2 className="text-sm font-bold text-emerald-900">차량관리</h2>
                <span className="text-xs text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full font-semibold">{recentVehicleLogs.length}건 (최근)</span>
              </div>
              <div className="flex gap-2">
                <Link href="/vehicle"
                  className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 border border-emerald-200 px-2 py-1 rounded-lg bg-white transition-colors">
                  <Car size={11} /> 운행일지 전체보기
                </Link>
                <Link href="/vehicle"
                  className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 border border-emerald-200 px-2 py-1 rounded-lg bg-white transition-colors">
                  <Plus size={11} /> 차량사용
                </Link>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <VehicleLogList items={recentVehicleLogs} />
            </div>
          </section>

          {/* ④ 비용 신청 내역 */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-[520px] flex flex-col">
            <div className="px-5 py-3 border-b border-amber-100 bg-amber-50/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Receipt size={14} className="text-amber-600" />
                <h2 className="text-sm font-bold text-amber-900">비용 신청 내역</h2>
                <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full font-semibold">{expenseActivities.length}건</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ExpenseList items={expenseActivities} />
            </div>
          </section>

        </div>
      )}
    </div>
  )
}

/* ── 비용 신청 내역 ── */
const EXPENSE_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  '신청': { bg: 'bg-amber-100', text: 'text-amber-700' },
  '승인': { bg: 'bg-green-100', text: 'text-green-700' },
  '반려': { bg: 'bg-red-100',   text: 'text-red-600' },
}

function ExpenseList({ items }: { items: any[] }) {
  if (items.length === 0) {
    return <div className="px-5 py-8 text-center text-xs text-slate-400">비용을 신청한 활동이 없습니다.</div>
  }
  return (
    <div className="divide-y divide-slate-100">
      {items.map((act: any) => {
        const total = (act.expenseTransport ?? 0) + (act.expenseAccomm ?? 0) + (act.expenseMeal ?? 0) + (act.expenseOther ?? 0)
        const status = act.expenseStatus ?? '미신청'
        const st = EXPENSE_STATUS_STYLE[status] ?? { bg: 'bg-slate-100', text: 'text-slate-500' }
        return (
          <Link key={act.id} href={`/notes/${act.id}/edit`}
            className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{act.title}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${st.bg} ${st.text}`}>{status}</span>
                {act.expensePaymentMethod && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{act.expensePaymentMethod}</span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                {act.date} · {act.userName ?? act.user?.name ?? '알 수 없음'} · {act.team?.name ?? ''}
                {status === '반려' && act.expenseApproverNote ? ` · 반려사유: ${act.expenseApproverNote}` : ''}
              </p>
            </div>
            <p className="text-sm font-bold text-slate-800 tabular-nums shrink-0">{total.toLocaleString()}원</p>
          </Link>
        )
      })}
    </div>
  )
}

/* ── 서브 컴포넌트 ── */
function VehicleLogList({ items }: { items: any[] }) {
  if (items.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-xs text-slate-400 mb-2">차량 운행 기록이 없습니다.</p>
        <Link href="/vehicle" className="text-xs text-indigo-500 hover:text-indigo-700 underline">운행일지 관리 →</Link>
      </div>
    )
  }
  return (
    <div className="divide-y divide-slate-100">
      {items.map((log: any) => (
        <Link key={log.id} href="/vehicle"
          className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-emerald-50">
            <Car size={10} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
              {log.departure} → {log.destination}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {log.vehicle?.name} · {log.date} · {log.distance}km
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-slate-400">{log.driverName}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${log.isBusinessUse ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
              {log.isBusinessUse ? '업무용' : '개인'}
            </span>
          </div>
        </Link>
      ))}
      <div className="px-5 py-2.5 text-center">
        <Link href="/vehicle" className="text-xs text-slate-400 hover:text-indigo-600 transition-colors">전체 운행일지 보기 →</Link>
      </div>
    </div>
  )
}

function NoteList({ items, emptyText }: { items: any[]; emptyText: string }) {
  if (items.length === 0) {
    return <div className="px-5 py-8 text-center text-xs text-slate-400">{emptyText}</div>
  }
  return (
    <div className="divide-y divide-slate-100">
      {items.map((act: any) => {
        const meta = TYPE_META[act.type]
        return (
          <Link key={act.id} href={`/notes/${act.id}/edit`}
            className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
            <div className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${meta?.bg ?? 'bg-slate-100'} ${meta?.text ?? 'text-slate-500'}`}>
              {meta?.icon ?? <FileText size={10} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${meta?.bg ?? ''} ${meta?.text ?? ''}`}>{act.type}</span>
              </div>
              <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{act.title}</p>
              {act.content && <p className="text-xs text-slate-400 truncate mt-0.5">{act.content}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-slate-400">{act.date}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{act.team.name}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
