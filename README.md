# UpDish

음식점 매출 근거와 모의 투자·정산을 연결하는 해커톤 프로젝트입니다. 지갑 연결·SIWE 로그인과 GIWA·Dojang 실제 조회를 구현했습니다. 사용자가 공식 Playground에서 발급·철회한 결과를 로그인한 지갑으로 확인할 수 있습니다.

실제 지갑을 준비하는 순서는 [지갑·Dojang 시연 안내](docs/wallet-guide.md), 구현·검증 범위는 [로그인 개발 상태](docs/wallet-status.md)에 있습니다.

## 실행 환경

| 영역 | 고정 기준 |
| --- | --- |
| Core API | Spring Boot 4.1.2 · Java 25 · Gradle Wrapper 9.8.2 |
| Agent API | FastAPI 0.162.0 · Python 3.13 · uv.lock |
| Web | Next.js 16.4.3 · React 19.3.1 · TypeScript 5.9.3 · Node 24 |
| DB | PostgreSQL 18.6 |
| Chain | GIWA Sepolia 91342 · viem 2.57.11 · Solidity 0.8.38 |

Node 패키지는 pnpm 10.23.0과 lockfile을 사용합니다. 이 저장소는 상위 사용자 홈 Git 저장소와 구분되는 독립 저장소입니다.

## 폴더

```text
apps/web/                 실제 API 응답을 확인하는 Next.js 화면
services/core-api/        Spring Boot·DB migration·GIWA RPC·Dojang adapter
services/agent-api/       FastAPI 기동 기반과 health endpoint
packages/chain-config/    공식 네트워크·계약 주소·최소 ABI
contracts/               Dojang 자격 reader와 로컬 검증
scripts/                 재실행 가능한 읽기 전용 체인 probe
infra/                   PostgreSQL 및 앱 Docker Compose
docs/                    구현 상태·연동 결과·Bojagi 조사
fixtures/                후속 업무 시연용 샘플 위치
```

## 로컬 시작

필요 도구는 Java 25, Node 24, pnpm, Python 3.13과 uv, Docker, Foundry입니다. 아래 명령은 저장소 루트를 기준으로 합니다. `.env.example`의 DB 비밀번호는 로컬 전용입니다.

```powershell
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
pnpm install --frozen-lockfile
uv sync --directory services/agent-api --frozen
docker compose --env-file .env -f infra/compose.yaml up -d --wait
```

터미널을 나눠 실행합니다.

```powershell
Set-Location services/core-api
.\gradlew.bat bootRun
```

```powershell
uv run --directory services/agent-api uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
pnpm dev:web
```

웹은 `http://127.0.0.1:3000`, Core health는 `http://127.0.0.1:8080/actuator/health`, Agent health는 `http://127.0.0.1:8000/health`입니다. 웹은 Next.js의 같은 출처 API를 통해 Core를 호출합니다. 다른 Core 주소는 웹 환경의 `CORE_API_URL`로 설정합니다.

## 체인 확인

```powershell
pnpm probe:chain --output docs/evidence/giwa-probe.json
pnpm probe:chain --address 0x여기에실제42자주소
```

주소를 생략하면 0 주소를 음성 대조군으로 조회합니다. 이 결과는 실제 사용자의 발급 성공을 증명하지 않습니다. probe는 체인 ID·공식 주소의 bytecode·동일 safe 블록의 Dojang 조회·safe/finalized 지원을 확인하며 트랜잭션을 보내지 않습니다. 방금 발급·철회한 결과는 safe 블록에 포함된 뒤 반영됩니다. RPC 주소는 `GIWA_RPC_URL` 환경 변수로 바꿀 수 있고 API 키가 포함된 URL은 출력하지 않습니다.

공개 조회는 `GET /api/v1/chain/status`, `GET /api/v1/dojang/{address}`, `GET /api/v1/integrations`입니다. 인증 경로는 `/api/v1/auth/{csrf,challenge,verify,session,logout}`이며 `GET /api/v1/me/dojang`은 세션에서 지갑 주소를 가져옵니다. 웹에서는 같은 출처의 `/api/auth/*`, `/api/me/dojang` 중계 경로를 사용합니다.

