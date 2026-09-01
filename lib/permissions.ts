import { prisma } from '@/lib/db'

// 사용자 관리(추가/수정/세부정보 열람) 권한이 있는 팀
const USER_MANAGER_TEAMS = ['경영관리팀', '경영진']

// admin·대표이사(CEO) — 소속팀과 무관하게 모든 권한 보유
export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'ceo'
}

/**
 * 세션의 teamName(JWT)은 로그인 시점에 발급되어 팀 변경 후 재로그인 전까지 stale할 수 있으므로,
 * 매번 DB에서 최신 소속팀을 조회해 판단한다.
 */
// 영업 파이프라인 전체 열람 권한: admin·ceo 또는 '경영진' 팀
export async function canViewAllLeads(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, team: { select: { name: true } } } })
  if (!user) return false
  if (user.role === 'admin' || user.role === 'ceo') return true
  return user.team?.name === '경영진'
}

export async function canManageUsers(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, team: { select: { name: true } } } })
  if (!user) return false
  // admin·대표이사(CEO)는 소속팀과 무관하게 모든 관리 권한을 가짐
  if (user.role === 'admin' || user.role === 'ceo') return true
  const teamName = user.team?.name
  return !!teamName && USER_MANAGER_TEAMS.includes(teamName)
}
