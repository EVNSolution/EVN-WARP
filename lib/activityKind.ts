// 활동 유형의 성격 구분 — 📅 일정(시간이 중요, 캘린더 시간축) / 📝 업무 기록(무엇을 했나, 사람별 목록)
// 입력·저장·주간업무 집계는 그대로이며, 활동 추가 화면의 유형 배치와 업무공간 캘린더 표시 방식에만 쓴다.

export type ActivitySection = {
  key: 'schedule' | 'work' | 'hr'
  icon: string
  label: string
  hint: string
  categories: readonly { label: string; types: readonly string[] }[]
}

export const ACTIVITY_SECTIONS: readonly ActivitySection[] = [
  {
    key: 'schedule', icon: '📅', label: '일정', hint: '캘린더 시간축에 표시',
    categories: [
      { label: '커뮤니케이션',  types: ['내부회의', '외부미팅', '전화·통화', '화상회의'] },
      { label: '현장·이동',     types: ['국내출장', '해외출장'] },
      { label: '발표·행사',     types: ['발표/전시·행사'] },
      { label: '학습',          types: ['교육/연수', '세미나·컨퍼런스'] },
      { label: '현장서비스',    types: ['AS출동', '설치·시운전', '정기점검'] },
      { label: '영업',          types: ['고객미팅', '신규영업', '고객행사'] },
      { label: '관계·네트워킹', types: ['인재영입', '외부 네트워킹', '파트너십 타진'] },
      { label: '투자·IR',       types: ['IR 발표', '투자자 미팅', '투자행사'] },
    ],
  },
  {
    key: 'work', icon: '📝', label: '업무 기록', hint: '캘린더에서 사람별 업무 목록으로 표시',
    categories: [
      { label: '업무산출물',    types: ['문서·자료작성', '개발·구현', '도면·설계', '제품제작·조립', '콘텐츠·디자인'] },
      { label: '소통·제안',     types: ['이메일', '제안/견적'] },
      { label: '수주·발행',     types: ['견적서 발행', 'PO 발행', '수주 확정', '세금계산서 발행'] },
      { label: '경영·행정',     types: ['대관·신청', '세무·회계', '신고·갱신', '법무·계약', '경영기획'] },
    ],
  },
  {
    key: 'hr', icon: '', label: 'HR', hint: '',
    categories: [
      { label: 'HR',            types: ['연차', '반차(오전)', '반차(오후)', '재직증명서'] },
    ],
  },
]

export const ACTIVITY_CATEGORIES = ACTIVITY_SECTIONS.flatMap(s => s.categories)

const WORK_RECORD_TYPES = new Set<string>(
  ACTIVITY_SECTIONS.find(s => s.key === 'work')!.categories.flatMap(c => c.types),
)

/** 업무 기록 성격의 활동인가 (캘린더 시간축 대신 사람별 업무 목록에 표시) */
export function isWorkRecord(type: string): boolean {
  return WORK_RECORD_TYPES.has(type)
}
