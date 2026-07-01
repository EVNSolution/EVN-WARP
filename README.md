# EVN WARP — 이브이앤솔루션 영업·목표 관리 시스템

EV 차량 영업 전문 회사인 **이브이앤솔루션**의 내부 운영 도구입니다.  
영업 퍼널(리드 파이프라인), CRM 고객 관리, 전략 과제(A3), 주간 업무 보고를 하나의 앱에서 처리합니다.

---

## 기술 스택

| 항목 | 버전 / 내용 |
|------|-------------|
| Framework | Next.js **16.2.7** (App Router, `--webpack` flag 필수) |
| Runtime | React **19**, TypeScript **5** |
| Styling | Tailwind CSS **v4** (PostCSS 방식, `@tailwind` 지시어 없음) |
| ORM | Prisma **7.8** |
| DB (로컬) | SQLite (`dev.db`) |
| DB (운영) | Turso / libSQL (`@prisma/adapter-libsql`) |
| 인증 | NextAuth.js v5 beta |
| AI | Anthropic Claude SDK, Google Generative AI |
| 아이콘 | lucide-react |

> **주의:** Next.js 16은 breaking change가 많습니다. `node_modules/next/dist/docs/` 문서를 먼저 읽으세요.

---

## 로컬 실행

```bash
npm install

# Prisma 클라이언트 생성 (app/generated/prisma 에 출력)
npx prisma generate

# DB 스키마 적용
npx prisma db push

# 개발 서버 (webpack 모드 필수)
npm run dev
```

> `npx prisma db push`는 클라이언트를 자동 재생성하지 않습니다.  
> 스키마 변경 시 반드시 `npx prisma generate`를 별도로 실행하세요.  
> 스키마 변경 후 개발 서버를 재시작해야 새 Prisma 클라이언트가 적용됩니다.

---

## 환경 변수

`.env` 파일을 루트에 생성하세요 (`.env*` 는 gitignore 처리됨):

```env
# 로컬 SQLite
DATABASE_URL="file:./dev.db"

# 운영 Turso (선택)
TURSO_DATABASE_URL="libsql://..."
TURSO_AUTH_TOKEN="..."

# NextAuth
AUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"

# AI (선택)
ANTHROPIC_API_KEY="..."
GOOGLE_AI_API_KEY="..."
```

---

## 페이지 구조

```
app/
├── (auth)/
│   └── login/              # 로그인 페이지 (NextAuth)
├── (app)/
│   ├── dashboard/          # 대시보드 (KPI 요약)
│   ├── funnel/             # 영업 퍼널 — 리드(Deal) 파이프라인
│   │   ├── page.tsx        # PipelineView 칸반 보드 (stageCode 기준 컬럼)
│   │   └── [id]/           # 리드 상세 — 단계별 체크리스트·증빙서류
│   ├── customers/          # CRM 고객 관리
│   │   ├── page.tsx        # B2B / B2C 필터, 이름·전화번호·법인명 검색
│   │   └── [id]/           # 고객 상세 (개인정보, 법인정보, 차량, 화주, 활동이력)
│   ├── a3/                 # 전략 과제 (A3 양식)
│   ├── weekly/             # 주간 업무 보고
│   └── trip/               # 출장·경비 관리
└── api/                    # Route Handlers (REST)
    ├── customers/[id]/     # GET · PUT · DELETE
    ├── customers/[id]/documents/  # 고객 서류 업로드·삭제
    ├── deals/              # 리드(Deal) CRUD
    ├── deals/[id]/checks/  # 체크리스트 저장
    └── activities/         # 영업 활동 로그
```

---

## 데이터 모델 핵심 관계

```
Customer (고객, 단일 소스)
  ├── Lead / Deal (리드·딜, 1:N)
  │     └── DealDocuments (딜별 서류, 1:N)
  └── Activity (영업 활동 로그, 1:N)
```

**Customer가 단일 소스입니다.** 개인정보는 Customer에서 관리하고, 딜은 Customer에 연결됩니다.

### 고객 분류 (`customerSegment`)

| 값 | 설명 |
|----|------|
| `B2C` | 개인 고객 (지입차주, 개인사업자 포함) |
| `B2B` | 법인 고객 (운송회사) |

### B2B 전용 Customer 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `companyName` | String? | 법인명 |
| `businessRegNo` | String? | 사업자등록번호 |
| `employeeCount` | Int? | 직원 수 |
| `b2bRevenue1` | String? | 전년도 매출 (억 단위 문자열) |
| `b2bRevenue2` | String? | 2년 전 매출 |
| `b2bRevenue3` | String? | 3년 전 매출 |
| `vehicleListJson` | String? | 보유 차량 목록 JSON (`[{name, count}]`) |

