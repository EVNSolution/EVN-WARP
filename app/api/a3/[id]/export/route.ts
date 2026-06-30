import { prisma } from '@/lib/db'
import PptxGenJS from 'pptxgenjs'

const SH = {
  RECTANGLE:         'rect',
  ROUNDED_RECTANGLE: 'roundRect',
  OVAL:              'ellipse',
} as const

const C = {
  navy:        '1E2A4A',
  indigo:      '4F46E5',
  indigoLight: 'EEF2FF',
  orange:      'EA580C',
  orangeLight: 'FFF7ED',
  purple:      '7C3AED',
  purpleLight: 'F5F3FF',
  white:       'FFFFFF',
  slate700:    '334155',
  slate500:    '64748B',
  slate200:    'E2E8F0',
  slate100:    'F1F5F9',
  green:       '16A34A',
} as const

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const KO = 'Malgun Gothic'

function fmt(d: Date | string): string {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function addHeader(
  slide: PptxGenJS.Slide,
  title: string,
  code: string,
  accent: string,
) {
  slide.addShape(SH.RECTANGLE, { x: 0, y: 0, w: '100%', h: 0.65, fill: { color: C.navy }, line: { width: 0 } })
  slide.addShape(SH.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 0.65, fill: { color: accent }, line: { width: 0 } })
  slide.addText(title, { x: 0.4, y: 0.1, w: 10, h: 0.45, fontSize: 18, color: C.white, bold: true, fontFace: KO })
  slide.addText(code, { x: 10.4, y: 0.16, w: 2.8, h: 0.33, fontSize: 11, color: 'AABBDD', align: 'right', fontFace: 'Courier New' })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const task = await prisma.strategyTask.findUnique({
    where: { id },
    include: {
      team: true,
      parent: true,
      kpiItems: { orderBy: { index: 'asc' } },
      monthlyTargets: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
      countermeasures: { orderBy: { index: 'asc' } },
    },
  })
  if (!task) return Response.json({ error: 'Not found' }, { status: 404 })

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'EV& WARP'
  pptx.company = 'EV&Solution'
  pptx.title = `[${task.code}] ${task.title}`

  const isA = task.strategy === 'A'
  const accent = isA ? C.orange : C.purple
  const accentLight = isA ? C.orangeLight : C.purpleLight
  const stratLabel = isA ? '전략과제 A · 확장과 성장' : '전략과제 B · AI 기반 조직운영'

  // ── Slide 1: 표지 ────────────────────────────────────────────
  {
    const s = pptx.addSlide()

    s.addShape(SH.RECTANGLE, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.navy }, line: { width: 0 } })
    s.addShape(SH.RECTANGLE, { x: 0, y: 0, w: 0.08, h: '100%', fill: { color: accent }, line: { width: 0 } })

    s.addText('EV& WARP', { x: 0.45, y: 0.38, w: 5, h: 0.4, fontSize: 11, color: '8899BB', bold: true, fontFace: KO })
    s.addText('전략과제 정의서', { x: 0.45, y: 0.88, w: 8, h: 0.48, fontSize: 15, color: 'AABBDD', fontFace: KO })

    s.addShape(SH.ROUNDED_RECTANGLE, {
      x: 0.45, y: 1.52, w: 3.5, h: 0.38,
      fill: { color: accent }, line: { width: 0 }, rectRadius: 0.05,
    })
    s.addText(stratLabel, {
      x: 0.45, y: 1.52, w: 3.5, h: 0.38,
      fontSize: 10, color: C.white, bold: true, align: 'center', fontFace: KO,
    })

    s.addText(task.code, {
      x: 0.45, y: 2.08, w: 12, h: 0.62,
      fontSize: 19, color: '6688CC', fontFace: 'Courier New',
    })
    s.addText(task.title, {
      x: 0.45, y: 2.76, w: 12.2, h: 1.6,
      fontSize: 28, color: C.white, bold: true, wrap: true, fontFace: KO,
    })

    s.addShape(SH.RECTANGLE, { x: 0.45, y: 4.52, w: 12.2, h: 0.025, fill: { color: '3A4E70' }, line: { width: 0 } })

    const iy = 4.7
    const infoItems = [
      { label: '담당 팀', value: task.team.name, x: 0.45 },
      { label: '과제 오너', value: task.owner, x: 3.5 },
      { label: '기간', value: `${fmt(task.startDate)} ~ ${fmt(task.endDate)}`, x: 5.9 },
      { label: '상태', value: task.status, x: 11.1 },
    ]
    infoItems.forEach(({ label, value, x }) => {
      s.addText(label, { x, y: iy, w: 2.8, h: 0.27, fontSize: 9, color: '7788AA', fontFace: KO })
      s.addText(value, { x, y: iy + 0.27, w: 2.8, h: 0.38, fontSize: 13, color: C.white, bold: true, fontFace: KO })
    })

    if (task.confirmed) {
      s.addShape(SH.ROUNDED_RECTANGLE, {
        x: 0.45, y: 6.28, w: 1.85, h: 0.34,
        fill: { color: C.green }, line: { width: 0 }, rectRadius: 0.05,
      })
      s.addText('위원회 확정', {
        x: 0.45, y: 6.28, w: 1.85, h: 0.34,
        fontSize: 10, color: C.white, bold: true, align: 'center', fontFace: KO,
      })
    }

    s.addText(`작성일: ${new Date().toLocaleDateString('ko-KR')}`, {
      x: 0.45, y: 7.1, w: 6, h: 0.28, fontSize: 9, color: '5566AA', fontFace: KO,
    })
  }

  // ── Slide 2: 문제와 목표 ──────────────────────────────────────
  {
    const s = pptx.addSlide()
    addHeader(s,'1. 문제와 목표', task.code, accent)

    // Problem
    s.addShape(SH.RECTANGLE, { x: 0.4, y: 0.8, w: 12.5, h: 0.36, fill: { color: 'FEF3C7' }, line: { width: 0 } })
    s.addShape(SH.RECTANGLE, { x: 0.4, y: 0.8, w: 0.06, h: 0.36, fill: { color: C.orange }, line: { width: 0 } })
    s.addText('문제 현황 (정량)', { x: 0.62, y: 0.8, w: 5, h: 0.36, fontSize: 11, color: C.orange, bold: true, fontFace: KO })

    s.addShape(SH.ROUNDED_RECTANGLE, {
      x: 0.4, y: 1.22, w: 12.5, h: 1.9,
      fill: { color: 'FFFBF5' }, line: { color: 'FDE68A', width: 1 }, rectRadius: 0.05,
    })
    s.addText(task.problemStatement || '(문제 정의가 입력되지 않았습니다)', {
      x: 0.62, y: 1.3, w: 12.1, h: 1.74,
      fontSize: 13, color: C.slate700, wrap: true, valign: 'top', fontFace: KO,
    })

    // Goal
    s.addShape(SH.RECTANGLE, { x: 0.4, y: 3.28, w: 12.5, h: 0.36, fill: { color: C.indigoLight }, line: { width: 0 } })
    s.addShape(SH.RECTANGLE, { x: 0.4, y: 3.28, w: 0.06, h: 0.36, fill: { color: C.indigo }, line: { width: 0 } })
    s.addText('달성 목표 (정량)', { x: 0.62, y: 3.28, w: 5, h: 0.36, fontSize: 11, color: C.indigo, bold: true, fontFace: KO })

    s.addShape(SH.ROUNDED_RECTANGLE, {
      x: 0.4, y: 3.7, w: 12.5, h: 1.9,
      fill: { color: 'F8F9FF' }, line: { color: 'C7D2FE', width: 1 }, rectRadius: 0.05,
    })
    s.addText(task.goalStatement || '(목표가 입력되지 않았습니다)', {
      x: 0.62, y: 3.78, w: 12.1, h: 1.74,
      fontSize: 13, color: C.slate700, wrap: true, valign: 'top', fontFace: KO,
    })

    // KPI boxes
    if (task.kpiItems.length > 0) {
      s.addText('핵심 지표 (KPI)', { x: 0.4, y: 5.76, w: 4, h: 0.28, fontSize: 10, color: C.slate500, bold: true, fontFace: KO })
      const displayKpis = task.kpiItems.slice(0, 4)
      const colCount = Math.min(displayKpis.length, 2)
      const bw = (12.5 - (colCount - 1) * 0.2) / colCount
      displayKpis.forEach((kpi: any, i: number) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        const bx = 0.4 + col * (bw + 0.2)
        const by = 6.1 + row * 1.15
        const isQuant = kpi.type === '정량'
        const bColor = isQuant ? C.indigoLight : 'FFFBEB'
        const tColor = isQuant ? C.indigo : C.orange
        const borderColor = isQuant ? 'A5B4FC' : 'FDE68A'
        s.addShape(SH.ROUNDED_RECTANGLE, {
          x: bx, y: by, w: bw, h: 1.05,
          fill: { color: bColor }, line: { color: borderColor as any, width: 1 }, rectRadius: 0.08,
        })
        s.addText(`[${kpi.subType ?? kpi.type}] ${kpi.label}`, { x: bx + 0.2, y: by + 0.1, w: bw - 0.3, h: 0.3, fontSize: 10, color: C.slate500, fontFace: KO })
        s.addText(`${kpi.target}${kpi.unit ? ' ' + kpi.unit : ''}`, { x: bx + 0.2, y: by + 0.42, w: bw - 0.3, h: 0.52, fontSize: 20, color: tColor, bold: true, fontFace: KO })
      })
    }
  }

  // ── Slide 3: 월별 목표 & 재무 IMPACT ─────────────────────────
  if (task.monthlyTargets.length > 0) {
    const s = pptx.addSlide()
    addHeader(s,'2. 월별 목표', task.code, accent)

    const mts = task.monthlyTargets
    const totalRev = mts.reduce((sum, m) => sum + (m.revenueTarget ?? 0), 0)
    const totalBudget = mts.reduce((sum, m) => sum + (m.budget ?? 0), 0)
    const maxPersonnel = mts.reduce((max, m) => Math.max(max, m.personnel ?? 0), 0)

    const tableW = 12.5
    const labelW = 1.8
    const totW  = 1.4
    const mW    = (tableW - labelW - totW) / mts.length

    type CellOption = { bold?: boolean; color?: string; fill?: { color: string }; align?: 'left'|'center'|'right'; fontSize?: number; fontFace?: string; valign?: 'top'|'middle'|'bottom' }
    const cell = (text: string, opts: CellOption = {}) => ({
      text,
      options: { fontSize: 11, fontFace: KO, valign: 'middle' as const, ...opts },
    })

    const rows = [
      [
        cell('구분', { bold: true, color: C.white, fill: { color: C.navy }, align: 'left' }),
        ...mts.map(m => cell(`${MONTHS[m.month - 1]}\n${m.year}`, { bold: true, color: C.white, fill: { color: C.navy }, align: 'center' })),
        cell('합 계', { bold: true, color: C.white, fill: { color: C.indigo }, align: 'center' }),
      ],
      [
        cell('매출 목표\n(만원)', { bold: true, color: C.slate700, fill: { color: C.slate100 }, align: 'left' }),
        ...mts.map(m => cell(m.revenueTarget != null ? m.revenueTarget.toLocaleString() : '—', { color: C.slate700, align: 'center' })),
        cell(totalRev.toLocaleString(), { bold: true, color: C.indigo, fill: { color: C.indigoLight }, align: 'center' }),
      ],
      [
        cell('예산합계\n(만원)', { bold: true, color: C.slate700, fill: { color: C.slate100 }, align: 'left' }),
        ...mts.map(m => cell(m.budget != null && m.budget > 0 ? m.budget.toLocaleString() : '—', { color: C.slate700, align: 'center' })),
        cell(totalBudget.toLocaleString(), { bold: true, color: C.orange, fill: { color: C.orangeLight }, align: 'center' }),
      ],
      [
        cell('필요인력\n(명)', { bold: true, color: C.slate700, fill: { color: C.slate100 }, align: 'left' }),
        ...mts.map(m => cell(m.personnel != null ? String(m.personnel) : '—', { color: C.slate700, align: 'center' })),
        cell(`Max ${maxPersonnel}`, { bold: true, color: C.slate700, align: 'center' }),
      ],
    ]

    s.addTable(rows as any, {
      x: 0.4, y: 0.9, w: tableW,
      rowH: 0.58,
      colW: [labelW, ...Array(mts.length).fill(mW), totW],
      border: { pt: 1, color: C.slate200 },
    } as any)

    // Financial IMPACT block
    s.addShape(SH.ROUNDED_RECTANGLE, {
      x: 0.4, y: 3.52, w: 12.5, h: 2.3,
      fill: { color: C.indigoLight }, line: { color: 'C7D2FE', width: 1 }, rectRadius: 0.1,
    })
    s.addText('재무적 IMPACT 요약', {
      x: 0.7, y: 3.68, w: 6, h: 0.38, fontSize: 13, color: C.indigo, bold: true, fontFace: KO,
    })

    s.addShape(SH.ROUNDED_RECTANGLE, {
      x: 0.7, y: 4.14, w: 5.5, h: 1.4,
      fill: { color: C.white }, line: { color: C.slate200, width: 1 }, rectRadius: 0.08,
    })
    s.addText('기간 내 누적 매출 목표', { x: 0.9, y: 4.22, w: 5, h: 0.32, fontSize: 11, color: C.slate500, fontFace: KO })
    s.addText(`${totalRev.toLocaleString()} 만원`, { x: 0.9, y: 4.58, w: 5, h: 0.75, fontSize: 26, color: C.indigo, bold: true, fontFace: KO })

    if (totalBudget > 0) {
      s.addShape(SH.ROUNDED_RECTANGLE, {
        x: 7.0, y: 4.14, w: 5.5, h: 1.4,
        fill: { color: C.white }, line: { color: C.slate200, width: 1 }, rectRadius: 0.08,
      })
      s.addText('기간 내 필요예산', { x: 7.2, y: 4.22, w: 5, h: 0.32, fontSize: 11, color: C.slate500, fontFace: KO })
      s.addText(`${totalBudget.toLocaleString()} 만원`, { x: 7.2, y: 4.58, w: 5, h: 0.75, fontSize: 26, color: C.orange, bold: true, fontFace: KO })
    }
  }

  // ── Slide 4: 대책과 실행안 ───────────────────────────────────
  if (task.countermeasures.length > 0) {
    const s = pptx.addSlide()
    addHeader(s,'3. 대책과 실행안', task.code, accent)

    task.countermeasures.slice(0, 6).forEach((cm, i) => {
      const y = 0.85 + i * 1.05

      s.addShape(SH.ROUNDED_RECTANGLE, {
        x: 0.4, y, w: 12.5, h: 0.92,
        fill: { color: i % 2 === 0 ? C.slate100 : C.white },
        line: { color: C.slate200, width: 1 },
        rectRadius: 0.07,
      })

      s.addShape(SH.OVAL, {
        x: 0.62, y: y + 0.21, w: 0.5, h: 0.5,
        fill: { color: C.indigo }, line: { width: 0 },
      })
      s.addText(String(cm.index), {
        x: 0.62, y: y + 0.21, w: 0.5, h: 0.5,
        fontSize: 14, color: C.white, bold: true, align: 'center', valign: 'middle', fontFace: KO,
      })

      s.addText(cm.description, {
        x: 1.28, y: y + 0.1, w: 9.7, h: 0.72,
        fontSize: 13, color: C.slate700, bold: true, wrap: true, valign: 'middle', fontFace: KO,
      })

      if (cm.startDate || cm.endDate) {
        const dateLabel = [
          cm.startDate ? cm.startDate.slice(5) : '',
          cm.endDate   ? cm.endDate.slice(5)   : '',
        ].filter(Boolean).join(' ~\n')
        s.addShape(SH.ROUNDED_RECTANGLE, {
          x: 11.05, y: y + 0.17, w: 1.65, h: 0.58,
          fill: { color: C.indigoLight }, line: { color: C.slate200, width: 1 }, rectRadius: 0.05,
        })
        s.addText(dateLabel, {
          x: 11.05, y: y + 0.17, w: 1.65, h: 0.58,
          fontSize: 9, color: C.indigo, bold: true, align: 'center', valign: 'middle', fontFace: KO,
        })
      }
    })
  }

  // ── Generate ─────────────────────────────────────────────────
  const data = await pptx.write({ outputType: 'arraybuffer' }) as unknown as ArrayBuffer
  const filename = `${task.code}_과제정의서.pptx`

  return new Response(data, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
