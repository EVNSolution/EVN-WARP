import { prisma } from '@/lib/db'
import { getWeekId } from '@/lib/week'
import { cancelReservation, DongjakProfileError, myReservations, reserveRoom, roomStatus, type DongjakProfile } from './dongjak'
import { listSkills, loadSkill } from './skills'

/**
 * 원격 MCP(/api/mcp)가 노출하는 도구들 — 로컬 warp-mcp(v0.4) 의 활동 도구를 서버로 포팅한 것.
 * 모든 동작은 토큰 주인(user) 권한·이름으로만 일어난다. 수정은 본인 활동만 허용한다.
 */

export interface McpUser {
  id: string
  name: string
  teamId: string | null
  dongjakSessionId: string | null
  /** 회의실 예약 기본정보(회사명·사업자번호·연락처·이메일·호실) JSON — 최초 1회 저장 후 자동 동봉 */
  dongjakProfile: string | null
  /** "사내" | "사외" — 사내 스킬은 사내 구성원 전용 */
  employmentType: string
  /** 사내 스킬용 개인 GitHub 토큰 (없으면 서버 공용 env 폴백) */
  skillsGithubToken: string | null
}

/** Claude/ChatGPT 가 대화 시작 시 로드하는 사용 지침 — 팀 공용 「하루 정리」 워크플로우. */
export const MCP_INSTRUCTIONS = `
이 연결의 이름은 CLEVER — 개인 AI 와 EV&Solution 업무시스템(WARP)을 잇는 회사 공식 연결이다.
대화에서 한 업무를 WARP 에 기록하고, 회의실 예약·사내 스킬·피드백 채널을 제공한다.
처음 쓰는 사용자가 "이게 뭐야"라고 물으면 CLEVER 라는 이름으로 소개한다.

## 업무 마무리를 감지하면 먼저 제안하라
다음 신호가 보이면 "이 내용을 WARP에 업무 기록으로 올릴까요?"라고 한 번 제안한다 (같은 대화에서 반복 제안 금지, 거절하면 다시 묻지 않는다):
- 작업을 끝냈다는 표현 ("됐다", "완료", "마무리하자", "오늘은 여기까지")
- 하나의 업무 단위가 끝난 흐름 (문서 완성, 분석 결론, 회의록 정리, 견적/보고서 마무리)
- "오늘 한 일 정리해줘" 같은 직접 요청

## WARP에 올릴 때의 표준 형식
1. 실제로 수행한 업무만 추린다 — 잡담·미완의 시도·사적 내용 제외.
2. 업무 1건 = 활동 1건. 제목은 「대상 + 한 일」 15자 내외.
3. note(내용)는 2~3문장 요약. 대화 원문을 길게 붙이지 않는다.
4. 끝난 일은 status=완료 로 등록한다.
5. 등록·수정 전에 반드시 제목·유형·내용을 사람이 읽는 문장으로 보여주고 확정받는다. id 는 노출하지 않는다.
6. list_my_tasks 로 중복 등록을 피한다.

## 일정 등록
날짜·시각이 정해진 약속이 보이면 "WARP 캘린더에 등록할까요?" 제안. start_time/end_time 을 넣으면
캘린더에 그 시간대로 표시된다. 종료 시각을 모르면 1시간으로 잡고 그렇게 말해준다.

## 회의실 예약 (동작사무실)
- 방·시간이 정해진 예약 요청("내일 2시에 6층 잡아줘"): meeting_room_status 로 그 날짜 현황을
  확인해 해당 시간대가 비어 있는지(차 있으면 비어 있는 대안)를 보여주면서, **같은 메시지에서**
  「이번 예약은 누구 이름으로 할까요? (예: 장원철, 장원철 외 3명)」 **한 가지만** 물어본다.
  회의 제목·선호하는 방 등 다른 것은 묻지 않는다 — 제목은 사용자가 먼저 말한 경우에만 넣고
  아니면 자동으로 「회의」가 된다. 이름을 받으면 즉시 reserve_meeting_room 을 호출한다.
  현황 조회가 실패하거나 느리면 기다리지 말고 이름만 물어 바로 예약을 진행한다 —
  이미 찬 시간이면 서버가 거절하므로 그때 대안을 보여주면 된다.
- "회의실 비어 있어?"처럼 현황 자체를 묻는 경우는 meeting_room_status 결과만 정리해 보여준다.
- 「예약 기본정보 등록 필요」 안내가 나오면 회사명·사업자등록번호·연락처·이메일·입주 호실을
  물어서 save_meeting_profile 로 저장한다(최초 1회, 이후 자동 동봉). 저장 후 예약을 다시 진행한다.
- 취소는 my_meeting_reservations 로 확인 후, 어떤 예약인지 확정받고 cancel_meeting_reservation.
- 로그인 안내 에러가 나오면 그 안내문을 그대로 전달한다.
예약이 확정되면 이어서 WARP 캘린더(create_task + 시간)에도 기록할지 제안한다.

## 사내 스킬 (문서작업·리서치)
회사 표준 양식·절차가 필요한 작업 — 미팅 사전조사, 기술문서(사양서·매뉴얼), 한글(hwpx) 문서,
법무 검토, R&D 과제 관리 등 — 은 list_evn_skills 로 해당 스킬을 찾고, 있으면 load_evn_skill 로
지침을 읽어 그 양식과 절차를 따른다. 사내 업무 문서를 일반 지식만으로 만들지 말 것 — 스킬이 정본이다.

## 피드백 (적극 수집 — 질문 대상을 분명히)
- 묻는 대상은 항상 "CLEVER 로 회사 업무를 보는 경험"이다 — Claude/ChatGPT 자체에 대한
  의견을 묻는 것으로 들리지 않게 반드시 CLEVER(회사 업무 연결)를 지칭해서 묻는다.
- 사용자가 업무 연결에 대한 불편·개선 아이디어를 말하면 "피드백으로 남겨둘까요?" 제안 후
  확정받은 내용을 send_feedback 으로 등록한다 (AI 업무 기록 화면에 쌓인다).
- 도구가 오류를 내거나, 사용자가 같은 요청을 반복·수정하는 등 불편을 겪은 게 보이면,
  일을 마무리한 뒤 "방금 겪으신 불편을 피드백으로 남겨둘까요?"라고 꼭 제안한다.
- 도구 결과에 [피드백 요청] 표시가 오면, 작업 보고 끝에 가볍게 한 줄로 의견을 청한다.
- 피드백 질문은 한 대화에 1회까지. 거절하면 다시 묻지 않는다.

## 금지
- 사용자 확정 없이 등록·수정하지 않는다.
- 대화에 없는 일을 지어내지 않는다. 불확실하면 묻는다.
`.trim()

