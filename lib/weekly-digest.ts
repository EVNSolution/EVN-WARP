import { prisma } from '@/lib/db'

/**
 * 주간회의 브리핑 — 매주 월/목 오전 10시 주간회의에서 "지난 회의 이후 WARP에 기록된 일"을
 * 팀별로 읽어주는 요약. AI 업무 기록 화면의 브리핑 카드가 쓴다.
 *
 * 기간: 직전 회의 시각(월/목 10:00 KST, 진행 중인 회의는 직전 회의로) ~ 지금.
 * 팀 구분: 사람 소속이 아니라 「연계 과제의 팀」 — 독립활동·전사과제 직접 연계는 「공통」.
 * 구조: 팀마다 서버가 계산한 유형별 집계줄(신규영업 N·고객미팅 M…) + AI(Haiku)의 종합 서술
 * 불릿 3~5개. AI 실패 시 불릿은 대표 업무 몇 건으로 폴백하되 집계줄은 항상 나온다.
 * 캐시 30분 + 수동 새로고침(회의 중 실시간 갱신용). 비공개 활동 제외, 제목만 공개는 제목만.
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
  teams: DigestTeam[]
  activityCount: number
  teamCount: number
  peopleCount: number
  source: 'ai' | 'rule'
  /** AI 요약 실패 시 원인 (키 오류·크레딧 부족 진단용 — 비밀값 없음) */
  aiError?: string
}

const TTL = 30 * 60_000
let cache: WeeklyDigest | null = null
let refreshing: Promise<WeeklyDigest> | null = null

const KST = 9 * 3600_000
const DOW_LABEL = ['일', '월', '화', '수', '목', '금', '토']

/** 직전 주간회의(월/목 10:00 KST) 시각 — 회의 시작 후 2시간까지는 "이번 회의"로 보고 그 전 회의를 기준으로 한다. */
export function previousMeetingSlot(now = new Date()): Date {
  for (let back = 0; back < 10; back++) {
    const d = new Date(now.getTime() + KST)
    d.setUTCDate(d.getUTCDate() - back)
    const dow = d.getUTCDay()
    if (dow === 1 || dow === 4) { // 월, 목
      const slot = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 10, 0) - KST)
      if (slot.getTime() + 2 * 3600_000 <= now.getTime()) return slot
    }
  }
  return new Date(now.getTime() - 4 * 86400_000)
}