### 리드(Deal) 핵심 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `stageCode` | String | 현재 파이프라인 단계 (`1-1` ~ `4-2`) |
| `salesStatus` | String | `active` \| `completed` \| `lost` |
| `checksJson` | String? | 체크리스트 상태 JSON `{ [key]: ISO날짜문자열 }` |
| `customerSegment` | String? | 딜 생성 시점의 고객 분류 스냅샷 |

---

## 파이프라인 구조

단계별 체크리스트와 증빙서류는 **`lib/pipeline.ts`가 단일 소스**입니다.  
`data/pipeline-checklists.json`, `data/pipeline-documents.json`에서 라벨을 오버라이드할 수 있습니다.

```
1단계: 잠재리드
  1-1 미성숙 리드  — 일반화물자동차운송업 확보 여부 확인
  1-2 잠재 리드    — 담당자 신뢰·매출·소개 확보

2단계: 활성리드
  2-1 계약 진행 중  — 계약서 작성, 보조금 서류
  2-2 캐피탈 진행 중 — 인감증명서, 캐피탈 승인
  2-3 출고 준비 중  — 캐피탈 실행, 임시번호판, 탁송

3단계: 출고
  3-1 특장
  3-2 추가 작업
  3-3 출고 완료    — 캐피탈 2차 실행, 보조금 행정, 썬팅·블랙박스, 고객 인도

4단계: 사후 관리
  4-1 영업용번호판
  4-2 보험/취등록세
```

### B2B 체크리스트 분기

`PipelineProcess.checksB2B`가 정의된 단계에서 B2B 고객은 기본 `checks` 대신 `checksB2B`를 사용합니다.  
현재 1-2 단계에 B2B 전용 체크리스트(담당자 신뢰 확보, 법인 매출 확인, 회사소개 완료)가 적용됩니다.

### 체크리스트 `field` 연동

`PipelineCheck.field` 값이 있으면 Customer 데이터에서 자동으로 값을 표시합니다:

| field 값 | 표시 내용 |
|----------|-----------|
| `vehicle` | 차량명 · 대수 |
| `shipper` | 화주명 · 배송지역 |
| `b2bRevenue` | 최근 연도 법인 매출 (예: `2025년 20억`) |

---

## Prisma 주의사항

- 클라이언트 출력 경로: `app/generated/prisma` (비표준 경로 — `schema.prisma`의 `output` 참조)
- import: `import { prisma } from '@/lib/db'`
- 스키마 변경 후 필수 순서:
  ```bash
  npx prisma db push    # DB 스키마 반영
  npx prisma generate   # 클라이언트 재생성
  # 개발 서버 재시작
  ```
- `app/generated/prisma/`는 `.gitignore`에 포함됩니다 — 클론 후 반드시 `npx prisma generate` 실행 필요.

---

## 신규 리드 생성 흐름

1. `PipelineView` → **NewDealModal** 오픈
2. 고객 검색: 이름 / 전화번호 / 법인명(개인사업자 포함) 세 가지 모드
3. 전화번호로 기존 고객 조회 → 있으면 update, 없으면 create (`app/api/deals/route.ts`)
4. 고객 생성·연결 후 Deal 레코드 생성 → stageCode `1-1`로 시작

> **중복 방지:** 전화번호가 동일한 고객은 새로 생성하지 않고 기존 고객에 딜을 추가합니다.

---

## 개발 시 주의사항

- `npm run dev`는 반드시 `--webpack` 옵션을 포함합니다 (`package.json` 참조).
- `dev.db`는 gitignore 처리됩니다. 팀원은 로컬에서 `npx prisma db push`로 빈 DB를 생성해야 합니다.
- Server Component와 Client Component 혼용: `'use client'` 경계에 주의하세요.
- Tailwind v4는 `tailwind.config.js` 없이 CSS에서 직접 설정합니다.
- 고객 상세 페이지(`customers/[id]`)는 전체 저장 방식입니다 — 부분 필드 저장 없이 `handleSave` 호출 시 모든 필드를 한 번에 전송합니다.

---

## 브랜치 전략

| 브랜치 | 용도 |
|--------|------|
| `main` | 운영 배포 기준 |
| `master` | 개발 브랜치 (→ main으로 통합) |
| `feature/*` | 기능 개발 |
