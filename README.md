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

# 로컬 DB 경로 override (선택)
WARP_DB_PATH="./dev.db"

# NextAuth
AUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"

# AI (선택)
ANTHROPIC_API_KEY="..."
GOOGLE_AI_API_KEY="..."

# CLEVER HQ 메일 파일럿 (선택)
# 기본값은 비활성화입니다. 기능 검증/운영 적용 시에만 true로 켭니다.
CLEVER_HQ_MAIL_ENABLED="false"
# 전용 HQ MachineClient는 mail.send scope 하나만 부여합니다.
CLEVER_HQ_BASE_URL="http://127.0.0.1:3000"
CLEVER_HQ_AUTHORIZATION="Bearer <client_key>.<secret>"
```

---

## CLEVER HQ 출장 결재 메일 파일럿

출장 결재 알림은 기존 WARP 인앱 `Notification`을 계속 생성하면서, `CLEVER_HQ_MAIL_ENABLED=true`이고 대상 사용자의 내부 회사 이메일이 있으면 CLEVER HQ 메일 요청도 내구 큐에 적재합니다. 큐 레코드는 `Notification.id`를 기준으로 하나만 생성되며 HQ idempotency key는 `warp.notification.<notification_id>`입니다. HQ credential은 `.env`의 `CLEVER_HQ_AUTHORIZATION`에서만 읽고 DB에는 저장하지 않습니다.

동작 경계:

- 대상 `User.email`이 `@evnsolution.com` 내부 주소일 때만 큐에 적재합니다. 외부 발송 scope는 사용하지 않습니다.
- HQ 메일 파일럿은 기본 비활성화입니다. `CLEVER_HQ_MAIL_ENABLED=true`일 때만 `HqMailRequest` 테이블에 접근합니다.
- `Notification`과 HQ 큐 적재는 같은 Prisma transaction에서 처리합니다.
- 즉시 1건 best-effort dispatch를 시도하지만, HQ 네트워크 오류·5xx·429·설정 누락은 큐에 남깁니다.
- 발송 중인 큐 row는 짧은 `processing` lease로 claim하여 동시 drain 중복 발송을 막고, worker가 죽으면 같은 idempotency key로 재처리됩니다.
- HQ `202 accepted` 또는 `200 replayed`는 WARP 큐의 terminal 상태이며 `operation_id`를 저장합니다. 이 시점부터 실제 메일 전달 추적과 장애 조사는 HQ의 메일 작업 상태/로그/재conciliation 화면에서 확인합니다.
- 영구 4xx와 `idempotency_conflict`는 `held`로 멈추고 자동 재시도하지 않습니다.
- WARP는 HQ 수락 이후 SMTP, Graph, 다른 provider로 우회하지 않고 HQ provider 상태를 polling하지 않습니다.

HQ 전용 클라이언트 발급:

```bash
python manage.py clever_machine_client_create --system-key warp --client-key warp-mail-pilot --name "WARP mail pilot" --scope mail.send
```

이 명령은 secret을 1회만 출력합니다. 출력값은 WARP 배포 secret manager 또는 로컬 `.env`의 `CLEVER_HQ_AUTHORIZATION`에만 넣고, repo·문서·DB에는 저장하지 않습니다.

큐 스키마 적용:

```bash
npx prisma migrate deploy
```

마이그레이션을 쓰는 배포 환경은 기능 활성화 전에 위 명령으로 `HqMailRequest` 테이블을 먼저 적용합니다. 로컬 개발의 기존 `npx prisma db push` 흐름은 위의 Prisma 섹션 그대로 유지합니다.

수동 복구:

```bash
npm run hq-mail:drain -- --limit 10
npm run hq-mail:drain -- --limit 10 --force  # 장애 복구 직후 지연 대기열까지 수동 처리
```

수동 drain은 앱 런타임과 동일한 DB 선택 규칙을 사용합니다: `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`이 있으면 Turso/libSQL, 없으면 `WARP_DB_PATH`, 없으면 `DATABASE_URL`, 없으면 루트 `dev.db`입니다. Turso token은 출력하지 않습니다.

검증:

```bash
npm run test:hq-mail
```

루트 `env.template`에 HQ 파일럿 환경 변수 키만 남겨 두었습니다. 실제 secret 값은 문서·로그·DB가 아니라 `.env` 또는 배포 secret manager에만 둡니다.

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
