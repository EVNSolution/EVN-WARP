# EVN-WARP deploy

PEM/SSH 없이 GitHub Actions 버튼으로 EC2에 배포한다.

## 현재 값

- Host: `warp.cleversystem.ai`
- EC2: `i-0c79be3e4d80b5eb5` (`WARP`, `t3.micro`), SSM Online
- DNS: `warp.cleversystem.ai` → `3.34.253.235`
- Secrets set: `AWS_REGION`, `AWS_ROLE_ARN`, `EC2_INSTANCE_ID`, `APP_ENV`, `CERTBOT_EMAIL`

## 실행

GitHub Actions → **Deploy EC2 via SSM** → **Run workflow**.

동작:

1. `APP_ENV`를 SSM SecureString `/evn-warp/app-env`에 동기화
2. EC2에서 Ubuntu 패키지, Node.js, PM2, Nginx, Certbot 보정
3. repo fetch, `npm ci`, `prisma generate`, `prisma db push`, 관리자 seed, `next build`
4. PM2 reload/start 후 `/login` 헬스체크

`dev.db`는 배포 전 `/opt/evn-warp-backups`에 백업한다.
