import PptxGenJS from 'pptxgenjs'
import path from 'path'
import fs from 'fs'

const KO  = 'Malgun Gothic'
const SH  = { RECT: 'rect', ROUND: 'roundRect', OVAL: 'ellipse' } as const

const C = {
  navy:       '1E2A4A',
  indigo:     '4F46E5',
  indigoL:    'EEF2FF',
  orange:     'EA580C',
  orangeL:    'FFF7ED',
  green:      '16A34A',
  greenL:     'DCFCE7',
  teal:       '0F766E',
  tealL:      'CCFBF1',
  white:      'FFFFFF',
  slate700:   '334155',
  slate500:   '64748B',
  slate300:   'CBD5E0',
  slate100:   'F1F5F9',
  slate50:    'F8FAFC',
  amber:      'D97706',
  amberL:     'FEF3C7',
  violet:     '7C3AED',
  violetL:    'F5F3FF',
} as const

// ── 샘플 데이터 ────────────────────────────────────────────────
const TASK = {
  code:    'PM팀-01',
  title:   '신규 SI 고객 확보 — 식자재·의약품 라인',
  team:    'PM팀',
  owner:   '홍길동',
  strategy: 'A',
  period:  '2026.01.01 ~ 2026.12.31',
  status:  '진행중',
  problem: `현재 물류 SI 매출 비중 88% (월평균 5,000만원) 으로 식자재·의약품 영역 확장이 부재한 상황입니다.
이대로 유지 시 연 KR 130억 대비 –14억 미달이 예상되며, 특정 산업군 의존도 심화로 리스크가 증가하고 있습니다.`,
  kpis: [
    { type: '정량', label: '신규 본계약', target: '2건', color: 'indigo' },
    { type: '정량', label: '월매출 증가분', target: '+2,000만원', color: 'indigo' },
    { type: '정량', label: '신규 파이프라인', target: '5건', color: 'orange' },
    { type: '정성', label: '레퍼런스 확보', target: '식자재·의약품 각 1건', color: 'orange' },
  ],
  measures: [
    { no: 1, title: '식자재 유통사 대상 영업 활동 강화', desc: '주요 타깃 5개사 선정 → PoC 제안 → 계약 체결', start: 'W01', end: 'W16', color: C.indigo },
    { no: 2, title: '의약품 물류 특화 솔루션 패키지 개발', desc: '냉장 추적·GMP 요건 기반 모듈 완성', start: 'W04', end: 'W24', color: C.orange },
    { no: 3, title: '전시회·컨퍼런스 참가로 인지도 제고', desc: 'LogiWorld 2026 참가, 홍보 자료 제작', start: 'W08', end: 'W20', color: C.teal },
    { no: 4, title: '레퍼런스 고객 사례 발굴 및 콘텐츠화', desc: '기존 고객 2건 사례 영상·백서 제작', start: 'W12', end: 'W28', color: C.violet },
  ],
  budget: [
    { category: '인건비',        amount: 4800, note: '투입인력 2명 × 12개월' },
    { category: '외주·용역비',   amount: 1200, note: '솔루션 패키지 외주 개발' },
    { category: '설비·라이선스', amount:  600, note: '개발 환경 클라우드 비용' },
    { category: '출장·교통비',   amount:  300, note: '영업 출장 (월평균 25만원)' },
    { category: '기타비용',      amount:  200, note: '전시회 참가비·홍보물' },
  ],
  personnel: [
    { role: 'PM (과제 오너)',       count: 1, period: '전 기간', note: '기획·조율' },
    { role: '솔루션 아키텍트',      count: 1, period: 'W01~W28', note: '기술 설계' },
    { role: '영업 담당',            count: 1, period: 'W01~W52', note: '고객 영업' },
    { role: '외주 개발사',          count: 2, period: 'W04~W24', note: '모듈 개발' },
  ],
  deliverables: [
    '식자재·의약품 산업 특화 SI 솔루션 패키지 v1.0',
    '신규 고객 레퍼런스 영상 및 백서 (각 1건)',
    '영업 제안서 템플릿 및 PoC 사례집',
    '로드맵: 식자재 2건, 의약품 1건 파이프라인 구축',
  ],
}

