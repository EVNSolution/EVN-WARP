# CLEVER Account Interceptor

이 디렉토리는 다른 내부 시스템에 그대로 복사할 수 있는 표준 라이브러리 전용 모듈이다. HQ나 Django 모델에 의존하지 않으며 Python 정본과 TypeScript 정본이 같은 계약을 구현한다. 다음 네 가지만 담당한다.

현재 계약 버전은 `1.0`이다. 소비 시스템 README에는 적용한 계약 버전과 authority를 함께 기록한다.

- 시스템에 고정된 Account authority 검증
- 인증 계층이 결정한 불변 subject 검증
- correlation 문맥 생성과 동기·비동기 코드 전파
- HQ 호출용 안전한 헤더 생성

이 모듈은 Account를 생성하거나 Person을 추측하지 않는다. 토큰, Authorization 헤더, 요청·응답 본문과 provider 응답도 보관하지 않는다.

## 소비 시스템 적용

시스템 담당자는 최초 한 번 다음 두 접점을 해당 시스템 코드 구조에 맞춰 구현한다. 무수정 설치를 전제하지 않는다.

1. 기존 인증 결과에서 재사용되지 않는 내부 사용자 UUID를 반환하는 `subject resolver`
2. 기존 업무 트랜잭션 안에서 안전한 작업 식별자와 `context.safe_evidence()`를 저장하는 Evidence Outbox

개별 업무 기능은 HQ를 직접 호출하지 않는다. Outbox worker가 동일한 idempotency key로 HQ Gateway에 전송한다. 프레임워크의 전역 HTTP 필터만으로 끝내지 않는다. 배치, CLI, worker가 HTTP 필터를 우회할 수 있으므로 의미 있는 변경 작업은 기존 공통 Command/Service 경계에서도 `current_account_context(required=True)`를 확인한다.

인터셉터가 자동으로 확정할 수 있는 것은 Account 호출 문맥까지다. HTTP 응답만으로 업무 커밋을 추측하지 않으며, 의미 있는 Action은 시스템의 기존 공통 Command/Service 경계에서 Outbox에 기록해야 한다. 공통 경계가 없다면 먼저 하나의 얇은 실행 함수를 만들고 주요 변경 작업만 그 경로로 모은다.

Python 적용 예시는 다음과 같다.

```python
from clever_account_interceptor import bind_account_context, build_account_context


def account_filter(request, next_handler):
    context = build_account_context(
        authority="system:warp",                 # 설정값; 요청에서 받지 않는다.
        subject=str(request.authenticated_user.id),
        correlation_id=request.headers.get("X-Correlation-ID"),
    )
    with bind_account_context(context):
        return next_handler(request)
```

Next.js 같은 TypeScript 소비 시스템은 인증 계층이 확정한 subject를 사용해 같은 문맥을 만든다.

```typescript
import { buildAccountContext } from './clever_account_interceptor/typescript'

const context = buildAccountContext({
  authority: 'system:warp',
  subject: session.user.id,
  correlationId: request.headers.get('X-Correlation-ID'),
})
```

업무 트랜잭션에서는 시스템의 기존 Outbox 모델을 사용한다.

```python
from clever_account_interceptor import current_account_context


def complete_business_action(action):
    context = current_account_context(required=True)
    action.save()
    EvidenceOutbox.objects.create(
        action_key="warp.approval.completed",
        operation_key=str(action.id),
        account_context=context.safe_evidence(),
    )
```

worker는 고정된 MachineClient credential과 아래 헤더를 사용한다.

```python
headers = context.outbound_headers(idempotency_key=str(outbox.operation_key))
headers["Authorization"] = load_machine_credential_from_secret_store()
```

## 복제 규칙

- 이 모듈의 공통 문서와 소비 언어에 해당하는 source-controlled 구현·테스트만 복사한다. Python 소비자는 `__init__.py`, `core.py`, `test_core.py`를, TypeScript 소비자는 `typescript/`를 사용한다. `__pycache__`, `.pyc` 같은 실행 부산물과 소비 저장소의 루트 문서나 에이전트·세션 설정을 함께 복사하거나 교체하지 않는다.
- `INTEGRATION_EVIDENCE.md`를 함께 두고 Issue, PR, Commit에 `CLEVER-HQ-ACCOUNT-INTERCEPTOR / contract 1.0` 표식을 남긴다.
- 소비 시스템 README 변경은 해당 저장소 Owner가 승인할 때만 한다. 변경하지 못하면 Issue와 PR 증적을 정본으로 삼는다.
- `core.py`와 `typescript/core.ts`는 시스템별로 수정하지 않는다. framework binding, subject resolver, 기존 Command/Service 연결부만 소비 시스템 쪽에 둔다.
- authority는 `system:<stable-system-key>` 형식으로 배포 설정에 고정한다.
- 이메일, 이름, 로그인 문자열을 subject로 사용하지 않는다.
- 외부 전송 실패는 업무 트랜잭션을 되돌리지 않는다. Outbox가 동일 idempotency key로 재시도한다.
- HQ가 없는 동안에도 기존 Data Plane은 계속 동작해야 한다.
- 기존 `AGENTS.md`, `CLAUDE.md`, `.codex/`, `.claude/`, CODEOWNERS, 담당자와 세션 정보를 자동 변경하지 않는다.
