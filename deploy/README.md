# EVN-WARP production deployment

작업자: `OziinG`

WARP 운영 배포는 GitHub Actions, AWS OIDC, ECR immutable digest, SSM Run Command를 사용한다. 서버에서 소스를 build하거나 GitHub `APP_ENV`로 SSM을 덮어쓰지 않는다.

## 정본

| 대상 | 정본 |
| --- | --- |
| 운영 Application ENV | SSM SecureString `/evn-warp/app-env` |
| Server Functions build key | SSM SecureString `/evn-warp/next-server-actions-key` |
| 배포 코드 | `main`의 exact Git SHA |
| 배포 이미지 | ECR `evn-warp@sha256:...` digest |
| 빌드 캐시 | 별도 ECR `evn-warp-buildcache:buildcache-main` 가변 태그 |
| 서버 `.env` | SSM에서 생성하는 권한 `0600` 런타임 사본 |

GitHub Secrets는 `AWS_REGION`, `AWS_ROLE_ARN`, `EC2_INSTANCE_ID`만 사용한다. `APP_ENV`와 `CERTBOT_EMAIL`은 배포 workflow에서 사용하지 않는다.

## 안전 경계

- `validate`는 SSM을 읽고 key-level 정합성만 검사하며 서버 runtime과 traffic을 바꾸지 않는다.
- `prepare`는 exact `main`을 한 번 build하고 digest로 비활성 slot만 기동한다.
- 최초 `prepare`의 SQLite shared-path bootstrap에는 legacy PM2의 짧은 정지·재기동이 한 번 필요하다. 이후 slot 배포와 전환은 이 bootstrap을 반복하지 않는다.
- `switch`는 준비한 Revision이 현재 `main`과 일치할 때만 Nginx upstream을 전환한다.
- 외부 readiness가 실패하면 같은 명령 안에서 직전 upstream을 복원하고 복구 상태까지 확인한다.
- `rollback`은 직전 slot 또는 최초 legacy PM2 port 3000으로 돌아간다. DB restore나 digest 수기 입력은 하지 않는다.
- routine deploy는 `prisma db push`, seed, backfill, OS setup 반복 실행을 하지 않는다.
- `.env`, API key 일부, PM2 environment를 Actions와 SSM 출력에 기록하지 않는다.
- ECR `evn-warp`는 immutable release 전용이다. 가변 BuildKit cache를 release 저장소에 기록하지 않는다.
- ECR `evn-warp-buildcache`는 실행·배포하지 않으며 EC2 instance role에 pull 권한을 부여하지 않는다.

운영 순서는 [`RUNBOOK.md`](./RUNBOOK.md)를 따른다. 격리 검증 도구와 결과는 [`blue-green-lab/RUNBOOK.md`](./blue-green-lab/RUNBOOK.md), [`blue-green-lab/VALIDATION_RESULT.md`](./blue-green-lab/VALIDATION_RESULT.md)에 보존한다.
