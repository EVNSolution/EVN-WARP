# WARP Blue/Green 격리 검증 Runbook

작업자: `OziinG`

이 Runbook은 현재 운영 WARP를 수정하지 않고, 로컬 Docker와 일회성 EC2에서 동일한 Blue/Green 전환 계약을 검증한다. 이미지 digest 수집과 기록은 스크립트가 수행하므로 관리자가 직접 해시값을 복사하지 않는다.

## 1. 로컬 관문

```bash
./deploy/blue-green-lab/labctl.sh init
for release in lab-a lab-b lab-c lab-d lab-e; do
  ./deploy/blue-green-lab/labctl.sh build "$release"
done
./deploy/blue-green-lab/verify.sh
```

성공 조건은 다음과 같다.

- `lab-a` 최초 기동
- `lab-a`에서 `lab-b`로 전환하는 동안 연속 요청 오류 0건
- readiness가 실패하는 `lab-c` 승격 차단
- 외부 검증이 실패하는 `lab-d`의 자동 복구와 이전 digest 복원
- `lab-e` 정상 전환, 활성 컨테이너 재시작 후 digest 유지
- `lab-e`에서 `lab-b`로 수동 롤백하는 동안 연속 요청 오류 0건

로컬 WARP 프록시는 `http://127.0.0.1:3300`을 사용한다. CLEVER HQ의 `3000` 포트는 건드리지 않는다.

## 2. 격리 AWS 관문

작업 브랜치의 변경을 먼저 커밋한다. `push-all`은 dirty worktree를 거부한다.

```bash
./deploy/blue-green-lab/aws-labctl.sh create
./deploy/blue-green-lab/aws-labctl.sh push-all
./deploy/blue-green-lab/aws-labctl.sh install
./deploy/blue-green-lab/aws-labctl.sh register-all
./deploy/blue-green-lab/aws-labctl.sh verify
./deploy/blue-green-lab/aws-labctl.sh collect
./deploy/blue-green-lab/aws-labctl.sh destroy
```

생성되는 것은 lab 전용 ECR, 암호화·비공개 S3 source bucket, CodeBuild, IAM Role, Instance Profile, 인바운드가 없는 Security Group, 일회성 EC2와 암호화된 gp3 볼륨뿐이다. CodeBuild가 clean commit archive에서 5개 이미지를 만들며 서빙 EC2에서는 빌드하지 않는다. 운영 WARP의 EC2, DNS, Load Balancer, Security Group, SSM Parameter와 배포 경로는 참조하지 않는다.

기본값은 서울 리전, `t3.small`, 24 GiB gp3, 24시간 만료 표시다. 실제 삭제는 마지막 `destroy`가 수행한다. 실패해도 먼저 `collect`를 실행하고, 원인을 확인한 뒤 `destroy`한다.

## 3. 증거 확인

로컬 증거는 아래 ignored 경로에 남는다.

```text
deploy/blue-green-lab/runtime/evidence.jsonl
deploy/blue-green-lab/runtime/aws-evidence/
```

`aws-evidence`에는 CloudFormation 상태, 생성 자원, EC2 구성, ECR image digest, 원격 A–E 시나리오 이벤트가 포함된다. 계정 비밀번호, 토큰, 운영 DB와 업로드는 포함하지 않는다.

## 4. 중단 조건

- 브랜치 source revision과 이미지 기록이 일치하지 않음
- 이미지가 tag로만 식별되고 digest가 없음
- seed DB에 사용자 또는 Account Outbox row가 존재함
- 후보 readiness 실패를 승격함
- 프록시에서 기대한 digest가 관찰되기 전에 성공 처리함
- 연속 요청에서 오류 또는 5xx가 한 건이라도 발생함
- 자동 복구 후 이전 digest가 복원되지 않음
- 임시 스택 외 운영 자원이 변경됨

이 중 하나라도 발생하면 운영 배포 변경은 금지한다. 격리 검증 통과 후에도 운영 반영은 별도 Issue, PR, 승인, 비활성 슬롯 검증과 rollback rehearsal을 거쳐야 한다.

## 5. 현재 확인된 운영 차단 항목

- `npm audit --omit=dev` 기준 기존 production dependency에 critical 2건, high 12건이 있다. Next와 Auth를 포함한 보안 업데이트가 필요하다.
- 저장소 전체 lint는 기존 코드에서 364 errors, 67 warnings가 발생한다. 이번 변경 파일의 targeted lint와 TypeScript 검사는 통과했다.
- standalone 빌드가 동적 업로드 경로 때문에 전체 프로젝트를 추적할 수 있다는 NFT 경고가 남아 있다. 이미지 크기와 불필요 파일 포함 여부를 운영 PR 전에 해소한다.
- 본 A–E 검증은 readiness의 DB 조회와 HTTP 연속성까지 확인한다. 인증된 실제 업무 쓰기와 schema migration 호환성은 운영 전 별도 시나리오가 필요하다.
