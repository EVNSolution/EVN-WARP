// 사용자 관리(추가/수정/세부정보 열람) 권한이 있는 팀
const USER_MANAGER_TEAMS = ['경영관리팀', '경영진']

export function canManageUsers(user: { teamName?: string | null } | null | undefined): boolean {
  return !!user?.teamName && USER_MANAGER_TEAMS.includes(user.teamName)
}