/** 업무공간 활동추가 입력창과 같은 활동 유형 (근태·증명서는 HR 플로우라 제외). */
const ACTIVITY_TYPES = [
  '내부회의', '외부미팅', '이메일', '전화·통화', '화상회의',
  '국내출장', '해외출장',
  '발표/전시·행사',
  '교육/연수', '세미나·컨퍼런스',
  '문서·자료작성', '개발·구현', '도면·설계', '제품제작·조립', '콘텐츠·디자인',
  'AS출동', '설치·시운전', '정기점검',
  '고객미팅', '신규영업', '제안/견적', '고객행사',
  '인재영입', '외부 네트워킹', '파트너십 타진',
  'IR 발표', '투자자 미팅', '투자행사',
  '견적서 발행', 'PO 발행', '수주 확정', '세금계산서 발행',
  '대관·신청', '세무·회계', '신고·갱신', '법무·계약', '경영기획',
]

const DATE_RE = '^\\d{4}-\\d{2}-\\d{2}$'
const TIME_RE = '^([01]\\d|2[0-3]):[0-5]\\d$'

export const TOOL_DEFINITIONS = [
  {
    name: 'create_task',
    description:
      'WARP 업무공간에 새 활동(할 일·일정)을 등록한다. 사용자가 할 일·업무·미팅 일정을 WARP에 올려 달라고 할 때 사용한다. '
      + '등록된 활동은 「계획」 상태로 시작하며, 이미 끝낸 일은 status=완료 로 등록한다. '
      + '시각이 정해진 일정은 start_time/end_time 을 넣으면 WARP 캘린더에 그 시간대로 표시된다. '
      + '호출 전에 반드시 등록할 내용(제목·날짜·시간·유형·내용)을 사람이 읽는 문장으로 보여주고 확정을 받아라.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '활동 제목 (필수)' },
        date: { type: 'string', pattern: DATE_RE, description: '시작일 YYYY-MM-DD — 생략하면 오늘(한국 시간)' },
        due: { type: 'string', pattern: DATE_RE, description: '종료일(기한) YYYY-MM-DD — 하루짜리 일이면 생략' },
        type: { type: 'string', enum: ACTIVITY_TYPES, description: '활동 유형 — 업무공간 입력창의 유형 버튼과 동일' },
        note: { type: 'string', description: '내용/메모' },
        status: { type: 'string', enum: ['계획', '완료'], description: '이미 끝낸 일이면 「완료」 — 생략하면 「계획」' },
        start_time: { type: 'string', pattern: TIME_RE, description: '일정 시작 시각 HH:MM — 생략하면 하루종일' },
        end_time: { type: 'string', pattern: TIME_RE, description: '일정 종료 시각 HH:MM' },
      },
      required: ['title', 'type'],
    },
  },
  {
    name: 'list_my_tasks',
    description:
      '내 WARP 활동(할 일·일정) 목록을 조회한다 (최근 30일 ~ 앞으로 60일). '
      + '자기 할 일·오늘 할 일·미완료 업무를 묻거나, 중복 등록을 확인할 때 사용한다. '
      + '사용자에게 보여줄 때는 제목·기간·내용 위주로 정리하고 id 는 노출하지 마라.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['계획', '완료'], description: '「계획」= 미완료만, 「완료」= 끝난 것만, 생략 = 전부' },
      },
    },
  },
  {
    name: 'update_task',
    description:
      '내 WARP 활동을 수정한다 — 상태(계획/완료)·제목·내용·날짜·시간·유형. '
      + '어떤 활동인지 제목과 내용으로 사용자에게 보여주고 확정받은 뒤 호출한다. '
      + 'id 는 list_my_tasks 결과의 내부 키로만 쓰고 사용자에게 노출하지 않는다.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '활동 id — list_my_tasks 결과의 내부 키' },
        status: { type: 'string', enum: ['계획', '완료'] },
        title: { type: 'string' },
        note: { type: 'string', description: '빈 문자열이면 내용 삭제' },
        date: { type: 'string', pattern: DATE_RE },
        due: { type: 'string', pattern: DATE_RE },
        type: { type: 'string', enum: ACTIVITY_TYPES },
        start_time: { type: 'string', pattern: TIME_RE },
        end_time: { type: 'string', pattern: TIME_RE },
      },
      required: ['id'],
    },
  },
  {
    name: 'meeting_room_status',
    description:
      '동작사무실 회의실의 특정 날짜 예약 현황을 조회한다 (캐시로 보통 1초 내 응답). 현황 질문이나 '
      + '예약 요청 시 현황을 보여주는 용도로 호출하되, 결과를 기다리느라 예약자 이름 질문을 미루거나 '
      + '예약 진행을 막지는 마라. 결과는 비어 있는 방과 시간대 위주로 읽기 쉽게 정리해 보여줘라.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', pattern: DATE_RE, description: '조회 날짜 YYYY-MM-DD — 생략하면 오늘' },
      },
    },
  },
  {
    name: 'reserve_meeting_room',
    description:
      '동작사무실 회의실을 예약한다. 「누구 이름으로 예약할지」(user_name)를 확정받으면 바로 호출한다 '
      + '— 사전 현황 확인은 선택이며, 이미 찬 시간이면 서버가 거절하므로 그때 meeting_room_status 로 '
      + '대안을 보여주면 된다. 시간은 정시 단위(14시~16시 → start_hour 14, end_hour 16). '
      + '예약 기본정보 등록이 필요하다는 안내가 나오면 save_meeting_profile 로 먼저 저장한다.',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string', description: '방 id — meeting_room_status 결과의 [대괄호] 값' },
        date: { type: 'string', pattern: DATE_RE, description: '예약 날짜 YYYY-MM-DD' },
        start_hour: { type: 'integer', minimum: 0, maximum: 23, description: '시작 시각 (정시)' },
        end_hour: { type: 'integer', minimum: 1, maximum: 24, description: '종료 시각 — 시작보다 커야 함' },
        user_name: {
          type: 'string',
          description: '이번 예약의 사용자(예약자) 이름 — 참석 인원이 회의마다 다르므로 매번 사용자에게 물어서 받는다 (예: "장원철", "장원철 외 3명")',
        },
        title: { type: 'string', description: '회의 제목 — 사용자가 먼저 말한 경우에만 넣는다. 따로 묻지 말 것 (생략하면 「회의」)' },
      },
      required: ['room_id', 'date', 'start_hour', 'end_hour', 'user_name'],
    },
  },
  {
    name: 'save_meeting_profile',
    description:
      '회의실 예약에 함께 제출되는 기본정보(회사명·사업자등록번호·연락처·이메일·입주 호실)를 저장한다. '
      + '최초 1회만 사용자에게 다섯 항목을 물어서 저장하면 이후 모든 예약에 자동으로 들어간다. '
      + '예약 시 「예약 기본정보 등록 필요」 안내가 나왔을 때 사용한다.',
    inputSchema: {
      type: 'object',
      properties: {
        company_name: { type: 'string', description: '회사명 (예: 이브이앤솔루션)' },
        business_number: { type: 'string', description: '사업자등록번호 (예: 123-45-67890)' },
        phone: { type: 'string', description: '연락처 (예: 010-1234-5678)' },
        email: { type: 'string', description: '이메일' },
        room_number: { type: 'string', description: '입주 호실 (예: 601호)' },
      },
      required: ['company_name', 'business_number', 'phone', 'email', 'room_number'],
    },
  },
  {
    name: 'my_meeting_reservations',
    description: '내가 잡은 회의실 예약 목록을 조회한다. 예약 확인·취소 요청 시 먼저 호출한다.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'cancel_meeting_reservation',
    description:
      '회의실 예약을 취소한다. my_meeting_reservations 로 확인한 뒤, 어떤 예약인지(날짜·시간·제목) '
      + '사용자에게 보여주고 확정받고 나서 호출한다. id 는 노출하지 않는다.',
    inputSchema: {
      type: 'object',
      properties: {
        reservation_id: { type: 'string', description: '예약 id — my_meeting_reservations 결과의 id' },
        room_id: { type: 'string', description: '방 id — my_meeting_reservations 결과의 room' },
      },
      required: ['reservation_id', 'room_id'],
    },
  },
  {
    name: 'send_feedback',
    description:
      'AI 연결(WARP 도우미) 사용 중 느낀 개선 의견·불편·요청을 회사에 남긴다. '
      + '사용자가 "이거 불편하다", "이런 기능 있으면 좋겠다"처럼 AI 연결 자체에 대한 의견을 말하면 '
      + '"피드백으로 남겨둘까요?"라고 제안하고, 확정받은 내용을 이 도구로 등록한다.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '피드백 내용 (2000자 이내) — 사용자가 확정한 문장' },
      },
      required: ['message'],
    },
  },
  {
    name: 'list_evn_skills',
    description:
      'EV&Solution 사내 Claude 스킬 목록을 조회한다. 회사 표준 양식·절차가 필요한 문서작업이나 '
      + '리서치(미팅 사전조사, 기술문서, 한글 문서, 법무 검토, R&D 과제 등)를 시작하기 전에 호출해 '
      + '해당 작업용 사내 스킬이 있는지 확인한다.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'load_evn_skill',
    description:
      '사내 스킬의 지침(SKILL.md)을 읽어온다. list_evn_skills 에서 작업에 맞는 스킬을 찾았으면 '
      + '이 도구로 전체 지침을 받아 그대로 따른다.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '스킬 이름 — list_evn_skills 결과의 name (예: evn-tech-doc)' },
      },
      required: ['name'],
    },
  },
]

