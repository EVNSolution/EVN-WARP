import { prisma } from '@/lib/db'

/**
 * 주간회의 브리핑 — 매주 월/목 오전 10시 주간회의에서 "지난 회의 이후 WARP에 기록된 일"을
 * 팀별로 읽어주는 요약. AI 업무 기록 화면의 브리핑 카드가 쓴다.
 *
 * 기간: 직전 회의 시각(월/목 10:00 KST, 진행 중인 회의는 직전 회의로) ~ 지금.
 * 1차: Claude(Haiku)가 팀별 핵심을 불릿으로 요약. 폴백: 팀별 원문 목록.
 * 캐시 30분 + 수동 새로고침(회의 중 실시간 갱신용). 비공개 활동 제외, 제목만 공개는 제목만.
 */

export interface WeeklyDigest {
  windowStart: string // ISO
  windowLabel: string // "10/9(목) 10:00 이후"
  generatedAt: string
  text: string        // '## 팀명' 헤더 + '- ' 불릿 형식
  activityCount: number
  teamCount: number
  peopleCount: number
  source: 'ai' | 'rule'
}

const TTL = 30 * 60_000
let cache: WeeklyDigest | null = null
let refreshing: Promise<WeeklyDigest> | null = null

const KST = 9 * 3600_000
const DOW_LABEL = ['일', '월', '화', '수', '목', '금', '토']

/** 직전 주간회의(월/목 10:00 KST) 시각 — 회의 시작 후 2시간까지는 "이번 회의"로 보고 그 전 회의를 기준으로 한다. */
export function previousMeetingSlot(now = new Date()): Date {
  const slots: Date[] = []
  for (let back = 0; back < 10; back++) {
    const d = new Date(now.getTime() + KST)
    d.setUTCDate(d.getUTCDate() - back)
    const dow = d.getUTCDay()
    if (dow === 1 || dow === 4) { // 월, 목
      const slot = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 10, 0) - KST)
      if (slot.getTime() + 2 * 3600_000 <= now.getTime()) slots.push(slot)
    }
    if (slots.length >= 1) break
  }
  return slots[0] ?? new Date(now.getTime() - 4 * 86400_000)
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
  task: { title: string } | null
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
      task: { select: { title: true } },
    },
  })
}

function groupByTeam(rows: Row[]): Map<string, Row[]> {
  const byTeam = new Map<string, Row[]>()
  for (const r of rows) {
    const t = r.team?.name ?? '기타'
    const arr = byTeam.get(t) ?? []
    arr.push(r)
    byTeam.set(t, arr)
  }
  return byTeam
}

function ruleText(byTeam: Map<string, Row[]>): string {
  const parts: string[] = []
  for (const [team, rows] of byTeam) {
    parts.push(`## ${team}`)
    for (const r of rows.slice(0, 12)) {
      const who = r.userName ? ` (${r.userName})` : ''
      parts.push(`- ${r.title}${who} — ${r.date}${r.startTime ? ` ${r.startTime}` : ''}, ${r.type}`)
    }
    if (rows.length > 12) parts.push(`- …외 ${rows.length - 12}건`)
  }
  return parts.join('\n')
}

async function aiText(byTeam: Map<string, Row[]>, label: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null
  const input = [...byTeam.entries()].map(([team, rows]) => {
    const lines = rows.slice(0, 40).map(r => {
      const body = r.content && (r.visibility ?? '공개') !== '제목만 공개' ? ` — ${r.content.slice(0, 100)}` : ''
      return `- ${r.title}${body} (${r.userName ?? '미상'}, ${r.type}, 수행일 ${r.date})`
    })
    return `[${team}]\n${lines.join('\n')}`
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
        + '소리 내어 읽기 좋은 팀별 브리핑을 만들어라.\n'
        + '- 팀마다 「## 팀명」 헤더 아래 핵심 2~5개를 「- 」 불릿으로. 같은 주제는 묶어서.\n'
        + '- 각 불릿은 한 문장, 담당자 이름을 괄호로. 수치·고객사·일정은 구체적으로 유지.\n'
        + '- 과장·추측 금지, 기록에 있는 것만. 중요도 순으로.\n'
        + '- 맨 위에 「## 전체」 헤더로 이번 기간을 관통하는 한 줄 헤드라인 1개.\n'
        + '다른 말 없이 그 형식만 출력하라.\n\n' + input,
    }],
  })
  const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
  return text.includes('##') ? text : null
}

async function build(): Promise<WeeklyDigest> {
  const now = new Date()
  const since = previousMeetingSlot(now)
  const rows = await fetchRows(since)
  const byTeam = groupByTeam(rows)
  let text: string | null = null
  let source: 'ai' | 'rule' = 'rule'
  if (rows.length > 0) {
    try { text = await aiText(byTeam, slotLabel(since)) } catch { text = null }
    if (text) source = 'ai'
    else text = ruleText(byTeam)
  } else {
    text = '지난 회의 이후 기록된 활동이 아직 없습니다.'
  }
  return {
    windowStart: since.toISOString(),
    windowLabel: slotLabel(since),
    generatedAt: now.toISOString(),
    text,
    activityCount: rows.length,
    teamCount: byTeam.size,
    peopleCount: new Set(rows.map(r => r.userName).filter(Boolean)).size,
    source,
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
  // 캐시가 있으면 기다리지 않고 이전 것을 보여준다 (강제 새로고침은 기다린다)
  if (!force && cache) return cache
  return refreshing
}