// ── 공통 헬퍼 ─────────────────────────────────────────────────
function addHeader(s: PptxGenJS.Slide, title: string, slideNum: number, accent: string) {
  s.addShape(SH.RECT, { x: 0, y: 0, w: '100%', h: 0.62, fill: { color: C.navy }, line: { width: 0 } })
  s.addShape(SH.RECT, { x: 0, y: 0, w: 0.07, h: 0.62, fill: { color: accent }, line: { width: 0 } })
  s.addText(title, { x: 0.38, y: 0.1, w: 9, h: 0.42, fontSize: 17, color: C.white, bold: true, fontFace: KO })
  s.addText(`${TASK.code}  |  ${TASK.title}`, { x: 0.38, y: 0.62, w: 10, h: 0.28, fontSize: 8, color: C.slate500, fontFace: KO })
  s.addText(`${slideNum} / 4`, { x: 12.2, y: 0.18, w: 1.1, h: 0.28, fontSize: 9, color: 'AABBDD', align: 'right', fontFace: KO })
}

function box(s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, fill: string, border: string = C.slate300, radius = 0.06) {
  s.addShape(SH.ROUND, { x, y, w, h, fill: { color: fill }, line: { color: border, width: 1 }, rectRadius: radius })
}

// ══════════════════════════════════════════════════════════════
// Slide 1: 현황 및 문제점
// ══════════════════════════════════════════════════════════════
function slide1(pptx: PptxGenJS) {
  const s = pptx.addSlide()
  addHeader(s, '1. 현황 및 문제점', 1, C.orange)

  // ── 과제 개요 띠 ──
  s.addShape(SH.RECT, { x: 0, y: 0.9, w: '100%', h: 0.52, fill: { color: C.slate50 }, line: { width: 0 } })
  const meta = [
    { label: '담당 팀', value: TASK.team,   x: 0.38 },
    { label: '오너',    value: TASK.owner,  x: 2.4 },
    { label: '기간',    value: TASK.period, x: 4.1 },
    { label: '상태',    value: TASK.status, x: 10.0 },
  ]
  meta.forEach(m => {
    s.addText(m.label, { x: m.x, y: 0.94, w: 2, h: 0.2, fontSize: 7.5, color: C.slate500, fontFace: KO })
    s.addText(m.value, { x: m.x, y: 1.12, w: 2.8, h: 0.22, fontSize: 9.5, color: C.slate700, bold: true, fontFace: KO })
  })

  // ── 문제 현황 ──
  s.addShape(SH.RECT, { x: 0.38, y: 1.58, w: 7.9, h: 0.34, fill: { color: C.amberL }, line: { width: 0 } })
  s.addShape(SH.RECT, { x: 0.38, y: 1.58, w: 0.06, h: 0.34, fill: { color: C.amber }, line: { width: 0 } })
  s.addText('문제 현황', { x: 0.58, y: 1.58, w: 3, h: 0.34, fontSize: 10, color: C.amber, bold: true, fontFace: KO })

  box(s, 0.38, 1.96, 7.9, 2.1, 'FFFDF5', 'FDE68A')
  s.addText(TASK.problem, { x: 0.56, y: 2.06, w: 7.56, h: 1.9, fontSize: 11.5, color: C.slate700, wrap: true, valign: 'top', fontFace: KO })

  // ── KPI 목표 ──
  s.addShape(SH.RECT, { x: 8.52, y: 1.58, w: 4.8, h: 0.34, fill: { color: C.indigoL }, line: { width: 0 } })
  s.addShape(SH.RECT, { x: 8.52, y: 1.58, w: 0.06, h: 0.34, fill: { color: C.indigo }, line: { width: 0 } })
  s.addText('핵심 목표 KPI', { x: 8.72, y: 1.58, w: 4, h: 0.34, fontSize: 10, color: C.indigo, bold: true, fontFace: KO })

  TASK.kpis.forEach((kpi, i) => {
    const ky = 1.96 + i * 0.52
    const fill = i % 2 === 0 ? C.indigoL : 'F0FDF4'
    const border = i % 2 === 0 ? 'A5B4FC' : '86EFAC'
    const tcolor = i % 2 === 0 ? C.indigo : C.green
    box(s, 8.52, ky, 4.8, 0.46, fill, border, 0.05)
    s.addText(kpi.label, { x: 8.68, y: ky + 0.04, w: 2.4, h: 0.2, fontSize: 9, color: C.slate500, fontFace: KO })
    s.addText(kpi.target, { x: 8.68, y: ky + 0.22, w: 4.4, h: 0.2, fontSize: 11, color: tcolor, bold: true, fontFace: KO })
  })

  // ── 문제 원인 분석 (3단) ──
  s.addShape(SH.RECT, { x: 0.38, y: 4.2, w: 12.94, h: 0.3, fill: { color: C.slate100 }, line: { width: 0 } })
  s.addText('문제 원인 분석', { x: 0.5, y: 4.2, w: 5, h: 0.3, fontSize: 9.5, color: C.slate700, bold: true, fontFace: KO })

  const causes = [
    { title: '영업·시장', body: '신규 산업군(식자재·의약품) 네트워크 부재\n타깃 고객 PoC 경험 미흡' },
    { title: '솔루션·기술', body: '식자재 신선도·냉장 추적 모듈 미개발\n의약품 GMP 요건 대응 패키지 부재' },
    { title: '인력·리소스', body: '해당 도메인 전문 PM 부재\n마케팅 레퍼런스·콘텐츠 미확보' },
  ]
  causes.forEach((c, i) => {
    const cx = 0.38 + i * 4.38
    box(s, cx, 4.56, 4.18, 2.52, C.white, C.slate300)
    s.addShape(SH.RECT, { x: cx, y: 4.56, w: 4.18, h: 0.36, fill: { color: C.navy }, line: { width: 0 } })
    s.addText(c.title, { x: cx + 0.12, y: 4.56, w: 3.94, h: 0.36, fontSize: 10, color: C.white, bold: true, valign: 'middle', fontFace: KO })
    s.addText(c.body, { x: cx + 0.14, y: 4.98, w: 3.9, h: 2.0, fontSize: 11, color: C.slate700, wrap: true, valign: 'top', fontFace: KO })
  })
}

