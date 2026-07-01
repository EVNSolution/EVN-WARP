# EVN-WARP manual EC2 deploy

목표: PEM/SSH 없이 GitHub Actions 버튼으로만 EC2에 배포한다.

## GitHub Secrets

필수:

- `AWS_REGION`
- `EC2_INSTANCE_ID`
- `AWS_ROLE_ARN` 권장, 또는 `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`

선택:

- `APP_ENV`: 서버 `.env` 전체 내용. `ADMIN_EMAIL`/`ADMIN_PASSWORD`가 있으면 배포 중 관리자 계정을 생성/갱신
- `DEPLOY_GITHUB_TOKEN`: repo가 private일 때만. clever-deploy-bot PAT를 넣는다.
- `CERTBOT_EMAIL`: `issue_cert=true`로 첫 인증서 발급할 때만

`APP_ENV`가 없으면 서버에서 최초 1회 최소 `.env`를 만든다.

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="https://warp.cleversystem.ai"
AUTH_URL="https://warp.cleversystem.ai"
AUTH_TRUST_HOST="true"
AUTH_SECRET="..."

# 선택: 최초 관리자 자동 생성/갱신
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="change-me"
ADMIN_NAME="관리자"
ADMIN_ROLE="admin"
```

## EC2 IAM role

EC2 인스턴스 role:

- `AmazonSSMManagedInstanceCore`
- `ssm:GetParameter` on `/evn-warp/*`

## GitHub deploy role/user permission

Actions 쪽 AWS 권한:

- `ssm:SendCommand`
- `ssm:GetCommandInvocation`
- `ssm:PutParameter` on `/evn-warp/*`

## 실행

GitHub Actions → **Deploy EC2 via SSM** → **Run workflow**.

- `ref`: 배포할 브랜치/태그. 기본 `main`
- `run_setup`: EC2 패키지, nginx, pm2 보정. 기본 `true`
- `run_db_push`: Prisma DB 반영. 기본 `true`
- `issue_cert`: `warp.cleversystem.ai` DNS와 443이 준비됐을 때만 `true`

배포 흐름:

1. GitHub Secrets를 SSM SecureString으로 동기화
2. SSM Run Command로 EC2에서 `deploy/remote-deploy.sh` 실행
3. repo clone/fetch
4. `npm ci`
5. `npx prisma generate`
6. `npx prisma db push`
7. `npm run build`
8. `pm2 reload/start`
9. `http://127.0.0.1:3000/login` 헬스체크

SQLite `dev.db`는 배포 전 `/opt/evn-warp-backups`에 자동 백업한다.

## 현재 인프라 상태 (2026-07-01)

준비됨:

- `warp.cleversystem.ai` A 레코드 → `43.201.160.163`.
- 대상 EC2: `i-08ceeda82720b8c37` (`CHEONHA`), SSM Online.
- 보안그룹: 80/443 open.
- EC2 role: `/evn-warp/*` Parameter Store 읽기 권한 추가.
- GitHub OIDC role: `EVNWarpGitHubDeployRole`.
- GitHub Actions secrets: `AWS_REGION`, `EC2_INSTANCE_ID`, `AWS_ROLE_ARN`, `APP_ENV`, `CERTBOT_EMAIL`.

남은 선택 작업:

- repo가 private으로 바뀌면 `DEPLOY_GITHUB_TOKEN`에 clever-deploy-bot PAT 추가.
- 최초 관리자 계정이 필요하면 `APP_ENV`에 `ADMIN_EMAIL`/`ADMIN_PASSWORD` 추가.
- SSH가 필요 없으면 보안그룹 22 inbound 제거.
