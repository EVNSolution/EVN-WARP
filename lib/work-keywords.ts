import { prisma } from '@/lib/db'

/**
 * 업무 키워드 집계 — 공개된 업무 기록(제목·내용)에서 「실제로 어떤 업무가 많은지」를
 * 보여주는 주제 키워드를 뽑는다. AI 업무 기록의 「업무 온톨로지」 뷰가 쓴다.
 *
 * 1차: Claude(Haiku)에게 선별을 맡긴다 — 고객사·제품·프로젝트·업무 주제 위주,
 *      '점검/수집/작성' 같은 일반 동작 단어와 사람 이름은 제외하고 비중(weight)을 매긴다.
 * 폴백: API 키가 없거나 호출 실패 시 규칙 기반(토큰 빈도) 추출.
 * 캐시 6시간, stale-while-revalidate (화면은 기다리지 않는다). 서버 기동 시 예열.
 */

export interface WorkKeyword { word: string; weight: number }
export interface WorkKeywordResult { keywords: WorkKeyword[]; total: number; source: 'ai' | 'rule' }

const TTL = 6 * 60 * 60_000
let cache: (WorkKeywordResult & { at: number }) | null = null
let refreshing = false

type Row = { title: string; content: string | null; visibility: string | null }

async function fetchRows(): Promise<Row[]> {
  const from = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10)
  return prisma.workActivity.findMany({
    where: { date: { gte: from }, NOT: { visibility: '전체 비공개' } },
    orderBy: { createdAt: 'desc' },
    take: 1000,
    select: { title: true, content: true, visibility: true },
  })
}

// ── 폴백: 규칙 기반 (토큰 빈도) ─────────────────────────────────────────────
const STOPWORDS = new Set([
  '진행', '완료', '관련', '업무', '작업', '요청', '확인', '내용', '처리', '예정',
  '오늘', '내일', '금일', '사항', '부분', '통해', '추가', '기타', '해당', '위한',
  '위해', '대한', '대해', '이후', '이전', '관리', '점검', '수집', '작성', '정리',
  '등록', '발행', '전달', '공유', '검토', '회의', '미팅', '경우', '정도',
])
const SUFFIXES = [
  '으로부터', '에서의', '습니다', '합니다', '입니다',
  '에서', '에게', '까지', '부터', '하고', '했다', '하기', '했음', '한다', '으로',
  '들', '의', '를', '을', '이', '가', '은', '는', '에', '와', '과', '도', '로',
]

function ruleKeywords(rows: Row[]): WorkKeyword[] {
  const counts = new Map<string, number>()
  const countInto = (text: string, weight: number) => {
    for (const raw of text.split(/[^0-9A-Za-z가-힣]+/)) {
      let t = raw
      for (let p = 0; p < 2; p++) {
        const hit = SUFFIXES.find(s => t.endsWith(s) && t.length - s.length >= 2)
        if (!hit) break
        t = t.slice(0, t.length - hit.length)
      }
      if (t.length < 2 || /^\d+$/.test(t) || STOPWORDS.has(t)) continue
      counts.set(t, (counts.get(t) ?? 0) + weight)
    }
  }
  for (const r of rows) {
    countInto(r.title, 2)
    if (r.content && (r.visibility ?? '공개') !== '제목만 공개') countInto(r.content, 1)
  }
  const top = [...counts.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 25)
  const max = top[0]?.[1] ?? 1
  return top.map(([word, c]) => ({ word, weight: Math.max(5, Math.round((c / max) * 100)) }))
}

// ── 1차: Claude 선별 ─────────────────────────────────────────────────────────
async function aiKeywords(rows: Row[]): Promise<WorkKeyword[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey || rows.length < 10) return null

  const lines = rows.slice(0, 600).map(r => {
    const body = r.content && (r.visibility ?? '공개') !== '제목만 공개' ? ` — ${r.content.slice(0, 80)}` : ''
    return `- ${r.title}${body}`
  }).join('\n')

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content:
        '다음은 회사(EV&Solution)의 최근 업무 기록 목록이다. "이 회사에서 실제로 어떤 업무가 많이 '
        + '이루어지는지"를 한눈에 보여주는 키워드 지도를 만들려 한다.\n'
        + '- 고객사명, 제품/프로젝트명, 기술·문서·사업 주제 등 구체적인 업무 대상을 뽑아라.\n'
        + '- "점검, 수집, 작성, 진행, 요청, 확인" 같은 일반 동작 단어, 날짜, 사람 이름은 제외.\n'
        + '- 비슷한 표현은 하나로 합쳐라 (예: 견적/견적서 → 견적).\n'
        + '- 15~22개를 뽑고, 각 키워드의 상대 비중 weight 를 1~100 으로 매겨라 (분포가 넓게).\n'
        + 'JSON 배열만 출력하라: [{"word":"...","weight":90},...]\n\n'
        + lines,
    }],
  })
  const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('')
  const jsonStr = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)
  const parsed = JSON.parse(jsonStr) as Array<{ word?: unknown; weight?: unknown }>
  const keywords = parsed
    .map(k => ({ word: String(k.word ?? '').trim(), weight: Math.min(100, Math.max(1, Number(k.weight) || 1)) }))
    .filter(k => k.word.length >= 2 && k.word.length <= 20)
    .slice(0, 25)
  return keywords.length >= 5 ? keywords : null
}

async function compute(): Promise<WorkKeywordResult & { at: number }> {
  const rows = await fetchRows()
  let keywords: WorkKeyword[] | null = null
  try { keywords = await aiKeywords(rows) } catch { keywords = null }
  if (keywords) return { at: Date.now(), keywords, total: rows.length, source: 'ai' }
  return { at: Date.now(), keywords: ruleKeywords(rows), total: rows.length, source: 'rule' }
}

function kickRefresh(): void {
  if (refreshing) return
  refreshing = true
  compute()
    .then(r => { cache = r })
    .catch(() => {})
    .finally(() => { refreshing = false })
}

/** 키워드 집계 — 캐시가 있으면 즉시 반환하고 뒤에서 갱신한다 (화면을 기다리게 하지 않음). */
export async function workKeywords(): Promise<WorkKeywordResult> {
  if (cache && Date.now() - cache.at < TTL) return cache
  if (cache) { kickRefresh(); return cache }
  // 최초 호출 — 규칙 기반을 즉시 내보내고 AI 선별은 백그라운드로 채운다
  const rows = await fetchRows()
  cache = { at: 0, keywords: ruleKeywords(rows), total: rows.length, source: 'rule' }
  kickRefresh()
  return cache
}
