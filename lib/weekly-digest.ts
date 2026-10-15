import { prisma } from '@/lib/db'

/**
 * 주간회의 브리핑 — "이번 주(월요일 09시 이후) WARP에 기록된 일"을 주 내내 누적해
 * 팀별로 읽어주는 요약. AI 업무 기록 화면의 브리핑 카드가 쓴다.
 *
 * 기간: 이번 주 월요일 09:00 KST 이후 등록된 기록을 한 주 내내 누적해 보여준다
 *       + 수행일이 그 기간(오늘+7일까지)에 걸리는 기존 기록 — AI/수기 등록을 가리지 않는다.
 * 팀 구분: 사람 소속이 아니라 「연계 과제의 팀」 — 독립활동·전사과제 직접 연계는 「공통」.
 * 구조: 팀마다 서버가 계산한 유형별 집계줄(신규영업 N·고객미팅 M…) + AI(Haiku)의 종합 서술
 * 불릿 3~5개. AI 실패 시 불릿은 대표 업무 몇 건으로 폴백하되 집계줄은 항상 나온다.
 * 캐시: 정각 슬롯 — 업무시간(평일 9~18시 KST) 매시 정각 / 그 외 3시간 격자.
 * 새로고침 버튼도 슬롯을 우회하지 않는다.
 * 비공개 활동 제외, 제목만 공개는 제목만.
 */

export interface DigestTeam {
  name: string
  /** 유형별 건수 집계 한 줄 — 예: "신규영업 4 · 고객미팅 3 · 문서·자료작성 5 (총 12건)" */
  stats: string
  /** 그 팀의 흐름을 관통하는 AI 한 줄 요약 — 폴백(rule)일 땐 없음 */
  headline?: string
  bullets: string[]
}

export interface WeeklyDigest {
  windowStart: string
  windowLabel: string // "10/9(목) 10:00 이후"
  generatedAt: string
  /** 이 요약이 속한 재생성 슬롯의 정각 — 화면에 "14:00 생성"처럼 표시되는 기준 시각 */
  slotAt: string
  teams: DigestTeam[]
  activityCount: number
  teamCount: number
  peopleCount: number
  source: 'ai' | 'rule'
  /** AI 요약 실패 시 원인 (키 오류·크레딧 부족 진단용 — 비밀값 없음) */
  aiError?: string
}

let cache: WeeklyDigest | null = null
let refreshing: Promise<WeeklyDigest> | null = null

const KST = 9 * 3600_000
const CACHE_ROW_ID = 'weekly'

/** 마지막 생성본(DB) — 재시작·배포 후에도 목록 폴백 대신 이걸 즉시 띄운다. */
async function loadStored(): Promise<WeeklyDigest | null> {
  try {
    const row = await prisma.aiDigestCache.findUnique({ where: { id: CACHE_ROW_ID } })
    return row ? (JSON.parse(row.json) as WeeklyDigest) : null
  } catch {
    return null
  }
}

async function store(d: WeeklyDigest): Promise<void> {
  try {
    const json = JSON.stringify(d)
    await prisma.aiDigestCache.upsert({
      where: { id: CACHE_ROW_ID },
      create: { id: CACHE_ROW_ID, json },
      update: { json },
    })
  } catch (e) {
    console.error('[weekly-digest] 생성본 저장 실패:', e instanceof Error ? e.message : e)
  }
}

/**
 * 재생성 슬롯 — AI 호출을 아끼기 위해 정각 격자에 맞춘다.
 * 평일 업무시간(9~18시 KST)은 매시 정각(14:00 → 15:00…), 그 외(야간·주말)는
 * 3시간 격자(18:00 → 21:00 → 00:00…). 같은 슬롯 안에서는 새로고침을 눌러도 재생성하지 않고,
 * 슬롯이 바뀌었을 때만 새로 만든다. 화면의 생성 시각도 이 슬롯 정각으로 표시된다.
 */
function slotStart(now = new Date()): Date {
  const k = new Date(now.getTime() + KST)
  const dow = k.getUTCDay()
  const hour = k.getUTCHours()
  const business = dow >= 1 && dow <= 5 && hour >= 9 && hour < 18
  const anchorHour = business ? hour : Math.floor(hour / 3) * 3
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), anchorHour) - KST)
}
const DOW_LABEL = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 브리핑 기간 시작 — 이번 주 월요일 09:00 KST. 월~금(주말 포함) 내용이 한 주 동안 계속
 * 누적되고, 다음 주 월요일 09시에 새 주로 넘어간다. 월요일 09시 전이면 지난주 월요일 기준.
 */
