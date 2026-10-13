import { prisma } from '@/lib/db'

/**
 * 업무 키워드 집계 — 공개된 업무 기록(제목·내용)에서 주요 키워드를 추출한다.
 * AI 업무 기록의 「업무 온톨로지」 뷰가 쓴다. 형태소 분석기 없이 가는 가벼운 규칙:
 * 토큰화 → 조사/어미 접미 제거 → 불용어 제외 → 빈도 집계 (제목 가중 2배).
 * 비공개 활동은 제외하고, 「제목만 공개」는 제목만 쓴다. 결과는 1시간 캐시.
 */

const STOPWORDS = new Set([
  '진행', '완료', '관련', '업무', '작업', '요청', '확인', '내용', '처리', '예정',
  '오늘', '내일', '금일', '사항', '부분', '통해', '추가', '기타', '해당', '위한',
  '위해', '대한', '대해', '이후', '이전', '관리', '그리고', '하는', '있는', '없는',
  '합니다', '했습니다', '입니다', '정도', '경우', '관하', '각각', '모든', '일부',
])

// 긴 것부터 — 남는 글자가 2자 이상일 때만 떼어낸다 ('회의'의 '의'까지 떼지 않게)
const SUFFIXES = [
  '으로부터', '에서의', '습니다', '합니다', '입니다', '했습니다',
  '에서', '에게', '까지', '부터', '하고', '했다', '하기', '했음', '한다', '으로',
  '들', '의', '를', '을', '이', '가', '은', '는', '에', '와', '과', '도', '로',
]

function normalizeToken(raw: string): string | null {
  let t = raw
  for (let pass = 0; pass < 2; pass++) {
    const hit = SUFFIXES.find(s => t.endsWith(s) && t.length - s.length >= 2)
    if (!hit) break
    t = t.slice(0, t.length - hit.length)
  }
  if (t.length < 2) return null
  if (/^\d+$/.test(t)) return null // 순수 숫자 제외 (PV5 같은 영숫자 혼합은 유지)
  if (STOPWORDS.has(t)) return null
  return t
}

function countInto(map: Map<string, number>, text: string, weight: number): void {
  for (const raw of text.split(/[^0-9A-Za-z가-힣]+/)) {
    if (!raw) continue
    const t = normalizeToken(raw)
    if (t) map.set(t, (map.get(t) ?? 0) + weight)
  }
}

export interface WorkKeyword { word: string; count: number }

let cache: { at: number; data: WorkKeyword[]; total: number } | null = null
const CACHE_TTL = 60 * 60_000

/** 최근 90일 공개 활동에서 상위 키워드를 집계한다 (1시간 캐시). */
export async function workKeywords(): Promise<{ keywords: WorkKeyword[]; total: number }> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return { keywords: cache.data, total: cache.total }

  const from = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10)
  const rows = await prisma.workActivity.findMany({
    where: { date: { gte: from }, NOT: { visibility: '전체 비공개' } },
    orderBy: { createdAt: 'desc' },
    take: 3000,
    select: { title: true, content: true, visibility: true },
  })

  const counts = new Map<string, number>()
  for (const r of rows) {
    countInto(counts, r.title, 2)
    if (r.content && (r.visibility ?? '공개') !== '제목만 공개') countInto(counts, r.content, 1)
  }

  const data = [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([word, count]) => ({ word, count }))

  cache = { at: Date.now(), data, total: rows.length }
  return { keywords: data, total: rows.length }
}