// ══════════════════════════════════════════════════════════════
// Slide 2: 개선방안 및 효과
// ══════════════════════════════════════════════════════════════
function slide2(pptx: PptxGenJS) {
  const s = pptx.addSlide()
  addHeader(s, '2. 개선방안 및 효과', 2, C.indigo)

  const colors = [C.indigo, C.orange, C.teal, C.violet]
  const lights = [C.indigoL, C.orangeL, C.tealL, C.violetL]
  const borders = ['A5B4FC', 'FDE68A', '99F6E4', 'DDD6FE']

  s.addText('개선방안', { x: 0.38, y: 0.98, w: 3, h: 0.28, fontSize: 10, color: C.slate700, bold: true, fontFace: KO })
  s.addText('기대 효과', { x: 7.2, y: 0.98, w: 3, h: 0.28, fontSize: 10, color: C.slate700, bold: true, fontFace: KO })

  TASK.measures.forEach((m, i) => {
    const my = 1.3 + i * 1.42
    const clr = colors[i % colors.length]
    const lclr = lights[i % lights.length]
    const bclr = borders[i % borders.length]

    // 번호 원
    s.addShape(SH.OVAL, { x: 0.38, y: my + 0.26, w: 0.46, h: 0.46, fill: { color: clr }, line: { width: 0 } })
    s.addText(String(m.no), { x: 0.38, y: my + 0.26, w: 0.46, h: 0.46, fontSize: 14, color: C.white, bold: true, align: 'center', valign: 'middle', fontFace: KO })

    // 방안 박스
    box(s, 0.96, my, 5.9, 1.22, lclr, bclr)
    s.addText(m.title, { x: 1.1, y: my + 0.1, w: 5.6, h: 0.32, fontSize: 11, color: clr, bold: true, fontFace: KO })
    s.addText(m.desc,  { x: 1.1, y: my + 0.42, w: 5.6, h: 0.72, fontSize: 10, color: C.slate700, wrap: true, valign: 'top', fontFace: KO })

    // 화살표
    s.addText('▶', { x: 7.0, y: my + 0.42, w: 0.28, h: 0.38, fontSize: 13, color: clr, align: 'center', fontFace: KO })
  })

  // 효과 (오른쪽)
  const effects = [
    { title: '매출 성장',  body: '식자재·의약품 신규 SI 본계약 2건\n→ 연 매출 +2,000만원/월 기여', color: C.indigo },
    { title: '리스크 분산', body: '물류 SI 의존도 88% → 70% 이하 목표\n→ 특정 산업 리스크 감소', color: C.orange },
    { title: '기술 경쟁력', body: '냉장·GMP 특화 모듈 보유로\n타사 대비 차별화 솔루션 제공', color: C.teal },
    { title: '브랜드 인지', body: '레퍼런스 2건 + 전시회 참가\n→ 신산업 내 EV& 인지도 확보', color: C.violet },
  ]
  effects.forEach((e, i) => {
    const ey = 1.3 + i * 1.42
    box(s, 7.32, ey, 5.9, 1.22, C.white, C.slate300)
    s.addShape(SH.RECT, { x: 7.32, y: ey, w: 5.9, h: 0.36, fill: { color: e.color }, line: { width: 0 } })
    s.addText(e.title, { x: 7.48, y: ey, w: 5.5, h: 0.36, fontSize: 11, color: C.white, bold: true, valign: 'middle', fontFace: KO })
    s.addText(e.body,  { x: 7.48, y: ey + 0.42, w: 5.5, h: 0.72, fontSize: 10.5, color: C.slate700, wrap: true, valign: 'top', fontFace: KO })
  })
}

