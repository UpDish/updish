# EC2·Vercel 시연 운영

현재 상태는 [2026-11-01 최종 릴리스 기록](evidence/full-flow-20261031/release-complete-20261101.json)과 [전체 시연 점검](full-flow-check-20261031.md)을 우선합니다. Core/Agent 코드 `a2d2421`을 기존 EC2에 반영했고, Web은 main 자동 배포의 production READY를 확인했습니다. DB/V9·active run·청약·보유·정산·지갑 세션을 유지합니다. 새 환경 파일이나 키를 배포하지 않았습니다. 롤백 이미지는 `before-ledger-20261101`입니다.

사용자 서명 GIWA 거래 9개(계약 4개·수량 발행·정산 기록·정확한 DEMO 사용 승인·예치·분배)는 safe입니다. 예치 3,000,000 DEMO 중 30,000을 분배했고 계약에는 2,970,000이 남았습니다. 내 투자 수령 영수증·차트와 실제 Agent의 의무/수령/추가 분배 설명을 확인했습니다. 새 거래 요청은 없습니다. 과거 수령 이력을 보존하고 같은 거래를 다시 보내지 않습니다. 실제 GIWA 정정은 별도 후속 항목이며 로컬 정정 검사를 실제 거래로 해석하지 않습니다. 아래 자원 및 과거 배포 기록은 이 최신 상태와 함께 읽습니다.

2026-10-25 KST. 서울 EC2 한 대 + private S3 + Vercel 구성이다. ALB·NAT·RDS·상시 워커 플랫폼은 사용하지 않는다.

## 생성한 자원

| 항목 | 값 |
| --- | --- |
| AWS region | ap-northeast-2 |
| CloudFormation | updish-hackathon-20261025 |
| EC2 | i-09bd2c718ace1bedc · t4g.medium · ARM64 · Ubuntu 24.04 |
| EBS | 25GiB gp3·암호화·DB/Caddy bind storage |
| API | https://3.35.194.163.sslip.io |
| S3 | updish-hackathon-20261025-bucket-wclu49yzzqxx · private |
| Vercel project | updish-hackathon-20261025 · prj_y9Vo3fV8rL9FNNQnFITTU1Jclmby |
| Vercel team | betaplayers-projects · team_2POKBlIQ9ZehFz3iZk7ViXNy |
| Web | https://updish-hackathon-20261025-betaplayers-projects.vercel.app |

EC2는 **실행 중**이다. 서버 컴퓨팅 단가는 AWS Pricing API로 확인한 Linux On-Demand USD 0.0416/시간이며 20시간은 USD 0.832다. EBS·IPv4·S3·전송·Vercel·모델 비용은 별도다. 중지해도 EBS/S3 보관 비용은 남는다. 무료 크레딧은 가정하지 않았다.

인바운드는 80/443만 허용한다. PostgreSQL/Agent는 Compose 내부, Core 8080은 호스트 loopback에만 바인딩한다. SSH 공개 포트·장기 S3 access key를 두지 않는다. 관리에는 SSM, 파일에는 EC2 instance profile을 사용한다.

## 시작·중지·백업

저장소 루트에서 AWS CLI의 해당 계정으로 실행한다. 스크립트는 이 문서의 EC2 한 대만 대상으로 한다.

```powershell
./scripts/aws-demo.ps1 -Action Status
./scripts/aws-demo.ps1 -Action Stop
./scripts/aws-demo.ps1 -Action Start
./scripts/aws-demo.ps1 -Action Backup
./scripts/aws-demo.ps1 -Action RestoreCheck
```

Start는 중지 상태에서 기동을 요청한다. EC2/SSM이 준비된 뒤 Start를 다시 실행하면 새 공인 IP로 Caddy 도메인을 갱신한다. 출력된 API URL을 Vercel **CORE_API_URL**에 바꾸고 재배포한다. 자동 공인 IP는 stop/start 때 바뀔 수 있다. 고정 IP 비용을 피하는 구성이다. Reboot는 IP를 유지하는 재부팅이며 stop/start와 구분한다.

