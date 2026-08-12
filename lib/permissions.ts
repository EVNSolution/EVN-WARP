import { prisma } from '@/lib/db'

// 사용자 관리(추가/수정/세부정보 열람) 권한이 있는 팀
const USER_MANAGER_TEAMS = ['경영관리팀', '경영진']

/**
 * 세션의 teamName(JWT)은 로그인 시점에 발급되어 팀 변경 후 재로그인 전까지 stale할 수 있으므로,
 * 매번 DB에서 최신 소속팀을 조회해 판단한다.
 */
export async function canManageUsers(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { team: { select: { name: true } } } })
  const teamName = user?.team?.name
  return !!teamName && USER_MANAGER_TEAMS.includes(teamName)
}