// ══════════════════════════════════════════════════════════════
// Slide 3: 실행계획 간트차트
// ══════════════════════════════════════════════════════════════
function slide3(pptx: PptxGenJS) {
  const s = pptx.addSlide()
  addHeader(s, '3. 실행계획 (간트차트)', 3, C.teal)

  const TOTAL_WEEKS = 52
  const COL_LABEL = 3.6   // 방안 설명 열 너비
  const GANTT_X   = 4.0   // 간트 시작 X
  const GANTT_W   = 9.32  // 간트 영역 너비
  const ROW_H     = 0.58
  const HDR_Y     = 0.94
  const DATA_Y    = 1.42

  // 월 헤더 (12개월)
  const monthW = GANTT_W / 12
  const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
  monthNames.forEach((mn, i) => {
    const mx = GANTT_X + i * monthW
    s.addShape(SH.RECT, { x: mx, y: HDR_Y, w: monthW, h: 0.36, fill: { color: i % 2 === 0 ? C.navy : '2D3E5A' }, line: { color: '3A4E70', width: 0.5 } })
    s.addText(mn, { x: mx, y: HDR_Y, w: monthW, h: 0.36, fontSize: 8.5, color: C.white, bold: true, align: 'center', valign: 'middle', fontFace: KO })
  })

  // 방안 헤더
  box(s, 0.38, HDR_Y, COL_LABEL - 0.06, 0.36, C.navy, C.navy)
  s.addText('방안 및 담당', { x: 0.5, y: HDR_Y, w: COL_LABEL - 0.16, h: 0.36, fontSize: 9, color: C.white, bold: true, valign: 'middle', fontFace: KO })

  function weekToMonth(week: string): number {
    const w = parseInt(week.replace('W',''))
    return Math.ceil(w / 4.33) - 1  // 0-based month index
  }

  const colors = [C.indigo, C.orange, C.teal, C.violet]

  TASK.measures.forEach((m, i) => {
    const ry  = DATA_Y + i * (ROW_H + 0.06)
    const clr = colors[i % colors.length]
    const bg  = i % 2 === 0 ? C.white : C.slate50

    // 배경 줄무늬
    s.addShape(SH.RECT, { x: 0.38, y: ry, w: 12.94, h: ROW_H, fill: { color: bg }, line: { color: C.slate300, width: 0.5 } })

    // 방안 텍스트
    s.addShape(SH.OVAL, { x: 0.44, y: ry + 0.1, w: 0.32, h: 0.32, fill: { color: clr }, line: { width: 0 } })
    s.addText(String(m.no), { x: 0.44, y: ry + 0.1, w: 0.32, h: 0.32, fontSize: 10, color: C.white, bold: true, align: 'center', valign: 'middle', fontFace: KO })
    s.addText(m.title, { x: 0.84, y: ry + 0.06, w: 3.0, h: 0.24, fontSize: 8.5, color: C.slate700, bold: true, wrap: false, fontFace: KO })
    s.addText(m.desc.split('\n')[0], { x: 0.84, y: ry + 0.3, w: 3.0, h: 0.2, fontSize: 7.5, color: C.slate500, fontFace: KO })

    // 간트 바
    const sm = weekToMonth(m.start)
    const em = weekToMonth(m.end)
    const bx = GANTT_X + sm * monthW
    const bw = (em - sm + 1) * monthW
    s.addShape(SH.ROUND, { x: bx + 0.04, y: ry + 0.14, w: bw - 0.08, h: ROW_H - 0.28, fill: { color: clr }, line: { width: 0 }, rectRadius: 0.06 })
    s.addText(`${m.start}~${m.end}`, { x: bx + 0.08, y: ry + 0.14, w: bw - 0.16, h: ROW_H - 0.28, fontSize: 8.5, color: C.white, bold: true, align: 'center', valign: 'middle', fontFace: KO })
  })

  // 현재 시점 선 (W24 기준 예시)
  const nowMonth = 5  // 6월 = index 5
  const nowX = GANTT_X + nowMonth * monthW
  s.addShape(SH.RECT, { x: nowX, y: HDR_Y, w: 0.03, h: DATA_Y - HDR_Y + TASK.measures.length * (ROW_H + 0.06), fill: { color: 'EF4444' }, line: { width: 0 } })
  s.addText('현재', { x: nowX - 0.3, y: HDR_Y - 0.28, w: 0.7, h: 0.24, fontSize: 8, color: 'EF4444', bold: true, align: 'center', fontFace: KO })
}

