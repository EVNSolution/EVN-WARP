# CLEVER HQ Account Interceptor — Integration Evidence

> `CLEVER-HQ-ACCOUNT-INTERCEPTOR / contract 1.0`

이 파일은 모듈과 함께 소비 시스템에 복사하는 변경 증적이다. 소비 저장소의 `AGENTS.md`, 개인 설정, Codex·Claude 지침, 세션·에이전트 정보는 수정하거나 교체하지 않는다.

## 적용 기록

아래 항목을 Issue와 PR 본문에 그대로 채운다.

- Consumer system: WARP
- Consumer repository: `EVNSolution/EVN-WARP`
- Account authority: `system:warp`
- Immutable subject source: NextAuth session `user.id`, sourced from the WARP `User.id` database primary key
- Auth boundary binding: Next.js `proxy.ts` overwrites caller subject and forwards correlation; protected route revalidates it against a fresh `auth()` result
- Non-HTTP execution boundary (CLI, batch, worker): dispatcher receives identity only from the persisted transactional Outbox; it cannot manufacture an Account subject
- Transactional Outbox boundary: `/api/account/team` uses `executeAccountAction()` to commit `User.teamId` and `AccountEvidenceOutbox` atomically
- HQ Gateway route: `POST /api/v1/actions`
- Interceptor contract: `1.0`
- HQ source revision: `75604c9`
- Copied path: `clever_account_interceptor/`
- Applied by: `OziinG`
- Reviewed by system owner:
- Reviewed by security owner:
- Verification commands and results: `npm run test:account-control` (14 passed); `npm run build` (passed); targeted ESLint and TypeScript checks (passed); HQ `tracker` suite (351 passed, 1 skipped); actual WARP Outbox/Dispatcher ↔ local HQ probe passed outage/recovery, wrong-Account denial and forged-MachineClient denial
- Rollback procedure: disable the external dispatcher first; revert Issue #2 changes; restore the pre-change Prisma schema only after preserving or exporting pending Outbox evidence
- Known gaps: local verification only; no AWS Secret/SSM, HTTPS domain, production Gateway, schedule, alert, or WARP-wide write-route migration yet

## 필수 변경 표식

Issue 제목:

```text
[CLEVER HQ][Account Interceptor 1.0] <SYSTEM> account action evidence integration
```

PR 제목:

```text
[CLEVER HQ] Bind <SYSTEM> actions to immutable Account context
```

Commit 메시지는 소비 저장소 규칙을 우선하되, 아래 trailer를 포함한다.

```text
CLEVER-HQ-Contract: account-interceptor/1.0
CLEVER-HQ-Authority: system:<stable-system-key>
CLEVER-HQ-Source-Revision: <hq-commit-sha>
CLEVER-HQ-Evidence: <issue-or-pr-reference>
```

## 파일 무결성 기록

PR 본문에 소비 언어에 맞는 복사 직후 결과를 첨부한다.

Python:

```sh
shasum -a 256 clever_account_interceptor/__init__.py \
  clever_account_interceptor/core.py \
  clever_account_interceptor/test_core.py \
  clever_account_interceptor/README.md \
  clever_account_interceptor/INTEGRATION_EVIDENCE.md

python -m unittest clever_account_interceptor.test_core
```

TypeScript:

```sh
shasum -a 256 \
  clever_account_interceptor/typescript/core.ts \
  clever_account_interceptor/typescript/index.ts \
  clever_account_interceptor/typescript/core.test.ts \
  clever_account_interceptor/README.md \
  clever_account_interceptor/INTEGRATION_EVIDENCE.md

npx tsx --test clever_account_interceptor/typescript/core.test.ts
```

## 금지 사항

- 소비 저장소의 기존 `AGENTS.md`, `CLAUDE.md`, `.codex/`, `.claude/` 또는 유사한 에이전트·세션 지침을 복사본으로 덮어쓰지 않는다.
- 기존 담당자·Reviewer·CODEOWNERS·Issue assignee를 자동 변경하지 않는다.
- 모듈 적용을 근거로 저장소 전체의 운영 원칙이나 권한을 재정의하지 않는다.
- Issue·PR·Commit 증적 없이 배포하지 않는다.
