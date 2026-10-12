/**
 * 사내 스킬(EVNSolution/EVn_Skills) 브릿지 (서버측, 읽기 전용).
 *
 * GitHub Contents API 로 private repo 를 읽는다 — 토큰은 env EVN_SKILLS_GITHUB_TOKEN
 * (SSM app-env 에 소유자가 추가; 없으면 스킬 도구가 안내 메시지를 낸다).
 * 호출마다 GitHub 를 때리지 않도록 5분 메모리 캐시를 둔다.
 */

const REPO = 'EVNSolution/EVn_Skills'
const API = `https://api.github.com/repos/${REPO}/contents`

const NO_TOKEN_MSG =
  '사내 스킬 저장소 접근 토큰이 서버에 설정되어 있지 않습니다 — 관리자에게 '
  + 'EVN_SKILLS_GITHUB_TOKEN 설정을 요청하세요. (스킬 외 기능은 정상 동작합니다)'

const CACHE_TTL_MS = 5 * 60_000
const cache = new Map<string, { at: number; value: unknown }>()

async function gh(path: string): Promise<any> {
  const token = process.env.EVN_SKILLS_GITHUB_TOKEN?.trim()
  if (!token) throw new Error(NO_TOKEN_MSG)
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'warp-mcp' },
    signal: AbortSignal.timeout(15_000),
  })
  if (res.status === 401 || res.status === 403) throw new Error('사내 스킬 저장소 접근이 거부되었습니다 — 서버 토큰 권한을 확인해 주세요.')
  if (res.status === 404) throw new Error('사내 스킬 저장소에서 해당 항목을 찾을 수 없습니다.')
  if (!res.ok) throw new Error(`사내 스킬 저장소 오류 (${res.status})`)
  const value = await res.json()
  cache.set(path, { at: Date.now(), value })
  return value
}

/** SKILL.md 프런트매터에서 name·description 만 뽑는다. */
function parseFrontmatter(md: string): { name?: string; description?: string } {
  if (!md.startsWith('---')) return {}
  const end = md.indexOf('\n---', 3)
  if (end < 0) return {}
  const head = md.slice(3, end)
  const get = (key: string) => {
    const m = head.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
    if (!m) return undefined
    let v = m[1].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    return v
  }
  return { name: get('name'), description: get('description') }
}

async function readFileContent(path: string): Promise<string> {
  const r = await gh(path)
  if (r.content && r.encoding === 'base64') return Buffer.from(r.content, 'base64').toString('utf8')
  throw new Error('파일을 읽을 수 없습니다.')
}

export async function listSkills(): Promise<Array<{ name: string; description: string }>> {
  const entries = await gh('/skills') as Array<{ name: string; type: string }>
  const dirs = entries.filter(e => e.type === 'dir').map(e => e.name)
  const out: Array<{ name: string; description: string }> = []
  for (const dir of dirs) {
    try {
      const md = await readFileContent(`/skills/${dir}/SKILL.md`)
      const fm = parseFrontmatter(md)
      out.push({ name: fm.name ?? dir, description: fm.description ?? '(설명 없음)' })
    } catch { /* SKILL.md 없는 폴더는 건너뛴다 */ }
  }
  if (out.length === 0) throw new Error('사용 가능한 사내 스킬이 없습니다.')
  return out
}

export async function loadSkill(name: string): Promise<{ content: string; files: string[] }> {
  if (!/^[a-z0-9-]+$/i.test(name)) throw new Error(`잘못된 스킬 이름: ${name}`)
  const content = await readFileContent(`/skills/${name}/SKILL.md`)
  let files: string[] = []
  try {
    const entries = await gh(`/skills/${name}`) as Array<{ name: string; type: string }>
    files = entries.map(e => e.type === 'dir' ? `${e.name}/` : e.name)
  } catch { /* 목록 실패해도 지침은 반환 */ }
  return { content, files }
}
