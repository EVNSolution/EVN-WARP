import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  // 팀 생성
  const teams = await Promise.all([
    prisma.team.upsert({ where: { id: 'team-biz' },  update: {}, create: { id: 'team-biz',  name: '사업개발팀' } }),
    prisma.team.upsert({ where: { id: 'team-pm' },   update: {}, create: { id: 'team-pm',   name: 'PM팀' } }),
    prisma.team.upsert({ where: { id: 'team-mfg' },  update: {}, create: { id: 'team-mfg',  name: '제조운영팀' } }),
    prisma.team.upsert({ where: { id: 'team-sys' },  update: {}, create: { id: 'team-sys',  name: '시스템팀' } }),
    prisma.team.upsert({ where: { id: 'team-mkt' },  update: {}, create: { id: 'team-mkt',  name: '마케팅팀' } }),
    prisma.team.upsert({ where: { id: 'team-clvr' }, update: {}, create: { id: 'team-clvr', name: 'CLEVER팀' } }),
    prisma.team.upsert({ where: { id: 'team-mgmt' }, update: {}, create: { id: 'team-mgmt', name: '경영관리팀' } }),
  ])
  console.log('팀 생성 완료:', teams.map(t => t.name).join(', '))

  // 사업개발팀-01 (최상위 과제)
  const task01 = await prisma.strategyTask.upsert({
    where: { code: '사업개발팀-01' },
    update: {},
    create: {
      code: '사업개발팀-01', teamSeq: 1, subSeq: null,
      strategy: 'A', title: '신규 SI 고객 확보 — 식자재·의약품 라인',
      teamId: 'team-biz', owner: '범',
      startDate: new Date('2026-03-01'), endDate: new Date('2026-06-30'),
      status: '진행중', confirmed: true,
      problemStatement: '물류 SI 매출 비중 88% (월평균 5,000만원). 식자재·의약품 영역 확장 부재 시 연 KR 130억 대비 –14억 미달 예상.',
      goalStatement: '2026-06-30까지 신규 본계약 2건, 월매출 +2,000만원, 인력 외주 +1명.',
      monthlyTargets: {
        create: [
          { month: 4, year: 2026, revenueTarget: 500,  contractTarget: 0 },
          { month: 5, year: 2026, revenueTarget: 850,  contractTarget: 0 },
          { month: 6, year: 2026, revenueTarget: 2000, contractTarget: 2 },
          { month: 7, year: 2026, revenueTarget: 3000, contractTarget: 0 },
          { month: 8, year: 2026, revenueTarget: 3500, contractTarget: 0 },
        ],
      },
      countermeasures: {
        create: [
          { index: 1, description: '식자재 도메인 영업 1명 외주 계약 (3개월)', targetWeek: 'W18' },
          { index: 2, description: '식자재·의약품용 제안서 템플릿 v3 (사례 5건)', targetWeek: 'W18' },
          { index: 3, description: '5월 산업박람회 부스 참가 (K사·H사 의사결정자 컨택)', targetWeek: 'W18' },
        ],
      },
    },
  })

  // 사업개발팀-01-01 (하부 과제)
  await prisma.strategyTask.upsert({
    where: { code: '사업개발팀-01-01' },
    update: {},
    create: {
      code: '사업개발팀-01-01', teamSeq: 1, subSeq: 1,
      strategy: 'A', title: 'K사 박람회 후속 제안 및 본계약 체결',
      teamId: 'team-biz', owner: '범',
      parentId: task01.id,
      startDate: new Date('2026-05-27'), endDate: new Date('2026-06-30'),
      status: '진행중', confirmed: false,
      problemStatement: '박람회에서 K사 의사결정자 컨택 완료. 후속 미팅 및 견적서 제출 필요.',
      goalStatement: '6월 말까지 K사 본계약 1건 체결.',
      kpi1Label: 'K사 본계약', kpi1Value: '1건',
      countermeasures: {
        create: [
          { index: 1, description: 'K사 후속 미팅 (5/28) — 견적+사례5건 준비', targetWeek: 'W21' },
          { index: 2, description: '제안서 최종본 발송 및 Q&A 대응', targetWeek: 'W22' },
          { index: 3, description: '본계약 협상 및 서명', targetWeek: 'W25' },
        ],
      },
    },
  })

  // PM팀-01
  await prisma.strategyTask.upsert({
    where: { code: 'PM팀-01' },
    update: {},
    create: {
      code: 'PM팀-01', teamSeq: 1, subSeq: null,
      strategy: 'A', title: 'STEGO-Z 신제품 출하 및 고객사 확대',
      teamId: 'team-pm', owner: '김',
      startDate: new Date('2026-03-01'), endDate: new Date('2026-05-31'),
      status: '완료', confirmed: true,
      problemStatement: 'STEGO-Z 초도 물량 납기 지연 리스크. 고객사 의수 확인 후 차기 라인업 결정 필요.',
      goalStatement: '5월 말까지 STEGO-Z 8대 전량 출하 및 차기 라인업 사양 확정.',
      countermeasures: {
        create: [
          { index: 1, description: '고객사 의수 확인 미팅 (5/19)', targetWeek: 'W20' },
          { index: 2, description: '차기 라인업 확정 회의 (5/26)', targetWeek: 'W21' },
        ],
      },
    },
  })

  // CLEVER팀-01 (전략과제 B)
  await prisma.strategyTask.upsert({
    where: { code: 'CLEVER팀-01' },
    update: {},
    create: {
      code: 'CLEVER팀-01', teamSeq: 1, subSeq: null,
      strategy: 'B', title: 'CLEVER AI Agent v3 배포 및 SI 온보딩',
      teamId: 'team-clvr', owner: '제이스',
      startDate: new Date('2026-02-01'), endDate: new Date('2026-07-31'),
      status: '진행중', confirmed: true,
      problemStatement: 'CS 응답 시간 과다. SI 고객 도입 의향 있으나 온보딩 프로세스 미비.',
      goalStatement: 'v3.2 배포로 CS 응답 –35% 달성, SI 온보딩 2건 완료.',
      countermeasures: {
        create: [
          { index: 1, description: 'v3.2 정식 배포 및 모니터링', targetWeek: 'W20' },
          { index: 2, description: 'SI 온보딩 프로세스 문서화', targetWeek: 'W21' },
          { index: 3, description: 'SI 고객 2사 온보딩 완료', targetWeek: 'W23' },
        ],
      },
    },
  })

  // KPI 데이터 (기존 삭제 후 재생성)
  const kpiSeeds: Array<{ taskId: string; items: any[] }> = [
    {
      taskId: task01.id,
      items: [
        { index: 1, type: '정량', subType: '금액', label: '월매출 증가분', target: '2000', targetNum: 2000, unit: '만원' },
        { index: 2, type: '정량', subType: '건수', label: '신규 본계약', target: '2', targetNum: 2, unit: '건' },
        { index: 3, type: '정량', subType: '인원수', label: '외주 인력 확보', target: '1', targetNum: 1, unit: '명' },
      ],
    },
  ]
  for (const { taskId, items } of kpiSeeds) {
    await prisma.kpiItem.deleteMany({ where: { taskId } })
    await prisma.kpiItem.createMany({ data: items.map(k => ({ ...k, taskId })) })
  }
  console.log('KPI 데이터 설정 완료')

  console.log('\n✅ 샘플 데이터 시딩 완료!')
  console.log('  - 팀 7개')
  console.log('  - 사업개발팀-01 (최상위) + 사업개발팀-01-01 (하부)')
  console.log('  - PM팀-01 (완료)')
  console.log('  - CLEVER팀-01 (AI 기반)')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