Backup은 /opt/updish/backups의 접근 제한된 pg_dump custom 파일을 만든다. RestoreCheck는 새 임시 DB에 복원하고 active run/핵심 테이블 행 수를 대조한 뒤 그 임시 DB만 제거한다. 원본 DB는 덮어쓰지 않는다. 현재 보관은 같은 EBS이므로 volume 장애 대비 외부 백업은 아니다. 복구 구문·API 키가 포함될 수 있는 서버 .env를 출력/다운로드하지 않는다.

## 최종 Vercel 설정

2026-10-26 업비트 조사 기반 UI·공통 지갑 팝업·승인 매출 차트·정산 근거·운영자 관점 전환을 production에 배포했습니다. [QA](../design-qa.md)는 passed이며 동일 크기 비교와 실제 모바일 화면을 확인했습니다.

현재 배포 ID는 `dpl_5TRVv5unotPzXnt1vE777QnvcevG`, 앱 소스 커밋은 `84d07252088d4533aab112364857caa4a438c88f`, 상태는 READY입니다. 샘플 CSV 9개와 6개월 참고 차트를 추가했고 [공개 샘플 검사](evidence/demo-data/production-browser.json) 13개를 통과했습니다. Web만 재배포했으며 EC2/Core/DB는 변경하지 않았습니다. 이전 `dpl_Gcvt4eFXZqx2QFgQirHQUxUR88M7`에서의 다음 로그인/API 검사도 별도 보존합니다. [공개 로그인 검사](evidence/service-flow/production-auth-smoke.json) 12개, [공개 브라우저 검사](evidence/service-flow/production-guest-browser.json) 17개, [배포 API/팝업/사용자 Dojang 검사](evidence/service-flow/production-release-browser.json) 6개를 통과했습니다. 개인 승인 자료와 체인 계약 전체 시연은 별도 로컬 DB/Anvil에서 확인했으며 사용자 거래를 대신 승인하지 않았습니다.

같은 EC2에서 Core 이미지만 교체했습니다. SSM `692ac889-b285-4bc5-a2d4-fc6a118cb06f`는 Success, health UP, 공개 performance API 응답을 확인했습니다. private S3 아카이브 SHA-256은 `3658ac623e23068eab4dd01ea8c2b593ca7c9526b065714f16f3e900ceaf9fa5`입니다. 기존 DB/설정/자원은 보존했고 Flyway 변경은 없습니다. 교체 전 이미지는 `updish/core-api:before-chart-20261026`로 남겨 두었습니다. 일시적인 Docker Hub DNS 실패 때 이미 검증된 로컬 ARM64 이미지의 동일 JRE 기반에 새 JAR만 복사해 이미지를 만들었습니다. [릴리스 기록](evidence/service-flow/release.json).

production/preview에 아래 값을 설정했다.

- CORE_API_URL=https://3.35.194.163.sslip.io
- UPDISH_ALLOWED_ORIGINS=https://updish-hackathon-20261025-betaplayers-projects.vercel.app
- Framework Next.js, root apps/web, Node 24, 외부 root source 포함.
- install: pnpm install --frozen-lockfile / build: pnpm build.

초기 잘못된 짧은 Origin 설정으로 발생한 로그인 POST 403은 해결했다. 시연 로그인은 위의 긴 production 주소로 고정한다. 다른 alias·unique deployment URL·preview Origin은 자동 허용하지 않으므로 로그인할 때 검증된 production 주소를 사용한다.

배포 소스는 scripts/vercel-source.mjs로 env 파일을 제외해 준비한다. API 키를 Web 환경이나 NEXT_PUBLIC 변수로 넣지 않는다.

## 재현·유지

infra/aws-demo.yaml은 private bucket·instance role·SSM·최소 SG·단일 EC2를 만든다. 로컬에서 ARM64 Core/Agent 이미지를 빌드하고 압축 아카이브와 Compose/Caddyfile을 private S3 release/에 올린다. 인스턴스는 이를 받아 기동한다. 초기 Ubuntu apt의 awscli 미지원은 공식 ARM64 AWS CLI 설치로 수정하고 같은 인스턴스에서 복구했다.

