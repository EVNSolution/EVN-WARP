# WARP 운영 Blue/Green Runbook

작업자: `OziinG`

관리자는 image hash를 복사하거나 입력하지 않는다. `prepare`가 ECR에서 exact digest를 수집하고 서버 manifest에 기록한다.

## 1. 최초 준비

AWS 관리자는 한 번만 다음을 확인한다.

- ECR `evn-warp`가 `IMMUTABLE`, scan-on-push로 존재한다.
- ECR `evn-warp-buildcache`가 `MUTABLE`, AES256으로 존재하며 untagged cache를 3일 후 정리한다.
- `/evn-warp/next-server-actions-key`가 16, 24 또는 32 byte AES key의 Base64 SecureString이다.
- GitHub deploy role trust가 `repo:EVNSolution/EVN-WARP:ref:refs/heads/main`으로 제한되어 있다.
- GitHub role에는 `ssm:PutParameter`가 없고 exact build key read, release ECR push·scan, cache ECR push·pull, 지정 EC2 SSM command만 있다.
- EC2 role에는 `/evn-warp/*` read와 ECR `evn-warp` pull만 있다.

정책 정본은 [`aws/github-trust-main.json`](./aws/github-trust-main.json), [`aws/github-deploy-policy.json`](./aws/github-deploy-policy.json), [`aws/instance-policy.json`](./aws/instance-policy.json)이다.

빌드 캐시 저장소는 최초 한 번만 아래와 같이 생성한다. release 저장소의 tag mutability는 변경하지 않는다.

```bash
aws ecr create-repository \
  --repository-name evn-warp-buildcache \
  --image-tag-mutability MUTABLE \
  --image-scanning-configuration scanOnPush=false \
  --encryption-configuration encryptionType=AES256 \
  --tags Key=System,Value=EVN-WARP Key=Purpose,Value=BuildCache Key=Owner,Value=OziinG
aws ecr put-lifecycle-policy \
  --repository-name evn-warp-buildcache \
  --lifecycle-policy-text file://deploy/aws/buildcache-lifecycle-policy.json
aws iam put-role-policy \
  --role-name EVNWarpGitHubDeployRole \
  --policy-name EVNWarpGitHubDeployPolicy \
  --policy-document file://deploy/aws/github-deploy-policy.json
```

## 2. 배포 순서

GitHub Actions의 **Deploy WARP Blue-Green via SSM**에서 아래 action을 순서대로 실행한다.

1. `validate`
   - ENV 값은 출력하지 않는다.
   - 필수 key, URL, secret 길이, path 형식을 검사한다.
   - `legacy_env_matches_ssm=true`와 Parameter version을 확인한다.
2. `prepare`
   - critical npm audit과 source tests를 통과한다.
   - image를 build하거나 같은 SHA image를 재사용한다.
   - immutable release ECR과 mutable cache ECR의 경계를 먼저 검증한다.
   - ECR OS scan의 critical/high가 모두 0이어야 한다.
   - Docker와 Nginx upstream bootstrap은 최초 한 번만 수행한다.
   - 최초 bootstrap은 SQLite 경로를 안전하게 공유하기 위해 legacy PM2를 정지 후 재기동한다. 이 한 번의 짧은 재기동은 무정지로 간주하지 않으며, 이용이 적은 시간에 수행한다.
   - 기존 PM2 port 3000 traffic을 유지한 채 inactive port 3101 또는 3102를 준비한다.
3. `status`
   - active, previous, candidate slot과 exact image reference를 확인한다.
4. `switch`
   - candidate readiness와 현재 `main` Revision 일치를 재검사한다.
   - Nginx reload 후 공개 HTTPS readiness에서 expected digest를 확인한다.
5. 최소 30분 관찰
   - HTTP 5xx, Docker restart, OOM, `SQLITE_BUSY`, upload 404를 확인한다.
6. 최초 배포에서는 `rollback` 후 공개 `/login`을 확인하고, 같은 Revision을 다시 `prepare`·`switch`하여 복구 절차를 증명한다.

## 3. 실패 시

- `validate` 실패: SSM을 수정하지 말고 누락 또는 형식 오류 key 이름만 확인한다.
- `prepare` 실패: traffic은 기존 active에 남는다. 실패 container log에 secret 값이 없는지 확인한다.
- `switch` 실패: script가 직전 upstream을 자동 복구한다. `status`와 공개 `/login`을 확인한다.
- 자동 복구까지 실패: `/opt/evn-warp-runtime/legacy-nginx.conf`와 legacy PM2 port 3000을 장애 대응 기준으로 사용한다.

DB schema/data migration은 이 workflow에서 수행하지 않는다. 필요한 migration은 별도 Issue, backup, 양 Revision 호환성 검증을 거친다.

## 4. ENV 변경

운영 ENV는 SSM `/evn-warp/app-env`만 수정한다. 변경 전후 Parameter version을 기록하고 값은 터미널·Issue·PR·Actions에 출력하지 않는다. 수정 후 `validate`를 먼저 실행한다.

필수 key 명세는 [`validate-env.py`](./validate-env.py)가 정본이며 [`.env.example`](../.env.example)은 설명용이다.

## 5. 과거 노출 대응

2026-07-09 실행된 과거 `Export EC2 env`, `Check OCR Environment`, `Test API Keys` workflow는 값을 출력할 수 있었다. 해당 workflow와 test script는 제거한다. 당시와 같은 credential이 현재도 유지된다면 provider에서 회전하고 SSM version을 기록한다. 과거 Actions log를 근거로 secret 값을 Issue나 문서에 복사하지 않는다.