// ══════════════════════════════════════════════════════════════
// Slide 4: 필요리소스 및 결과물
// ══════════════════════════════════════════════════════════════
function slide4(pptx: PptxGenJS) {
  const s = pptx.addSlide()
  addHeader(s, '4. 필요리소스 및 결과물', 4, C.violet)

  // ── 예산 ────────────────────────────────────────────────────
  s.addShape(SH.RECT, { x: 0.38, y: 0.94, w: 6.6, h: 0.3, fill: { color: C.indigoL }, line: { width: 0 } })
  s.addShape(SH.RECT, { x: 0.38, y: 0.94, w: 0.06, h: 0.3, fill: { color: C.indigo }, line: { width: 0 } })
  s.addText('예산 계획 (단위: 만원)', { x: 0.56, y: 0.94, w: 4, h: 0.3, fontSize: 9.5, color: C.indigo, bold: true, fontFace: KO })

  const total = TASK.budget.reduce((s, b) => s + b.amount, 0)
  const budColors = [C.indigo, C.orange, C.teal, C.violet, C.green]

  TASK.budget.forEach((b, i) => {
    const by = 1.28 + i * 0.56
    const pct = Math.round(b.amount / total * 100)
    const barW = 3.6 * (b.amount / total)

    s.addText(b.category, { x: 0.38, y: by + 0.06, w: 2.0, h: 0.3, fontSize: 9.5, color: C.slate700, bold: true, fontFace: KO })
    // 바 배경
    s.addShape(SH.ROUND, { x: 2.42, y: by + 0.1, w: 3.6, h: 0.28, fill: { color: C.slate100 }, line: { width: 0 }, rectRadius: 0.06 })
    // 바 채움
    if (barW > 0.1) s.addShape(SH.ROUND, { x: 2.42, y: by + 0.1, w: barW, h: 0.28, fill: { color: budColors[i] }, line: { width: 0 }, rectRadius: 0.06 })
    s.addText(`${b.amount.toLocaleString()}만원 (${pct}%)`, { x: 6.1, y: by + 0.06, w: 1.2, h: 0.3, fontSize: 9, color: C.slate500, align: 'right', fontFace: KO })
    s.addText(b.note, { x: 2.5, y: by + 0.1, w: 3.5, h: 0.28, fontSize: 7.5, color: C.white, bold: true, valign: 'middle', fontFace: KO })
  })

  // 합계 바
  box(s, 0.38, 4.12, 6.6, 0.42, C.indigoL, 'A5B4FC')
  s.addText('총 예산', { x: 0.54, y: 4.18, w: 2, h: 0.3, fontSize: 10, color: C.indigo, bold: true, fontFace: KO })
  s.addText(`${total.toLocaleString()} 만원`, { x: 5.4, y: 4.18, w: 1.4, h: 0.3, fontSize: 14, color: C.indigo, bold: true, align: 'right', fontFace: KO })

  // ── 필요 인력 ────────────────────────────────────────────────
  s.addShape(SH.RECT, { x: 0.38, y: 4.68, w: 6.6, h: 0.3, fill: { color: C.tealL }, line: { width: 0 } })
  s.addShape(SH.RECT, { x: 0.38, y: 4.68, w: 0.06, h: 0.3, fill: { color: C.teal }, line: { width: 0 } })
  s.addText('필요 인력', { x: 0.56, y: 4.68, w: 4, h: 0.3, fontSize: 9.5, color: C.teal, bold: true, fontFace: KO })

  TASK.personnel.forEach((p, i) => {
    const py = 5.04 + i * 0.54
    box(s, 0.38, py, 6.6, 0.46, i % 2 === 0 ? C.white : C.tealL, C.slate300)
    s.addShape(SH.OVAL, { x: 0.5, y: py + 0.1, w: 0.28, h: 0.28, fill: { color: C.teal }, line: { width: 0 } })
    s.addText(String(p.count), { x: 0.5, y: py + 0.1, w: 0.28, h: 0.28, fontSize: 10, color: C.white, bold: true, align: 'center', valign: 'middle', fontFace: KO })
    s.addText(p.role, { x: 0.86, y: py + 0.06, w: 2.8, h: 0.2, fontSize: 9.5, color: C.slate700, bold: true, fontFace: KO })
    s.addText(`${p.period}  |  ${p.note}`, { x: 0.86, y: py + 0.26, w: 5.9, h: 0.18, fontSize: 8, color: C.slate500, fontFace: KO })
  })

  // ── 결과물 ──────────────────────────────────────────────────
  s.addShape(SH.RECT, { x: 7.32, y: 0.94, w: 5.9, h: 0.3, fill: { color: C.violetL }, line: { width: 0 } })
  s.addShape(SH.RECT, { x: 7.32, y: 0.94, w: 0.06, h: 0.3, fill: { color: C.violet }, line: { width: 0 } })
  s.addText('주요 결과물 (Deliverables)', { x: 7.5, y: 0.94, w: 5, h: 0.3, fontSize: 9.5, color: C.violet, bold: true, fontFace: KO })

  TASK.deliverables.forEach((d, i) => {
    const dy = 1.28 + i * 0.82
    box(s, 7.32, dy, 5.9, 0.72, C.white, 'DDD6FE')
    s.addShape(SH.ROUND, { x: 7.46, y: dy + 0.16, w: 0.36, h: 0.36, fill: { color: C.violet }, line: { width: 0 }, rectRadius: 0.05 })
    s.addText(String(i + 1), { x: 7.46, y: dy + 0.16, w: 0.36, h: 0.36, fontSize: 12, color: C.white, bold: true, align: 'center', valign: 'middle', fontFace: KO })
    s.addText(d, { x: 7.9, y: dy + 0.1, w: 5.1, h: 0.52, fontSize: 10.5, color: C.slate700, wrap: true, valign: 'middle', fontFace: KO })
  })

  // ── 성공 기준 ────────────────────────────────────────────────
  box(s, 7.32, 4.6, 5.9, 2.48, C.navy, C.navy)
  s.addText('과제 성공 기준', { x: 7.52, y: 4.72, w: 5.3, h: 0.3, fontSize: 10, color: C.white, bold: true, fontFace: KO })
  const criteria = ['✓  신규 본계약 2건 이상 체결 (식자재·의약품 각 1건)', '✓  월매출 증가분 +2,000만원 달성', '✓  파이프라인 5건 이상 구축', '✓  레퍼런스 영상·백서 각 1건 발행']
  criteria.forEach((c, i) => {
    s.addText(c, { x: 7.52, y: 5.1 + i * 0.44, w: 5.5, h: 0.36, fontSize: 10, color: 'AABBDD', fontFace: KO })
  })
}

// ══════════════════════════════════════════════════════════════
// 메인
// ══════════════════════════════════════════════════════════════
async function main() {
  const pptx = new PptxGenJS()
  pptx.layout  = 'LAYOUT_WIDE'
  pptx.author  = 'EV& WARP'
  pptx.company = 'EV&Solution'
  pptx.title   = `[예시] A3 과제정의서 PPT — 4슬라이드 구조`

  slide1(pptx)
  slide2(pptx)
  slide3(pptx)
  slide4(pptx)

  const outDir  = 'C:/Users/hslee/Desktop'
  const outFile = path.join(outDir, 'A3_과제정의서_예시.pptx')
  await pptx.writeFile({ fileName: outFile })
  console.log(`✓ 저장 완료: ${outFile}`)
}

main().catch(console.error)