S3 CORS는 실제 Web Origin과 presigned 업로드 헤더를 허용하도록 직접 수정했다. 초기 stack WebOrigin parameter는 잘못된 짧은 주소인 상태이므로 CloudFormation과 차이가 있다. UserData 변경은 EC2 재시작/IP 변경을 일으킬 수 있으니 무심코 stack update를 실행하지 말고 change set을 검토한다. 서버 실제 .env와 S3 CORS는 올바른 긴 주소다.

서버 /opt/updish의 .env는 0600, 내부 DB 비밀번호/Agent 토큰은 서버에서 생성했다. OpenAI 키는 생성/저장하지 않았다. 로컬에서 키가 승인돼도 EC2로 자동 배포되지 않으며 서버 저장 경로를 별도로 확인해야 한다.

## 검증과 종료

[클라우드 기록](evidence/cloud-status.json): HTTPS health, 공개 Web/로그인, S3 CORS/private, DB 백업/별도 복원, EC2 reboot 뒤 같은 IP/health. [직접 Core 로그인](evidence/cloud-auth-smoke.json), [이전 Vercel 경유 로그인](evidence/vercel-auth-smoke.json), [시안 반영 후 Vercel 경유 로그인](evidence/design/production-auth-smoke.json)을 별도 기록했다. Secure 쿠키·SIWE·DB·실제 GIWA 조회를 확인했으며 사용자 MetaMask의 발급·거래 승인은 미실행이다. 이번에는 기존 EC2의 Core 컨테이너 이미지만 갱신했습니다. 자원/DB를 새로 만들거나 백업/reboot 검사를 반복하지 않았습니다.

해커톤 후 Stop으로 컴퓨팅을 중지한다. 완전히 정리하려면 백업 필요 여부를 확인한 뒤 이 CloudFormation stack과 이 작업에서 만든 Vercel project만 정리한다. Bucket은 Retain이므로 stack 삭제 후에도 release/demo 객체와 bucket이 남는다. EC2 종료 시 루트 EBS는 삭제된다. 정리 요청 전에는 stack·bucket·사용자 자료를 임의 삭제하지 않는다.


## 팀 저장소와 작업 안내

공개 저장소는 https://github.com/UpDish/updish (`main`)입니다. [팀원 시작 이슈 #1](https://github.com/UpDish/updish/issues/1)을 먼저 읽고 각 후속 이슈의 완료 기준에 따라 작업합니다. 저장소 생성만으로 Vercel Git 자동 배포를 연결한 것은 아닙니다. 현재 릴리스는 승인된 Vercel 연결을 통한 소스 배포입니다.

QR 연결에는 공개 Reown ID를 Web 환경에 설정한 뒤 재빌드해야 합니다. 현재는 ID가 없어 비활성 상태이며 브라우저 지갑 선택/로그인은 동작합니다.


## 전체 UX용 더미 데이터 준비 — 2026-10-26

프론트는 위 `84d0725` 배포를 유지합니다. 사용자 요청에 따라 UI 개편보다 먼저 Core/Flyway V6의 별도 `ux_demo_dataset`에 `updish-ux-v1`을 등록했습니다. 가게/상품 각 8개, 월 매출 48건, 보유 9건, 혜택 8개/쿠폰 6건이며 시연 계정 7개와 배경 계정 1개입니다. 기존 실제 계정/업무 원장/active run/체인 작업은 변경하지 않았고 SSM 전후 행 수 비교도 일치했습니다. 실제 지갑 권한이나 승인/쿠폰을 발급한 것이 아닙니다.

