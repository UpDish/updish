# EC2·Vercel 시연 운영

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

현재 공개 페이지와 /api/offering은 응답한다. 연결 앱은 팀 접근 승인을 요구하므로 아직 최종 env 수정·최신 코드 재배포·전체 로그인 검사를 완료하지 않았다. 팀이 본인 작업 공간인지 사용자 확인이 먼저다. 권한 거부를 CLI 자격 증명으로 우회하지 않는다.

승인 후 production/preview에 아래 값을 사용한다.

- CORE_API_URL=https://3.35.194.163.sslip.io
- UPDISH_ALLOWED_ORIGINS=https://updish-hackathon-20261025-betaplayers-projects.vercel.app
- Framework Next.js, root apps/web, Node 24, 외부 root source 포함.
- install: pnpm install --frozen-lockfile / build: pnpm build.

현재 Vercel Origin env는 짧은 미소유 주소로 설정돼 있어 로그인 POST 수정이 필요하다. 짧은 updish-hackathon-20261025.vercel.app은 다른 프로젝트 소유이므로 사용하지 않는다. preview마다 임의 Origin을 자동 허용하지 않는다. 시연 로그인은 실제 production 주소로 고정한다.

배포 소스는 scripts/vercel-source.mjs로 env 파일을 제외해 준비한다. API 키를 Web 환경이나 NEXT_PUBLIC 변수로 넣지 않는다.

## 재현·유지

infra/aws-demo.yaml은 private bucket·instance role·SSM·최소 SG·단일 EC2를 만든다. 로컬에서 ARM64 Core/Agent 이미지를 빌드하고 압축 아카이브와 Compose/Caddyfile을 private S3 release/에 올린다. 인스턴스는 이를 받아 기동한다. 초기 Ubuntu apt의 awscli 미지원은 공식 ARM64 AWS CLI 설치로 수정하고 같은 인스턴스에서 복구했다.

S3 CORS는 실제 Web Origin과 presigned 업로드 헤더를 허용하도록 직접 수정했다. 초기 stack WebOrigin parameter는 잘못된 짧은 주소인 상태이므로 CloudFormation과 차이가 있다. UserData 변경은 EC2 재시작/IP 변경을 일으킬 수 있으니 무심코 stack update를 실행하지 말고 change set을 검토한다. 서버 실제 .env와 S3 CORS는 올바른 긴 주소다.

서버 /opt/updish의 .env는 0600, 내부 DB 비밀번호/Agent 토큰은 서버에서 생성했다. OpenAI 키는 생성/저장하지 않았다. 로컬에서 키가 승인돼도 EC2로 자동 배포되지 않으며 서버 저장 경로를 별도로 확인해야 한다.

## 검증과 종료

[클라우드 기록](evidence/cloud-status.json): HTTPS health, 공개 Web, S3 CORS/private, DB 백업/별도 복원, EC2 reboot 뒤 같은 IP/health. [직접 Core 로그인](evidence/cloud-auth-smoke.json)은 HTTPS·Secure 쿠키·SIWE·DB·실제 GIWA 조회를 검사했으며 Vercel BFF 전체 성공을 뜻하지 않는다.

해커톤 후 Stop으로 컴퓨팅을 중지한다. 완전히 정리하려면 백업 필요 여부를 확인한 뒤 이 CloudFormation stack과 이 작업에서 만든 Vercel project만 정리한다. Bucket은 Retain이므로 stack 삭제 후에도 release/demo 객체와 bucket이 남는다. EC2 종료 시 루트 EBS는 삭제된다. 정리 요청 전에는 stack·bucket·사용자 자료를 임의 삭제하지 않는다.
