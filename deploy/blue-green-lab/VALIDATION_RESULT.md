# WARP Blue/Green 격리 검증 결과

검증일: 2026-08-18

작업자: `OziinG`

판정: 격리 배포·복구 계약 통과, 운영 반영 차단

## 검증 범위

- 운영 WARP EC2, DNS, Load Balancer, Security Group, SSM Parameter와 배포 경로를 변경하지 않았다.
- 로컬 Docker와 서울 리전의 일회성 SSM-only EC2에서 동일한 A–E 시나리오를 실행했다.
- 이미지는 서빙 EC2가 아닌 CodeBuild에서 생성했다.
- Source archive는 암호화·비공개 S3에 일시 보관했고 검증 후 삭제했다.
- EC2 인바운드는 0개, outbound는 TCP 443만 허용했다.
- 앱과 프록시 포트는 host loopback에만 bind했다.

## Artifact 증거

이미지 source revision: `e3825a4371fd0f445bd0e3ce362b7a2c7a98e0dd`

| Release | ECR digest |
| --- | --- |
| `lab-a` | `sha256:085881488baf936e035d0104e317d46f1b6a07f05ed546de846d31b2ec52b578` |
| `lab-b` | `sha256:b76c08297244e1c7d85e5177a0e14d34f0fd52be9e19bcbbe3ea8edf5d267005` |
| `lab-c` | `sha256:358df74b601ad4bcf318120b1258ec4c70200304002a459379e36989307af12b` |
| `lab-d` | `sha256:5c746b28a5b05bbbc221506f57dfd292ba4bf84040950a84a608e85abe67b8ce` |
| `lab-e` | `sha256:be949c0f4a4bd464974c94816cf3db9c6d29f73821c6cb4706acfe7a658ddc45` |

CodeBuild `BUILD_GENERAL1_MEDIUM` 작업은 4분 38초에 5개 linux/amd64 이미지를 생성했다. 모든 ECR tag는 immutable이며 슬롯에는 tag가 아니라 위 digest를 등록했다.

## 원격 A–E 결과

| 시나리오 | 결과 | 연속 요청 |
| --- | --- | --- |
| A. `lab-a` 최초 기동 | 통과 | blue digest 확인 |
| B. `lab-a` → `lab-b` | 통과 | 188회, 오류 0, 5xx 0 |
| C. `lab-c` readiness 실패 | 통과 | 승격 차단, `lab-b` 유지 |
| D. `lab-d` 외부 검증 실패 | 통과 | 187회, 오류 0, 5xx 0, `lab-b` 자동 복구 |
| E. `lab-b` → `lab-e` | 통과 | 182회, 오류 0, 5xx 0 |
| E 재시작 | 통과 | `lab-e` digest 유지 |
| 수동 rollback | 통과 | 188회, 오류 0, 5xx 0, `lab-b` 복원 |

원격 연속 요청은 합계 745회이며 오류와 5xx가 모두 0건이다.

## 검증 중 발견하고 수정한 결함

1. Amazon Linux 2023의 `curl-minimal`과 일반 `curl` 설치 충돌로 첫 cloud-init이 실패했다. 일반 `curl` 설치를 제거하고 새 스택에서 Docker 준비까지 재검증했다.
2. 2 GiB Colima에서 linux/amd64 cross-build가 메모리를 고갈시켰다. 빌드를 CodeBuild로 분리했으며, 종료된 CLEVER HQ 컨테이너는 재기동 후 health/ready 200을 확인했다.
3. Nginx reload 직후 `healthz`와 `readyz`가 서로 다른 old/new worker에서 응답해 실패 후보를 정상으로 오판할 수 있었다. 외부 readiness 한 응답 안에서 candidate digest와 성공 상태를 함께 확인하도록 바꿨다.
4. SSM 기본 waiter보다 A–E 시나리오가 길었다. 명시적인 상태 polling으로 장기 명령을 안전하게 회수하도록 변경했다.
5. 로컬·원격 ECR 로그인은 검증 종료 시 제거했고, 증거 수집에서 `ecr-credential=absent`를 확인했다.

## 보안·운영 차단 항목

- `npm audit --omit=dev`: 기존 production dependency에서 critical 2건, high 12건.
- ECR basic scan: 5개 이미지 각각 critical 3건, high 6건. critical은 Debian base Perl이며 high 일부는 OpenSSL이다. 해당 결과에 fixed version은 제시되지 않았다.
- 전체 저장소 lint baseline: 364 errors, 67 warnings. 변경 파일 targeted lint와 TypeScript 검사는 통과했다.
- Next standalone NFT tracing이 동적 upload 경로 때문에 전체 프로젝트를 추적할 수 있다는 경고가 남아 있다.
- 이번 검증은 readiness의 DB 조회와 HTTP 연속성을 다뤘다. 인증된 실제 업무 쓰기, SQLite 동시 write, schema migration 호환성은 아직 검증하지 않았다.

따라서 본 결과는 Blue/Green 기반의 격리 배포·자동복구·수동 rollback 가능성을 입증하지만, 운영 배포 승인은 아니다.

## 정리 확인

증거 수집 후 다음을 개별 확인했다.

- ECR repository: absent
- S3 source bucket: absent
- CodeBuild project: absent
- Security Group: absent
- EC2: terminated
- CloudWatch Log Group: absent
- 로컬 ECR credential: absent
- CLEVER HQ: `/healthz` 200, `/readyz` 200

상세 원본 증거는 ignored 경로 `deploy/blue-green-lab/runtime/aws-evidence/`에 보관한다.