배포 전 백업 SSM `e275fc9c-352c-442e-90ad-bb6aabee14ee` Success, 백업 SHA-256 `8e0070e6e40270831b4f9e78892f2abcbdecc3b4371b9f9ed60eae61f076909c`. Core 교체 SSM `dddefe5a-6df7-4a44-93c6-502ce6a81560` Success, health UP, V6와 source SHA-256 `a56b47a71c926108638cb5c7fd11ae39757df2f888c1d847c560ecb8d18f247c`를 실제 서버에서 확인했습니다. 이전 이미지는 `updish/core-api:before-ux-20261026`입니다. V6는 추가 테이블이므로 이전 Core로 롤백할 때 테이블이나 기존 이력을 임의 삭제하지 않습니다.

[생성/시연 데이터 안내](../fixtures/ux/README.md), [배포 seed 근거](evidence/ux-demo/production-seed.json), [공개 로그인·fixture 권한 검사 14개](evidence/ux-demo/production-auth.json). OPERATOR의 전체/시나리오별 200 응답은 로컬 실제 SIWE/BFF/별도 DB로 검증했고, 클라우드에서는 seed/메타데이터/일반 사용자 접근 차단을 확인했습니다. 사용자 운영 지갑의 서명을 대신하지 않았습니다.

현재 FastAPI Agent health는 정상, 내부 토큰은 있으나 `/capabilities`의 `model_calls`는 `NOT_CONFIGURED`입니다. 실제 AI 설명은 아직 미연결이고 정산 근거 화면만 모델 없이 동작합니다. 새 키 생성/저장을 승인 없이 재개하지 않습니다.


## 로그인·역할별 UX 릴리스 — 2026-10-26

[UX 동선/권한/데이터 구분](ux-flow.md). V7 Core 배포 SSM `d457b764-c9c1-4099-8e07-6be47a8ecf5f` Success, health UP, catalog 상품 두 개 추가, 초기 쿠폰 0건. 기존 active run/기존 상품/청약/보유/정산/chain job 행 수가 보존됐습니다. 백업 SSM `df99dc6f-a4e7-40ce-a09b-0db53c8ce3bf`, SHA-256 `4f03b9261c618857d0eeae20cc17328346ff2640fc10b0a35aba00e5ceac8faf`. 롤백 이미지는 `updish/core-api:before-journey-20261026`; V7 테이블/이력은 임의 삭제하지 않습니다. [실제 배포 근거](evidence/ux-journey/production-core.json). 웹 배포 식별자는 아래 후속 기록에 추가합니다.


웹 `dpl_HihA9BL52pzFKwtu8LmVXfTUQRZq`는 app commit `a91b6e2`에서 production READY입니다. 기존 canonical 주소에 반영됐습니다. Vercel의 루트는 `apps/web`, 외부 소스 포함은 true, install은 `cd ../.. && pnpm install --frozen-lockfile`, build는 `pnpm build`, output은 `.next`로 보정·저장했습니다. 최초 시도는 루트 lockfile 경로 오류로 실패했고 위 배포가 대체합니다. 공개 SIWE/BFF/Core/PG/GIWA 읽기 18개와 공개 비로그인 브라우저 7개 통과. [배포 기록](evidence/ux-journey/release.json).


## 운영 투명성·실제 Agent·Git 자동 배포 — 2026-10-26

앞선 키 미구성/로컬 검토 기록은 아래 상태로 대체합니다. 앱 커밋 `e0816bf0602aa5aab4432474671c52bd1059b5a9`를 main에 푸시하고 Vercel `dpl_BWxaZ1fyqbxCvSiDiA3zBDWNmt6o` production READY 및 canonical 주소를 확인했습니다. 고객/쿠폰 화면을 제거하고 POS/PG/은행 대조와 간단한 채팅 사이드바를 반영했습니다. 일반 지갑도 가게 공개 근거를 질문할 수 있고 개인 정산은 본인 승인 자료만 설명합니다.

