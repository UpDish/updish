# UpDish

음식점 매출 증빙 → 모의 청약·배정 → 보유 → 정산·모의 지급을 연결하는 해커톤 데모입니다. Spring이 업무 원장을 계산하고 지갑은 SIWE 로그인과 GIWA 테스트 거래를 서명합니다. 실제 금전 수취·지급은 수행하지 않습니다.

현재 상태는 [개발 결과](docs/development-status.md), 실제 지갑 사용 순서는 [시연 안내](docs/demo-guide.md), 클라우드 자원·중지 방법은 [배포 안내](docs/deploy-runbook.md)를 기준으로 합니다. bootstrap/wallet 상태 문서는 과거 이력입니다.

## 버전

| 영역 | 고정 기준 |
| --- | --- |
| Core | Spring Boot 4.1.2 · Java 25 · Gradle 9.8.2 |
| Agent | FastAPI 0.162.0 · Python 3.13 · openai 3.37.0 · uv.lock |
| Web | Next.js 16.4.3 · React 19.3.1 · TypeScript 5.9.3 · Tailwind 4.3.3 |
| Node | Node 24 · pnpm 10.23.0 · pnpm-lock.yaml |
| DB | PostgreSQL 18.6 · Flyway V1–V5 |
| Chain | GIWA Sepolia 91342 · Solidity 0.8.38 · Cancun · OpenZeppelin 5.6.1 |
| Wallet | wagmi 3.7.9 · viem 2.57.11 |
| Cloud | Vercel + 서울 EC2 t4g.medium ARM64 · Ubuntu 24.04 · private S3 |

사용자가 승인한 v0.2 버전을 유지합니다. 모든 패키지가 언제나 최신이라는 의미는 아닙니다.

## 로컬 실행

Java 25, Node 24, pnpm, Python 3.13·uv, Docker Desktop이 필요합니다. 기존 env 파일이 있다면 복사를 생략합니다.

```powershell
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
./scripts/start-local.ps1
```

이미 설치·빌드했다면 `./scripts/start-local.ps1 -SkipBuild`로 시작합니다. 내부 Agent 토큰은 ignored `.env.local`에 생성하고 앱을 숨김 실행합니다. OpenAI 키 생성 동작은 없습니다. 준비된 뒤 `http://127.0.0.1:3000`을 엽니다. 로그는 `.runtime/`에 있습니다.

```powershell
./scripts/stop-local.ps1 -StopDatabase
```

DB 데이터는 보존합니다. 직접 실행한 프로세스는 해당 터미널에서 종료합니다. 개발 서버와 production build가 같은 .next 폴더를 사용하므로 빌드 중에는 개발 서버를 중지하세요.

## 구현

- DB 역할·자료 소유권·개인 명세 접근을 검사합니다. 설정된 운영 지갑만 OPERATOR이며 일반 로그인은 INVESTOR입니다. 제출자/마감자와 산정자/승인자는 다른 지갑이어야 합니다.
- 청약과 보유를 분리합니다. 접수 시각·고정 ID 순서로 최대 3,600단위를 배정하고 마지막 초과 청약은 부분 배정·모의 환불합니다. 가상 배경 3,500단위는 체인에 발행하지 않습니다.
- 고정 CSV의 외부 ID로 중복·할인·부분 환불·누락을 대조합니다. PDF·PNG·XLSX는 비공개 첨부만 지원합니다.
- 매출 3,000만원의 3%는 90만원, 100/3,600단위는 세전 25,000원입니다. 원 단위 잔여액 배분·현금 부족·부분 지급·실패·정정·만기 후 청구를 보존합니다.
- 사용자 지갑이 계약 배포·mint·정산 기록을 서명합니다. 서버는 runtime·소유자·설정·거래·receipt·safe 블록·잔고/기록을 대조합니다. 서버에는 지갑 키를 저장하지 않습니다.
- Dojang 철회는 신규 참여를 막지만 기존 보유·명세를 지우지 않습니다. TESTNET FAUCET을 UPBIT KOREA 인증으로 표시하지 않습니다. RPC 실패는 503/확인 대기입니다.
- Agent는 승인된 정산과 요청자 개인 명세만 읽습니다. 기본 모델 gpt-5-mini, 키 미설정/모델 실패 시 설명만 사용할 수 없습니다. Bojagi는 **NOT_CONNECTED**입니다.

## 구조와 검증

apps/web은 화면/BFF, services/core-api는 인증/업무/체인/S3, services/agent-api는 설명, contracts는 ERC-1155/registry, fixtures는 CSV, infra는 Compose/CloudFormation입니다.

업무 [OpenAPI](docs/openapi.json) 원본은 scripts/api-contract.mjs이며 Web은 생성 타입을 사용합니다. Core /api/v1 기준이고 브라우저는 /api/workbench/*로 중계합니다. 쓰기에는 세션·CSRF·정확한 Origin이 필요합니다. 생성기는 [공식 openapi-typescript API](https://openapi-ts.dev/node)를 사용합니다.

```powershell
pnpm generate:api
pnpm check:web
pnpm check:chain
pnpm test:chain
pnpm build:web
./services/core-api/gradlew.bat -p services/core-api test bootJar
uv run --directory services/agent-api python -m unittest discover -s tests
forge test --root contracts
pnpm smoke:auth docs/evidence/siwe-smoke.json
```

Java에는 PostgreSQL이 필요합니다. smoke:auth는 자금 없는 임시 서명자로 로그인→실제 GIWA 음성 조회→logout을 검사하고 거래를 보내지 않습니다. smoke:business는 **별도 Anvil 91342 + 별도 DB/Core 8081** 전용입니다. 공식 GIWA에 실행하지 마세요. [로컬 업무 결과](docs/evidence/business-local-e2e.json)는 mock Dojang을 사용하며 사용자 GIWA 성공을 증명하지 않습니다.

[남은 승인·실제 연결 확인](docs/remaining-work.md)을 완료 판정에 포함합니다.