export function weekWindowStart(now = new Date()): Date {
  const k = new Date(now.getTime() + KST)
  const backToMonday = (k.getUTCDay() + 6) % 7 // 월=0, 화=1 … 일=6
  let start = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - backToMonday, 9, 0) - KST)
  if (start.getTime() > now.getTime()) start = new Date(start.getTime() - 7 * 86400_000)
  return start
}

function slotLabel(slot: Date): string {
  const k = new Date(slot.getTime() + KST)
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()}(${DOW_LABEL[k.getUTCDay()]}) ${String(k.getUTCHours()).padStart(2, '0')}:00 이후`
}

type Row = {
  title: string; content: string | null; type: string; date: string
  userName: string | null; visibility: string | null
  startTime: string | null
  createdAt: Date
  team: { name: string } | null
  task: { title: string; parentId: string | null; team: { name: string } | null } | null
}

/**
 * 브리핑 대상 기록 — 둘 중 하나면 포함한다 (AI/수기 등록 구분 없음):
 *  ① 이번 주(월 09시) 이후 새로 등록된 기록 (등록일 기준)
 *  ② 수행일이 「주 시작 ~ 오늘+7일」에 걸리는 기록 — 몇 주 전에 미리 잡아둔
 *     수기 일정·반복 일정도 이번 기간에 수행되면 브리핑에 들어온다.
 */
async function fetchRows(since: Date): Promise<Row[]> {
  const sinceDay = new Date(since.getTime() + KST).toISOString().slice(0, 10)
  const horizonDay = new Date(Date.now() + KST + 7 * 86400_000).toISOString().slice(0, 10)
  return prisma.workActivity.findMany({
    where: {
      NOT: { visibility: '전체 비공개' },
      OR: [
        { createdAt: { gte: since } },
        { date: { gte: sinceDay, lte: horizonDay } },
      ],
    },
    orderBy: [{ teamId: 'asc' }, { createdAt: 'asc' }],
    take: 400,
    select: {
      title: true, content: true, type: true, date: true, userName: true, visibility: true,
      startTime: true, createdAt: true,
      team: { select: { name: true } },
      task: { select: { title: true, parentId: true, team: { select: { name: true } } } },
    },
  })
}

// 팀 구분은 사람의 소속이 아니라 「연계 과제의 팀」 기준 — 경영진 등 소속 그룹이 팀으로 뜨지 않게.
// 독립활동·전사 전략과제 직접 연계처럼 팀 단위가 애매한 것은 「공통」으로 묶는다.
function groupByTeam(rows: Row[]): Map<string, Row[]> {
  const byTeam = new Map<string, Row[]>()
  for (const r of rows) {
    const t = r.task && r.task.parentId ? (r.task.team?.name ?? '공통') : '공통'
    const arr = byTeam.get(t) ?? []
    arr.push(r)
    byTeam.set(t, arr)
  }
  if (byTeam.has('공통')) {
    const common = byTeam.get('공통')!
    byTeam.delete('공통')
    byTeam.set('공통', common)
  }
  return byTeam
}

/** 유형별 건수 집계 한 줄 — 나열이 아니라 "무엇을 몇 건 했는지"가 먼저 보이게. */
function statsLine(rows: Row[]): string {
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.type, (counts.get(r.type) ?? 0) + 1)
  const parts = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([type, n]) => `${type} ${n}`)
  const rest = counts.size > 5 ? ' 외' : ''
  return `${parts.join(' · ')}${rest} (총 ${rows.length}건)`
}

function ruleBullets(rows: Row[]): string[] {
  const out = rows.slice(0, 4).map(r => `${r.title}${r.userName ? ` (${r.userName})` : ''}`)
  if (rows.length > 4) out.push(`…외 ${rows.length - 4}건 — 자세한 내용은 기록 테이블에서`)
  return out
}

type AiTeamSection = { headline: string; bullets: string[] }

async function aiSections(byTeam: Map<string, Row[]>, label: string):
  Promise<Map<string, AiTeamSection> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null
  const today = new Date(Date.now() + KST).toISOString().slice(0, 10) // KST 기준 오늘 — 시제 구분용
  // 기록 내용은 자르지 않고 전부 넘긴다 — 모델이 전체 맥락을 읽고 종합하는 쪽이 요약 품질이 낫다.
  // (전체 분량은 fetchRows 의 take 400 이 이미 묶는다)
  const input = [...byTeam.entries()].map(([team, rows]) => {
    const lines = rows.slice(0, 120).map(r => {
      const body = r.content && (r.visibility ?? '공개') !== '제목만 공개' ? ` — ${r.content.replace(/\s+/g, ' ').trim()}` : ''
      const future = r.date > today ? ' (예정)' : ''
      const regDay = new Date(r.createdAt.getTime() + KST).toISOString().slice(0, 10)
      return `- ${r.title}${body} (${r.userName ?? '미상'}, ${r.type}, 수행일 ${r.date}${future}, 등록일 ${regDay})`
    })
    return `[${team}] 집계: ${statsLine(rows)}\n${lines.join('\n')}`
  }).join('\n\n')

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    // 팀·기록이 늘면 출력이 길어진다 — 상한이 낮으면 중간에 잘려 불릿이 사라진다
    max_tokens: 10000,

    messages: [{
      role: 'user',
      content:
        `다음은 ${label} 회사(EV&Solution) 업무시스템에 기록된 이번 주 활동들이다. 주간회의에서 `
        + '소리 내어 읽는 팀별 브리핑을 만들어라.\n'
        + '규칙:\n'
        + '- **개별 업무 제목을 그대로 옮겨 나열하는 것은 금지.** 집계줄과 기록 내용을 근거로,\n'
        + '  같은 성격의 일을 묶어 「무슨 일이 몇 건 규모로, 어떤 방향으로 진행되고 있는지」를\n'
        + '  종합한 서술 문장을 만든다.\n'
        + '  좋은 예: "신규영업 4건이 ○○·△△ 고객 중심으로 진행됐고, 그중 2건은 견적 단계로 넘어갔다"\n'
        + '  나쁜 예: "○○ 미팅 진행 (김OO)" 처럼 기록 한 줄을 그대로 옮긴 것\n'
        + '- 팀마다 「## 팀명」 헤더(입력의 [팀명] 과 글자 그대로 동일하게)를 쓰고, 그 아래\n'
        + '  첫 줄에 그 팀의 기간 전체를 관통하는 **한 줄 요약**(불릿 기호 없이, 1~2문장),\n'
        + '  이어서 「- 」로 시작하는 불릿 **최대 4개** (기록이 적으면 2개). 불릿 한 개는 1~2문장 —\n'
        + '  기록이 많아도 비슷한 일은 묶어서 4개 안에 압축하라 (한 줄 요약과 불릿을 합쳐 5줄 이내).\n'
        + '- **한 줄 요약은 정량 지표 중심으로 쓴다** — 건수·고객사 수·완료/예정 비율·금액·일정 등\n'
        + '  기록에서 셀 수 있는 숫자를 2개 이상 녹여라.\n'
        + '  좋은 예: "고객미팅 5건 중 3건이 신규 거래선(기아·세이로빈·실버종합물류)으로, 이번 주 NDA 1건·MOU 1건을 체결했다"\n'
        + '  나쁜 예: "거래선 확대와 실증 운영을 동시에 진행 중이다" (숫자 없는 추상 서술)\n'
        + '  단, 기록에서 셀 수 있는 숫자가 정말 없으면 억지로 지어내지 말고 추상 서술을 차선으로 쓴다.\n'
        + `- 오늘은 ${today} 이다. 기록마다 「수행일」(실제로 하는 날)과 「등록일」(기록을 남긴 날)이\n`
        + '  구분돼 있다. 시제는 반드시 **수행일** 기준: 수행일이 오늘 이전인 일은 「~했다/진행했다」,\n'
        + '  오늘 이후이거나 (예정) 표시가 있는 일은 「~할 예정이다/예정돼 있다」. 등록일은 시제에\n'
        + '  쓰지 말고, 미래 일을 미리 잡아둔 것임을 말할 때만 참고하라.\n'
        + '- 담당자 이름은 묶음의 대표로 필요할 때만 괄호. 수치·고객사·일정은 구체적으로.\n'
        + '- 과장·추측 금지, 기록에 있는 것만.\n'
        + '다른 말 없이 그 형식만 출력하라.\n\n' + input,
    }],
  })
  let text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
  if (!text.includes('##')) return null
  // 출력 상한에 걸려 잘렸으면 마지막 줄은 문장이 끊긴 상태 — 버린다
  if (msg.stop_reason === 'max_tokens') {
    const lines = text.split('\n')
    lines.pop()
    text = lines.join('\n')
    console.warn('[weekly-digest] AI 출력이 max_tokens 에 걸려 잘림 — 마지막 줄 제거')
  }

  const byName = new Map<string, AiTeamSection>()
  let current: AiTeamSection | null = null
  const BULLET = /^[-•*▸·]\s*/
  // 구분선·장식 줄(---, ===, ⸻ 등) — 불릿 기호를 떼고 나면 대시만 남아 「--」 불릿으로 오염된다
  const NOISE = /^[-–—=*_~\s]*$/
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (NOISE.test(line)) continue
    if (line.startsWith('## ')) {
      const name = line.slice(3).trim()
      if (name === '전체') { current = null; continue } // 구형식 출력 방어
      current = { headline: '', bullets: [] }
      byName.set(name, current)
    } else if (BULLET.test(line) && current) {
      const content = line.replace(BULLET, '').trim()
      if (!NOISE.test(content)) current.bullets.push(content)
    } else if (current) {
      // 불릿 기호 없는 줄 — 첫 줄은 팀 헤드라인, 그 뒤 줄글은 불릿으로 수용 (버리면 내용이 사라진다)
      const content = line.replace(/\*\*/g, '').trim()
      if (NOISE.test(content)) continue
      if (!current.headline && current.bullets.length === 0) current.headline = content
      else current.bullets.push(content)
    }
  }
  return byName.size > 0 ? byName : null
}

async function build(withAi = true): Promise<WeeklyDigest> {
  const now = new Date()
  const since = weekWindowStart(now)
  const rows = await fetchRows(since)
  const byTeam = groupByTeam(rows)

  let ai: Awaited<ReturnType<typeof aiSections>> = null
  let aiError: string | undefined
  if (withAi && rows.length > 0) {
    try {
      ai = await aiSections(byTeam, slotLabel(since))
      if (!ai) aiError = process.env.ANTHROPIC_API_KEY?.trim() ? '응답 형식 불일치' : 'ANTHROPIC_API_KEY 미설정'
    } catch (e) {
      ai = null
      aiError = e instanceof Error ? e.message.slice(0, 160) : String(e).slice(0, 160)
      console.error('[weekly-digest] AI 요약 실패:', aiError)
    }
  }

  const teams: DigestTeam[] = [...byTeam.entries()].map(([name, teamRows]) => {
    const sec = ai?.get(name)
    return {
      name,
      stats: statsLine(teamRows),
      headline: sec?.headline || undefined,
      bullets: sec?.bullets.slice(0, 4) ?? ruleBullets(teamRows), // 헤드라인 포함 5줄 이내
    }
  })

  return {
    windowStart: since.toISOString(),
    windowLabel: slotLabel(since),
    generatedAt: now.toISOString(),
    slotAt: slotStart(now).toISOString(),
    teams,
    activityCount: rows.length,
    teamCount: byTeam.size,
    peopleCount: new Set(rows.map(r => r.userName).filter(Boolean)).size,
    source: ai ? 'ai' : 'rule',
    aiError: ai ? undefined : aiError,
  }
}

/**
 * 브리핑 조회 — 정각 슬롯 캐시 (업무시간 매시 정각 / 그 외 3시간 격자).
 * 같은 슬롯 안이면 항상 캐시를 그대로 돌려준다(새로고침 버튼 포함 — AI 재호출 없음).
 * 슬롯이 바뀌면 재생성하되, 일반 화면 로드(waitFresh=false)는 기존 캐시를 먼저 보여주며
 * 뒤에서 갱신하고, 새로고침 버튼(waitFresh=true)은 새 결과가 나올 때까지 기다린다.
 */
export async function weeklyDigest(waitFresh = false): Promise<WeeklyDigest> {
  const sameSlot = (d: WeeklyDigest | null) => !!d
    && d.slotAt === slotStart().toISOString()
    && d.windowStart === weekWindowStart().toISOString()
  // 재시작·배포 직후엔 DB의 마지막 생성본부터 복원 — 목록 폴백 대신 AI 요약을 즉시 띄운다
  if (!cache) cache = await loadStored()
  // 이번 슬롯에서 AI 요약까지 끝난(또는 실패가 확정된) 캐시 — 그대로 쓴다
  if (sameSlot(cache) && (cache!.source === 'ai' || cache!.aiError)) return cache!
  if (!refreshing) {
    refreshing = build(true)
      .then(d => { cache = d; void store(d); return d })
      .finally(() => { refreshing = null })
  }
  if (waitFresh) return refreshing
  // 화면 로드는 절대 AI 호출을 기다리지 않는다 — 마지막 생성본(이전 슬롯이어도)을 먼저 보여주고
  // 새 슬롯 버전은 뒤에서 완성되면 교체된다. 생성본이 아예 없을 때만 집계 버전을 즉시 만든다.
  if (cache) return cache
  cache = await build(false)
  return cache
}