function todayKst(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
}

function shiftDays(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

type ToolResult = { text: string; isError?: boolean }
const err = (text: string): ToolResult => ({ text, isError: true })

async function createTask(user: McpUser, a: Record<string, any>): Promise<ToolResult> {
  if (!a.title?.trim() || !a.type) return err('title 과 type 은 필수입니다.')
  if (!ACTIVITY_TYPES.includes(a.type)) return err(`지원하지 않는 활동 유형: ${a.type}`)
  if (!user.teamId) return err(`계정(${user.name})에 소속 팀이 없어 활동을 등록할 수 없습니다 — WARP 관리자에게 팀 배정을 요청하세요.`)
  const date = a.date || todayKst()
  const activity = await prisma.workActivity.create({
    data: {
      teamId: user.teamId,
      date,
      endDate: a.due || null,
      week: getWeekId(new Date(date)),
      type: a.type,
      title: String(a.title).trim(),
      content: a.note || null,
      planStatus: a.status === '완료' ? '완료' : '계획',
      startTime: a.start_time || null,
      endTime: a.end_time || null,
      source: 'mcp',
      userId: user.id,
      userName: user.name,
    },
  })
  const time = activity.startTime ? ` ${activity.startTime}${activity.endTime ? `~${activity.endTime}` : ''}` : ''
  return { text: `등록 완료 — id: ${activity.id}\n제목: ${activity.title}\n기간: ${activity.date}${activity.endDate ? ` ~ ${activity.endDate}` : ''}${time}\n유형: ${activity.type} · 상태: ${activity.planStatus}` }
}

async function listMyTasks(user: McpUser, a: Record<string, any>): Promise<ToolResult> {
  const today = todayKst()
  const tasks = await prisma.workActivity.findMany({
    where: {
      userId: user.id,
      date: { gte: shiftDays(today, -30), lte: shiftDays(today, 60) },
      ...(a.status === '계획' || a.status === '완료' ? { planStatus: a.status } : {}),
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    take: 200,
    select: { id: true, title: true, content: true, date: true, endDate: true, startTime: true, endTime: true, type: true, planStatus: true },
  })
  if (tasks.length === 0) return { text: '해당하는 활동이 없습니다.' }
  const lines = tasks.map(t =>
    `- [${t.planStatus}] ${t.title} (id: ${t.id}, ${t.date}${t.endDate ? `~${t.endDate}` : ''}${t.startTime ? ` ${t.startTime}${t.endTime ? `-${t.endTime}` : ''}` : ''}, ${t.type})${t.content ? ` — ${t.content}` : ''}`)
  return { text: `내 활동 ${tasks.length}건:\n${lines.join('\n')}` }
}

async function updateTask(user: McpUser, a: Record<string, any>): Promise<ToolResult> {
  if (!a.id) return err('id 는 필수입니다.')
  const before = await prisma.workActivity.findUnique({ where: { id: String(a.id) } })
  if (!before || before.userId !== user.id) return err('해당 활동을 찾을 수 없거나 본인 활동이 아닙니다.')
  const data: Record<string, unknown> = {}
  if (a.status !== undefined) data.planStatus = a.status === '완료' ? '완료' : '계획'
  if (a.title !== undefined && String(a.title).trim()) data.title = String(a.title).trim()
  if (a.note !== undefined) data.content = a.note || null
  if (a.date !== undefined) { data.date = a.date; data.week = getWeekId(new Date(a.date)) }
  if (a.due !== undefined) data.endDate = a.due || null
  if (a.type !== undefined) {
    if (!ACTIVITY_TYPES.includes(a.type)) return err(`지원하지 않는 활동 유형: ${a.type}`)
    data.type = a.type
  }
  if (a.start_time !== undefined) data.startTime = a.start_time || null
  if (a.end_time !== undefined) data.endTime = a.end_time || null
  if (Object.keys(data).length === 0) return err('바꿀 내용이 없습니다 — status/title/note/date/due/type/start_time/end_time 중 하나 이상을 주세요.')
  data.source = 'mcp' // AI가 손댄 활동도 AI 업무 기록에 잡히게 표시
  const updated = await prisma.workActivity.update({ where: { id: before.id }, data })
  return {
    text: `수정 완료 — 「${before.title}」\n`
      + (data.title !== undefined ? `  제목: ${before.title} → ${updated.title}\n` : '')
      + (data.planStatus !== undefined ? `  상태: ${before.planStatus} → ${updated.planStatus}\n` : '')
      + (data.content !== undefined ? `  내용: ${before.content ?? '(없음)'} → ${updated.content ?? '(없음)'}\n` : '')
      + (data.date !== undefined ? `  시작일: ${before.date} → ${updated.date}\n` : '')
      + (data.endDate !== undefined ? `  종료일: ${before.endDate ?? '(없음)'} → ${updated.endDate ?? '(없음)'}\n` : '')
      + (data.type !== undefined ? `  유형: ${before.type} → ${updated.type}\n` : '')
      + (data.startTime !== undefined || data.endTime !== undefined
        ? `  시간: ${before.startTime ?? '하루종일'} → ${updated.startTime ?? '하루종일'}${updated.endTime ? `~${updated.endTime}` : ''}\n` : ''),
  }
}

async function meetingRoomStatus(user: McpUser, a: Record<string, any>): Promise<ToolResult> {
  const day = await roomStatus(user.dongjakSessionId, a.date || todayKst())
  // 방 id 가 숫자/문자로 섞여 올 수 있어 문자열로 맞춰 비교한다 (337 vs "337" 불일치로 전부 "예약 없음" 나오던 버그)
  const byRoom = day.rooms.map(room => {
    const taken = day.reservations
      .filter(r => String(r.roomId) === String(room.id))
      .sort((x, y) => Number(x.startHour) - Number(y.startHour))
      .map(r => `${r.startHour}시~${r.endHour}시(${r.title ?? '회의'}${r.userName ? ` · ${r.userName}` : ''})`)
    return `- ${room.name} [${room.id}]: ${taken.length ? taken.join(', ') : '예약 없음'}`
  })
  const orphans = day.reservations.filter(r => !day.rooms.some(room => String(room.id) === String(r.roomId)))
  const extra = orphans.length
    ? `\n(방 목록에 없는 예약 ${orphans.length}건: ${orphans.map(r => `${r.roomId} ${r.startHour}~${r.endHour}시`).join(', ')})`
    : ''
  const staleNote = day.stale
    ? `\n※ 예약 서버 응답이 느려 ${new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }).format(new Date(day.asOf))} 기준 결과입니다 — 방금 바뀐 예약은 빠져 있을 수 있습니다.`
    : ''
  return { text: `${day.date} 회의실 현황 (로그인: ${day.userName})\n${byRoom.join('\n')}${extra}${staleNote}` }
}

/** 저장된 예약 기본정보 JSON 파싱 — 깨져 있으면 없는 것으로 본다. */
function parseDongjakProfile(user: McpUser): DongjakProfile | null {
  if (!user.dongjakProfile) return null
  try { return JSON.parse(user.dongjakProfile) as DongjakProfile } catch { return null }
}

const PROFILE_SETUP_GUIDE =
  '예약 기본정보 등록이 필요합니다 (처음 한 번만). 사용자에게 「회의실 예약에 들어갈 기본정보를 알려주세요 — '
  + '①회사명 ②사업자등록번호 ③연락처 ④이메일 ⑤입주 호실」이라고 물어보고, 다섯 항목을 받으면 '
  + 'save_meeting_profile 로 저장한 뒤 예약을 다시 진행해 주세요. 다음 예약부터는 자동으로 들어갑니다. '
  + '(도구 정의에 save_meeting_profile 이 보이지 않으면 인자를 그대로 전달해도 처리됩니다)'

async function reserveMeetingRoom(user: McpUser, a: Record<string, any>): Promise<ToolResult> {
  if (!a.room_id || !a.date || a.start_hour == null || a.end_hour == null) return err('room_id/date/start_hour/end_hour 는 필수입니다.')
  if (Number(a.end_hour) <= Number(a.start_hour)) return err('종료 시각이 시작 시각보다 커야 합니다.')
  const userName = String(a.user_name ?? '').trim()
  if (!userName) {
    return err(
      '예약자 이름이 필요합니다. 사용자에게 「이번 예약은 누구 이름으로 할까요? (예: 장원철, 장원철 외 3명)」라고 물어보고, '
      + '답을 받은 뒤 reserve_meeting_room 을 user_name 인자에 그 이름을 넣어 다시 호출해 주세요. '
      + '현재 도구 정의에 user_name 항목이 보이지 않더라도 인자로 전달하면 정상 처리됩니다.')
  }
  try {
    const msg = await reserveRoom(user.dongjakSessionId, {
      roomId: String(a.room_id), date: a.date, startHour: Number(a.start_hour), endHour: Number(a.end_hour),
      title: a.title, userName,
    }, parseDongjakProfile(user))
    return { text: `예약 완료 — ${a.date} ${a.start_hour}시~${a.end_hour}시 (사용자: ${userName})\n${msg}` }
  } catch (e) {
    if (e instanceof DongjakProfileError) return err(PROFILE_SETUP_GUIDE)
    throw e
  }
}

async function saveMeetingProfile(user: McpUser, a: Record<string, any>): Promise<ToolResult> {
  const profile: DongjakProfile = {
    companyName: String(a.company_name ?? '').trim(),
    businessNumber: String(a.business_number ?? '').trim(),
    phone: String(a.phone ?? '').trim(),
    email: String(a.email ?? '').trim(),
    roomNumber: String(a.room_number ?? '').trim(),
  }
  const missing = Object.entries({
    company_name: profile.companyName, business_number: profile.businessNumber,
    phone: profile.phone, email: profile.email, room_number: profile.roomNumber,
  }).filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) return err(`비어 있는 항목이 있습니다: ${missing.join(', ')} — 사용자에게 물어서 채운 뒤 다시 저장해 주세요.`)
  await prisma.user.update({ where: { id: user.id }, data: { dongjakProfile: JSON.stringify(profile) } })
  return {
    text: '예약 기본정보가 저장되었습니다 — 이후 회의실 예약에 자동으로 들어갑니다.\n'
      + `회사명: ${profile.companyName}\n사업자등록번호: ${profile.businessNumber}\n`
      + `연락처: ${profile.phone}\n이메일: ${profile.email}\n입주 호실: ${profile.roomNumber}`,
  }
}

async function myMeetingReservations(user: McpUser): Promise<ToolResult> {
  const list = await myReservations(user.dongjakSessionId)
  if (list.length === 0) return { text: '예약된 회의실이 없습니다.' }
  const lines = list.map(r =>
    `- ${r.date} ${r.startHour}시~${r.endHour}시 ${r.roomName ?? r.roomId}: ${r.title ?? '회의'} (id: ${r.id}, room: ${r.roomId})`)
  return { text: `내 회의실 예약 ${list.length}건:\n${lines.join('\n')}` }
}

async function cancelMeeting(user: McpUser, a: Record<string, any>): Promise<ToolResult> {
  if (!a.reservation_id || !a.room_id) return err('reservation_id 와 room_id 는 필수입니다.')
  return { text: await cancelReservation(user.dongjakSessionId, String(a.reservation_id), String(a.room_id)) }
}

// 사내 스킬은 GitHub org 멤버만 읽던 자료다 — WARP 를 경유한다고 경계가 넓어지면 안 되므로
// 사내 구성원(employmentType '사내')으로 제한한다. 사외(영업/AS) 계정은 차단.
const INTERNAL_ONLY_MSG = '사내 스킬은 사내 구성원 전용 기능입니다.'

async function listEvnSkills(user: McpUser): Promise<ToolResult> {
  if (user.employmentType !== '사내') return err(INTERNAL_ONLY_MSG)
  const skills = await listSkills(user.skillsGithubToken)
  return { text: `사내 스킬 ${skills.length}개:\n${skills.map(s => `- ${s.name}: ${s.description}`).join('\n')}` }
}

async function loadEvnSkill(user: McpUser, a: Record<string, any>): Promise<ToolResult> {
  if (user.employmentType !== '사내') return err(INTERNAL_ONLY_MSG)
  if (!a.name) return err('name 은 필수입니다.')
  const s = await loadSkill(String(a.name), user.skillsGithubToken)
  return { text: `[포함 파일] ${s.files.join(', ') || '(SKILL.md 만)'}\n\n${s.content}` }
}

/** AI 연결 사용 중 남기는 개선 의견 — 제안함(Suggestion)에 [AI 피드백] 으로 쌓이고 AI 업무 기록 화면에도 보인다. */
async function sendFeedback(user: McpUser, a: Record<string, any>): Promise<ToolResult> {
  const message = String(a.message ?? '').trim()
  if (!message) return err('message 는 필수입니다.')
  if (message.length > 2000) return err('피드백은 2000자 이내로 적어 주세요.')
  const firstLine = message.split('\n')[0]
  await prisma.suggestion.create({
    data: {
      userId: user.id,
      userName: user.name,
      type: '제안',
      title: `[AI 피드백] ${firstLine.slice(0, 40)}${firstLine.length > 40 ? '…' : ''}`,
      content: message,
    },
  })
  return { text: '피드백이 등록되었습니다 — AI 업무 기록 화면과 제안함에서 볼 수 있고, 관리자가 답변을 남길 수 있습니다. 의견 감사합니다!' }
}

/** AI 사용 집계(AI 업무 기록 대시보드)용 도구 분류. */
const TOOL_CATEGORY: Record<string, string> = {
  create_task: '업무기록', list_my_tasks: '업무기록', update_task: '업무기록',
  meeting_room_status: '회의실', reserve_meeting_room: '회의실', save_meeting_profile: '회의실',
  my_meeting_reservations: '회의실', cancel_meeting_reservation: '회의실',
  send_feedback: '피드백',
  list_evn_skills: '스킬', load_evn_skill: '스킬',
}

/** 작업 성공 직후 가끔(약 1/5) 끼워 보내는 피드백 넛지 — AI 가 가볍게 의견을 청하게 한다. */
const FEEDBACK_NUDGE =
  '\n\n[피드백 요청] 작업 보고 끝에 가볍게 한 줄로 물어봐 주세요: '
  + '"지금처럼 개인 AI 에 연결된 CLEVER 로 EV&Solution 업무를 보시면서 불편했던 점이나 '
  + '바라는 점이 있으면 알려주세요 — 피드백으로 남겨드릴게요." '
  + '(Claude/ChatGPT 자체가 아니라 CLEVER 업무 연결에 대한 의견을 묻는 것임을 분명히. '
  + '이번 대화에서 이미 물어봤다면 생략. 의견을 주면 send_feedback 으로 등록)'

export async function callTool(user: McpUser, name: string, args: Record<string, any>): Promise<ToolResult> {
  let result = await dispatchTool(user, name, args)
  // 사용 로그 — 인자(내용)는 저장하지 않는다. 실패해도 도구 응답에는 영향 없음.
  prisma.mcpLog.create({
    data: { userId: user.id, userName: user.name, tool: name, category: TOOL_CATEGORY[name] ?? '기타', ok: !result.isError },
  }).catch(() => {})
  if (!result.isError && (name === 'create_task' || name === 'reserve_meeting_room') && Math.random() < 0.2) {
    result = { ...result, text: result.text + FEEDBACK_NUDGE }
  }
  return result
}

async function dispatchTool(user: McpUser, name: string, args: Record<string, any>): Promise<ToolResult> {
  try {
    const a = args ?? {}
    switch (name) {
      case 'create_task': return await createTask(user, a)
      case 'list_my_tasks': return await listMyTasks(user, a)
      case 'update_task': return await updateTask(user, a)
      case 'meeting_room_status': return await meetingRoomStatus(user, a)
      case 'reserve_meeting_room': return await reserveMeetingRoom(user, a)
      case 'save_meeting_profile': return await saveMeetingProfile(user, a)
      case 'my_meeting_reservations': return await myMeetingReservations(user)
      case 'cancel_meeting_reservation': return await cancelMeeting(user, a)
      case 'send_feedback': return await sendFeedback(user, a)
      case 'list_evn_skills': return await listEvnSkills(user)
      case 'load_evn_skill': return await loadEvnSkill(user, a)
      default: return err(`알 수 없는 도구: ${name}`)
    }
  } catch (e) {
    console.error(`[mcp] tool ${name} 실패`, e instanceof Error ? e.message : e)
    // 회의실·스킬 도구의 에러 메시지는 사용자 안내문으로 만들어져 있어 그대로 전달한다.
    // DB 쪽(활동 도구) 오류는 내부 정보가 섞일 수 있어 일반 문구로 숨긴다.
    const passthrough = name.startsWith('meeting_') || name.startsWith('reserve_') || name.startsWith('my_meeting')
      || name.startsWith('cancel_meeting') || name.includes('evn_skill')
    if (passthrough && e instanceof Error && e.message) return err(e.message)
    return err('처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
  }
}
