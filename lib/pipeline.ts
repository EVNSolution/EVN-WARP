export interface PipelineCheck {
  key: string
  label: string
  field?: string      // 고객 데이터 연동 필드 ('vehicle' | 'shipper')
  opts?: string[]     // 칩 선택형 항목 옵션
  extLink?: string    // 외부 시스템 연계 버튼 식별자
  upload?: string     // 인라인 파일 업로드 docKey
  uploadLabel?: string
  noteLabel?: string  // 체크 시 표시할 메모 입력란 레이블
}

export interface PipelineDocument {
  key: string   // 고유 키 (영문, 예: "id_card")
  label: string // 표시 이름 (예: "신분증")
}

export interface PipelineProcess {
  code: string       // "1-1", "1-2", ...
  name: string
  checks: PipelineCheck[]
  checksB2B?: PipelineCheck[]  // B2B 전용 체크리스트 (없으면 checks 사용)
  documents: PipelineDocument[]
  target: number
}

export interface PipelinePhase {
  phase: number
  name: string
  color: string      // tailwind bg color class
  textColor: string
  processes: PipelineProcess[]
}

export const PIPELINE: PipelinePhase[] = [
  {
    phase: 1, name: '영업', color: 'bg-blue-700', textColor: 'text-blue-700',
    processes: [
      {
        code: '1-1', name: '미성숙 리드', target: 20,
        checks: [
          { key: '1-1-0', label: '일반화물자동차운송업 확보' },
        ],
        documents: [
          { key: 'freight_permit',   label: '화물자동차 운송사업 영업소허가증' },
          { key: 'company_intro',    label: '회사소개자료' },
        ],
      },
      {
        code: '1-2', name: '잠재 리드', target: 10,
        checks: [
          { key: '1-2-0', label: '차량정보 확보',   field: 'vehicle' },
          { key: '1-2-1', label: '화주정보 확보',   field: 'shipper' },
          { key: '1-2-3', label: '연락 가능' },
          { key: '1-2-2', label: '구매의향 확인', noteLabel: '구매의향 근거' },
        ],
        checksB2B: [
          { key: '1-2-b2b-0', label: '담당자 신뢰 확보' },
          { key: '1-2-b2b-1', label: '법인 매출 확인', field: 'b2bRevenue' },
          { key: '1-2-b2b-2', label: 'EV& 회사소개 완료' },
        ],
        documents: [],
      },
      {
        code: '1-3', name: '성숙 리드', target: 3,
        checks: [
          { key: '1-3-0', label: '구매예상시점 확정', opts: ['3개월 이내', '6개월 이내', '1년 이내'] },
          { key: '1-3-4', label: '자금조달방법 확인',   opts: ['여유자금', '캐피탈', '중고차매각', '직접입력'] },
          { key: '1-3-1', label: '차량 / 특장 옵션 확정', extLink: 'buildup-ev' },
          { key: '1-3-2', label: '견적서 발행' },
          { key: '2-1-0', label: '특장 계약서 작성' },
          { key: '1-3-5', label: '신용평가 필요서류 확보' },
        ],
        documents: [
          { key: 'business_reg_1_3',   label: '사업자등록증' },
          { key: 'quotation',          label: '견적서' },
          { key: 'special_contract',   label: '특장계약서' },
        ],
      },
    ],
  },
  {
    phase: 2, name: '매출', color: 'bg-violet-700', textColor: 'text-violet-700',
    processes: [
      {
        code: '2-1', name: '판매 신청', target: 2,
        checks: [
          { key: '2-1-1', label: 'EV& 계약금 납입' },
          { key: '2-1-2', label: 'KIA 대리점 판매신청' },
          { key: '2-1-3', label: 'KIA 계약금 납입' },
          { key: '2-1-4', label: '전기차보조금 신청확인' },
        ],
        documents: [
          { key: 'evn_deposit_slip',   label: 'EV& 계약금 송금 내역' },
          { key: 'kia_dealer_mail',    label: 'KIA 대리점 발송 메일' },
          { key: 'kia_deposit_slip',   label: 'KIA 계약금 송금 내역' },
          { key: 'kia_quotation',      label: 'KIA 견적서' },
          { key: 'subsidy_selection',  label: '보조금지급대상자선정 서류' },
        ],
      },
      {
        code: '2-2', name: '캐피탈 신청', target: 2,
        checks: [
          { key: '2-2-0', label: '현대커머셜 캐피탈 심사 신청' },
          { key: '2-2-1', label: '캐피탈 승인 결과 확인' },
        ],
        documents: [
          { key: 'seal_cert',        label: '인감증명서' },
          { key: 'capital_approval', label: '캐피탈 승인서' },
        ],
      },
      {
        code: '2-3', name: '1차 출고', target: 1,
        checks: [
          { key: '2-3-1', label: '캐피탈 실행_KIA 대금 송금' },
          { key: '2-3-0', label: 'KIA 오픈베드 차량 출고 예정일 확정' },
          { key: '2-3-2', label: '임시번호판 발급' },
          { key: '2-3-3', label: '탁송 일자 확정 (기아→특장공장)' },
          { key: '2-3-4', label: '차량 탁송 완료' },
        ],
        documents: [
          { key: 'temp_plate',      label: '임시번호판 발급 확인서' },
          { key: 'delivery_receipt', label: '탁송 인수증' },
        ],
      },
    ],
  },
  {
    phase: 3, name: '특장제조', color: 'bg-orange-600', textColor: 'text-orange-600',
    processes: [
      {
        code: '3-1', name: '특장', target: 1,
        checks: [
          { key: '3-1-0', label: '특장공장 입고 및 탁송 인수증 수령' },
          { key: '3-1-1', label: 'KIA 자동차 제작 행정서류 수령' },
          { key: '3-1-2', label: '차량 외관 검수 (사진 채증)' },
          { key: '3-1-3', label: '정식 번호판 등록 (파란색)' },
          { key: '3-1-4', label: '튜닝승인 신청 및 발급' },
          { key: '3-1-5', label: '탑 / 냉동기 특장 장착' },
          { key: '3-1-6', label: '구조변경 안전검사 완료' },
        ],
        documents: [
          { key: 'factory_receipt',   label: '특장공장 탁송 인수증' },
          { key: 'kia_admin_docs',    label: 'KIA 제작 행정서류' },
          { key: 'tuning_approval',   label: '튜닝승인서' },
          { key: 'safety_inspection', label: '구조변경 안전검사서' },
        ],
      },
      {
        code: '3-2', name: '추가작업', target: 1,
        checks: [
          { key: '3-2-0', label: '특장차량 김포공장 이동 및 입고' },
          { key: '3-2-1', label: '공장 입고 검사 (특장 품질 확인)' },
          { key: '3-2-2', label: '배선 / 배관 작업 완료' },
          { key: '3-2-3', label: 'PDI 품질 보증 검사 완료' },
        ],
        documents: [
          { key: 'pdi_report', label: 'PDI 품질 보증 검사서' },
        ],
      },
      {
        code: '3-3', name: '2차 출고', target: 1,
        checks: [
          { key: '3-3-0', label: '캐피탈 2차 실행_EV& 대금 송금' },
          { key: '3-3-3', label: '보조금 행정 최종 확인' },
          { key: '3-3-1', label: '썬팅 완료' },
          { key: '3-3-4', label: '블랙박스 완료' },
          { key: '3-3-2', label: '고객 인도 완료' },
        ],
        documents: [
          { key: 'delivery_confirm', label: '고객 인도 확인서' },
        ],
      },
    ],
  },
  {
    phase: 4, name: '대행업무', color: 'bg-teal-600', textColor: 'text-teal-600',
    processes: [
      {
        code: '4-1', name: '영업용번호판', target: 1,
        checks: [
          { key: '4-1-0', label: '영업용 번호판 신청 서류 준비' },
          { key: '4-1-1', label: '영업용 번호판 신청 대행' },
          { key: '4-1-2', label: '배 번호판 신청 (필요 시)' },
          { key: '4-1-3', label: '번호판 수령 및 장착 완료' },
        ],
        documents: [
          { key: 'plate_application', label: '영업용 번호판 신청서' },
          { key: 'plate_receipt',     label: '번호판 수령 확인서' },
        ],
      },
      {
        code: '4-2', name: '보험/취등록세', target: 1,
        checks: [
          { key: '4-2-0', label: '자동차 보험 가입 대행' },
          { key: '4-2-1', label: '취득세 / 등록세 납부 대행' },
          { key: '4-2-2', label: '등록증 수령 및 고객 전달' },
        ],
        documents: [
          { key: 'insurance_cert',   label: '자동차 보험증권' },
          { key: 'acquisition_tax',  label: '취득세 납부 확인서' },
          { key: 'registration_cert', label: '차량 등록증' },
        ],
      },
    ],
  },
]

// 기존 stage 값 → stageCode 매핑 (기존 데이터 호환)
export const OLD_STAGE_TO_CODE: Record<string, string> = {
  '리드':         '1-1',
  '전화상담':     '1-2',
  '대면상담':     '1-3',
  '캐피탈 심사':  '2-2',
  '계약·출고 진행': '2-1',
  '출고 완료':    '3-3',
  '이탈':         '이탈',
}

export function getStageCode(stage: string): string {
  return OLD_STAGE_TO_CODE[stage] ?? '1-1'
}

export function getProcess(code: string): PipelineProcess | undefined {
  for (const phase of PIPELINE) {
    const p = phase.processes.find(p => p.code === code)
    if (p) return p
  }
}

export function getPhase(code: string): PipelinePhase | undefined {
  return PIPELINE.find(ph => ph.processes.some(p => p.code === code))
}

export function getStatusColor(count: number, target: number): 'green' | 'yellow' | 'red' {
  if (count >= target)           return 'green'
  if (count >= Math.ceil(target * 0.5)) return 'yellow'
  return 'red'
}

export const ALL_PROCESS_CODES = PIPELINE.flatMap(ph => ph.processes.map(p => p.code))