로그인 challenge는 5분 유효·일회용이며 브라우저 세션·Origin·Chain 91342에 묶입니다. 서버는 EIP-191 서명과 정형 EIP-4361 메시지를 검증합니다. 세션은 PostgreSQL에 저장하고, 브라우저에는 HttpOnly·SameSite=Lax 쿠키만 전달합니다. 30분 미사용 시 만료됩니다. 역할은 서버가 INVESTOR로 부여하며 지갑·네트워크 변경 시 화면 접근을 즉시 해제하고 서버 로그아웃을 요청합니다. 계약 지갑의 EIP-1271 검증은 구현하지 않았습니다.

로컬 HTTP에서는 `SESSION_COOKIE_SECURE=false`를 사용합니다. HTTPS 배포 시 Core의 `SESSION_COOKIE_SECURE=true`, Core와 Web 양쪽의 `UPDISH_ALLOWED_ORIGINS`에 **동일한 실제 웹 Origin**을 명시해야 합니다. Next.js는 `apps/web/.env.local` 또는 Web 프로세스 환경을 읽고, Spring은 Core 프로세스 환경을 읽습니다. 루트 `.env`는 Compose용입니다. wildcard Origin과 브라우저에서 전달한 임의 중계 헤더를 신뢰하지 않습니다.

허용 발급자는 TESTNET FAUCET으로 고정되어 있습니다. 다른 발급자의 attestation이나 브라우저에서 바꾼 attester ID로 자격을 통과시킬 수 없습니다. RPC 실패는 503으로, 잘못된 주소는 400으로 구분합니다. UID getter는 공식 소스상 유효하지 않은 attestation에서 revert하므로 유효 판정 후에만 호출합니다.

## 검증

```powershell
pnpm test:chain
pnpm check:chain
pnpm check:web
pnpm build:web
pnpm smoke:auth docs/evidence/siwe-smoke.json
```

```powershell
Set-Location services/core-api
.\gradlew.bat test bootJar
```

```powershell
Set-Location contracts
forge test
```

Spring 검증에는 로컬 PostgreSQL이 필요합니다. `smoke:auth`는 Web·Core·PostgreSQL이 실행된 상태에서 새 임시 지갑을 메모리에서 만들고 서명 로그인·실제 GIWA 음성 조회·로그아웃을 검사합니다. 사용자 키를 읽거나 트랜잭션을 보내지 않습니다. 실행마다 임시 테스트 주소의 사용자 행이 하나 생깁니다. Foundry 검증의 Dojang 발급·철회는 로컬 mock 계약을 사용합니다.

## 컨테이너 실행 기반

먼저 Core의 `bootJar`를 만든 뒤 다음 명령으로 앱 컨테이너까지 실행할 수 있습니다.

```powershell
docker compose --env-file .env -f infra/compose.yaml --profile app up -d --build
```

현재 Compose는 로컬 개발 기반입니다. EC2 인스턴스 생성·공개 TLS 진입점·Vercel 배포는 아직 구성하지 않았습니다. 서비스 포트를 그대로 인터넷에 공개하는 배포 방식으로 사용하지 않습니다.

DB를 유지하며 중지하려면 아래 명령을 사용합니다. 데이터 volume을 지우는 옵션은 붙이지 않습니다.

```powershell
docker compose --env-file .env -f infra/compose.yaml stop
```

## 다음 구현

1. 준비한 실제 시연 지갑으로 Playground Dojang 발급·철회 확인.
2. 모의 가게·투자자·운영자 업무 화면과 역할별 흐름 연결.
3. 모의 청약·배정과 제한형 테스트 토큰 발행.
4. CSV 대조·정산 엔진·정산 기록 계약.
5. Bojagi 공식 접근 확보 시 실제 SDK 통합.
6. Agent의 근거 조회와 모델 호출. 현재 모델 호출은 구현하지 않았습니다.

현재 상태와 결과는 [개발 상태](docs/bootstrap-status.md), [Bojagi 조사](docs/research/bojagi.md), [실제 체인 응답](docs/evidence/giwa-probe.json)에 남깁니다.