function slotLabel(slot: Date): string {
  const k = new Date(slot.getTime() + KST)
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()}(${DOW_LABEL[k.getUTCDay()]}) 10:00 이후`
}

type Row = {
  title: string; content: string | null; type: string; date: string
  userName: string | null; visibility: string | null
  startTime: string | null
  team: { name: string } | null
  task: { title: string; parentId: string | null; team: { name: string } | null } | null
}

async function fetchRows(since: Date): Promise<Row[]> {
  return prisma.workActivity.findMany({
    where: { createdAt: { gte: since }, NOT: { visibility: '전체 비공개' } },
    orderBy: [{ teamId: 'asc' }, { createdAt: 'asc' }],
    take: 400,
    select: {
      title: true, content: true, type: true, date: true, userName: true, visibility: true,
      startTime: true,
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
  const input = [...byTeam.entries()].map(([team, rows]) => {
    const lines = rows.slice(0, 40).map(r => {
      const body = r.content && (r.visibility ?? '공개') !== '제목만 공개' ? ` — ${r.content.slice(0, 100)}` : ''
      const future = r.date > today ? ' (예정)' : ''
      return `- ${r.title}${body} (${r.userName ?? '미상'}, ${r.type}, 수행일 ${r.date}${future})`
    })
    return `[${team}] 집계: ${statsLine(rows)}\n${lines.join('\n')}`
  }).join('\n\n')

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content:
        `다음은 ${label} 회사(EV&Solution) 업무시스템에 기록된 활동들이다. 월/목 주간회의에서 `
        + '소리 내어 읽는 팀별 브리핑을 만들어라.\n'
        + '규칙:\n'
        + '- **개별 업무 제목을 그대로 옮겨 나열하는 것은 금지.** 집계줄과 기록 내용을 근거로,\n'
        + '  같은 성격의 일을 묶어 「무슨 일이 몇 건 규모로, 어떤 방향으로 진행되고 있는지」를\n'
        + '  종합한 서술 문장을 만든다.\n'
        + '  좋은 예: "신규영업 4건이 ○○·△△ 고객 중심으로 진행됐고, 그중 2건은 견적 단계로 넘어갔다"\n'
        + '  나쁜 예: "○○ 미팅 진행 (김OO)" 처럼 기록 한 줄을 그대로 옮긴 것\n'
        + '- 팀마다 「## 팀명」 헤더(입력의 [팀명] 과 글자 그대로 동일하게)를 쓰고, 그 아래\n'
        + '  첫 줄에 그 팀의 기간 전체를 관통하는 **한 줄 요약**(불릿 기호 없이), 이어서 불릿 3~5개\n'
        + '  (기록이 적으면 2개).\n'
        + `- 오늘은 ${today} 이다. 수행일이 오늘 이전인 일은 「~했다/진행했다」, 오늘 이후이거나\n`
        + '  (예정) 표시가 있는 일은 「~할 예정이다/예정돼 있다」로 시제를 반드시 구분해 서술하라.\n'
        + '- 담당자 이름은 묶음의 대표로 필요할 때만 괄호. 수치·고객사·일정은 구체적으로.\n'
        + '- 과장·추측 금지, 기록에 있는 것만.\n'
        + '다른 말 없이 그 형식만 출력하라.\n\n' + input,
    }],
  })
  const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
  if (!text.includes('##')) return null

  const byName = new Map<string, AiTeamSection>()
  let current: AiTeamSection | null = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('## ')) {
      const name = line.slice(3).trim()
      if (name === '전체') { current = null; continue } // 구형식 출력 방어
      current = { headline: '', bullets: [] }
      byName.set(name, current)
    } else if (line.startsWith('- ') && current) {
      current.bullets.push(line.slice(2).trim())
    } else if (line && current && !current.headline && current.bullets.length === 0) {
      current.headline = line.replace(/\*\*/g, '').trim()
    }
  }
  return byName.size > 0 ? byName : null
}

async function build(): Promise<WeeklyDigest> {
  const now = new Date()
  const since = previousMeetingSlot(now)
  const rows = await fetchRows(since)
  const byTeam = groupByTeam(rows)

  let ai: Awaited<ReturnType<typeof aiSections>> = null
  let aiError: string | undefined
  if (rows.length > 0) {
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
      bullets: sec?.bullets.slice(0, 5) ?? ruleBullets(teamRows),
    }
  })

  return {
    windowStart: since.toISOString(),
    windowLabel: slotLabel(since),
    generatedAt: now.toISOString(),
    teams,
    activityCount: rows.length,
    teamCount: byTeam.size,
    peopleCount: new Set(rows.map(r => r.userName).filter(Boolean)).size,
    source: ai ? 'ai' : 'rule',
    aiError: ai ? undefined : aiError,
  }
}

/** 브리핑 조회 — 30분 캐시. force=true(새로고침 버튼)면 즉시 재생성한다. */
export async function weeklyDigest(force = false): Promise<WeeklyDigest> {
  const freshEnough = cache
    && Date.now() - new Date(cache.generatedAt).getTime() < TTL
    && cache.windowStart === previousMeetingSlot().toISOString()
  if (!force && freshEnough) return cache!
  if (!refreshing) {
    refreshing = build()
      .then(d => { cache = d; return d })
      .finally(() => { refreshing = null })
  }
  if (!force && cache) return cache
  return refreshing
}
