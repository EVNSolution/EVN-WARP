/**
 * 중복 팀 정리 스크립트
 * 같은 name을 가진 Team 중 첫 번째(생성 순)를 남기고
 * 나머지는 연관 레코드를 이전한 뒤 삭제합니다.
 */
import { prisma } from '../lib/db'

async function main() {
  const allTeams = await prisma.team.findMany({ orderBy: { createdAt: 'asc' } })

  // 이름별로 그룹화
  const byName = new Map<string, typeof allTeams>()
  for (const t of allTeams) {
    const key = t.name.trim()
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key)!.push(t)
  }

  let mergedCount = 0
  for (const [name, group] of byName.entries()) {
    if (group.length <= 1) continue

    const keep   = group[0]          // 가장 먼저 생성된 팀을 유지
    const remove = group.slice(1)    // 나머지 삭제
    console.log(`\n[중복] "${name}" — 유지: ${keep.id}, 삭제: ${remove.map(r => r.id).join(', ')}`)

    for (const dup of remove) {
      // 연관 레코드를 keep 팀으로 이전
      const [st, wu, wa, usr] = await Promise.all([
        prisma.strategyTask.updateMany({ where: { teamId: dup.id }, data: { teamId: keep.id } }),
        prisma.weeklyUpdate.updateMany( { where: { teamId: dup.id }, data: { teamId: keep.id } }),
        prisma.workActivity.updateMany( { where: { teamId: dup.id }, data: { teamId: keep.id } }),
        prisma.user.updateMany(         { where: { teamId: dup.id }, data: { teamId: keep.id } }),
      ])
      console.log(`  이전: StrategyTask=${st.count}, WeeklyUpdate=${wu.count}, WorkActivity=${wa.count}, User=${usr.count}`)

      await prisma.team.delete({ where: { id: dup.id } })
      console.log(`  삭제 완료: ${dup.id}`)
      mergedCount++
    }
  }

  if (mergedCount === 0) {
    console.log('중복 팀 없음 — 정리할 항목이 없습니다.')
  } else {
    console.log(`\n완료: 중복 팀 ${mergedCount}개 삭제됨`)
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