EC2 Core와 Agent 이미지 갱신 SSM `a0a837b3-9b9b-4eba-8d69-22a24a1a6ac5` Success, health UP, Flyway V8, 기존 업무 행 수 보존을 확인했습니다. 백업 `backups/updish-before-transparency-20261026T070909Z.dump` SHA-256 `9ef18dc8720a683ff22661cb810dcc0da81c7f6e418691dc9b23952b11373d29`. 롤백 이미지는 Core/Agent 각각 `before-transparency-20261026`입니다. 최초 SSM은 sh의 pipefail 비지원으로 작업 전 실패했고 bash 명시 후 완료했습니다.

사용자 재승인으로 발급한 30일 모델 키를 ignored 로컬 `.env.local`과 EC2 `/opt/updish/.env` (0600)에 저장했습니다. EC2 내부 Agent만 읽으며 Vercel/Web/Git에는 넣지 않았습니다. 전송용 private S3 암호화 객체는 확인 후 삭제했습니다. 실제 공개 모델 응답과 SIWE/BFF/Core/PG/GIWA 조회 20개가 통과했습니다. [근거](evidence/transparency-agent/).

사용자가 GitHub 연결을 승인했고 기존 Vercel 프로젝트를 `UpDish/updish`와 연결했습니다. 이제 main 푸시는 프론트 production 배포를 트리거합니다. 프로젝트를 새로 만들거나 도메인을 바꾸지 않았습니다. 기존 install `cd ../.. && pnpm install --frozen-lockfile`, root `apps/web`, 외부 소스 포함, build `pnpm build`, output `.next`를 유지합니다. EC2 Core/Agent 이미지는 별도 검증 후 배포하며 Git push만으로 서버 이미지가 바뀌지는 않습니다.

DB는 EC2 PostgreSQL 18.6 그대로이며 Supabase 이전은 수행하지 않았습니다. 실측 DB 9,180,863바이트, PostgreSQL 71.7MiB, EC2 가용 메모리 2,904MiB입니다. 현재 규모에서는 DB 저장 공간 때문에 EC2를 증설할 필요가 없습니다. 외부 DB 이전만으로 고정 인스턴스 요금이 내려가지는 않으므로 이전과 인스턴스 축소는 별도 결정합니다.


## 발표 v0.3 서버 갱신 — 2026-10-31

앱 커밋 `346998a42ec137402ffd2c6a797c46307a6332d6`의 검증된 Core JAR와 Agent 소스 이미지를 기존 ARM64 EC2에 반영했습니다. SSM `5f89c81b-fedf-48eb-8fd3-f3566303053f` Success, health UP, Flyway V9, `presentation-v03|10000|10000|1000`, 이전 실행의 업무 행 수 보존을 확인했습니다. 배포 전 dump SHA-256은 `4449c600b483f85d6a12f3ded91fcda74030b3f283c2caefb48952dffc05ce65`이며 pg_restore 목록 검사를 통과했습니다. 이전 이미지는 `before-presentation-20261031` 태그로 보관합니다. 환경 파일 0600과 기존 백엔드 모델 키를 유지했습니다. 자원 추가·DB 이전·실제 GIWA 거래는 실행하지 않았습니다. [서버 증거](evidence/presentation-v03/server-release.json).

V9는 새 active run과 추가 필드·분배 작업 테이블만 적용하고 과거 실행을 보존합니다. 이전 버전 UI/수치 기록은 현재 [발표 시연 순서](demo-runbook.md)로 대체합니다. Web은 main 자동 배포의 실제 READY 및 canonical 주소를 별도로 확인합니다.


Agent 공개 자료 경계 보완 커밋 `144977fb0d62efc790e90c7df549ca205c06dd5e`도 기존 서버에 반영했습니다. SSM `16a8d803-fc0c-4f1d-a1dc-d40b99f7328e` Success, 동일한 기존 업무 행 수·V9·JAR/Agent SHA-256·0600 환경 파일을 확인했습니다. 최종 dump SHA-256은 `98937632ef625c027794c5063b62a36d095b6e1e2f3d82452fb993d987386d54`입니다. Web UI 소스는 `346998a` 이후 변경되지 않았으며 후속 커밋은 서버 정책·검사·검증 문서를 포함합니다. [구성별 배포 기록](evidence/presentation-v03/release.json).
