# 해커톤 업무 구현 결과

2026-10-26 KST. [v0.2](../../UpDish_해커톤_개발스펙_v0.2.md) 기준.

Spring에 가상 음식점/상품·계약·DB 역할·CSV 원본/대조·모의 청약/배정/환불·보유·정산/개인 명세/정정·모의 지급/실패/부분 성공·만기·작업 이력을 구현했습니다. Flyway V3–V5로 보관합니다. 리셋은 새 run을 추가하며 과거 DB/온체인 거래를 삭제하지 않습니다.

청약은 접수 시각/ID 순서로 최대 모집 수량만 배정하며 마지막 초과분을 refunded_units로 보존합니다. 모집 이상 접수 후 새 요청은 거부합니다. 가상 배경 3,500단위는 DB 전용이며 실제 자격·mint를 주장하지 않습니다.

증빙 제출자/마감자, 정산 산정자/승인자를 분리합니다. 개인 명세와 Agent 입력을 요청자 범위로 제한합니다. S3는 private bucket·instance role·5분 PUT·2분 GET·HEAD 완료 검증을 사용합니다. 앱을 통한 실제 파일 전송은 운영 지갑 로그인 이후 확인합니다.

UpDishDemoUnits는 상품 고정·cap·Dojang·배정 중복 방지·이전 제한을, SettlementRegistry는 digest와 원정산 참조 추가 기록을 구현합니다. 체인 작업은 DB에 보관하고 사용자가 지갑으로 서명합니다. 컴파일 runtime/immutable·owner/config·거래 수신자/calldata·receipt·canonical/safe 블록·잔고/기록을 대조합니다. v0.2의 서버 운영 키 대신 사용자의 운영 지갑을 직접 사용하는 구현 선택입니다.

FastAPI Agent는 승인 정산과 개인 명세를 한 번의 읽기 도구로 받아 구조화 설명을 생성합니다. 근거 ID·데이터 버전·SIMULATION을 포함하며 기본 모델 gpt-5-mini, store=false, 자동 재시도 없음, 출력/시간/동시·일일 제한과 버전별 캐시를 사용합니다. **키 저장 승인이 거절되어 실제 모델 응답은 확인하지 않았습니다.**

업비트 조사 기반의 네이비 탐색·평면 패널·상품/청약 인접 UI를 실제 브라우저로 검증했습니다. 검색/필터/키보드 탭/수량/계산/위험 안내와 1440·768·390px 화면을 확인했습니다. [동일 크기 비교](evidence/service-flow/comparison-desktop.png), [검증 결과](../design-qa.md)를 확인하세요. 공개 배포 식별자는 [배포 안내](deploy-runbook.md)에 기록합니다.

공통 지갑 팝업은 Web3-Onboard Core 2.24.1 / injected-wallets 2.11.3입니다. wagmi 3.7.9를 유지하고 선택된 EIP-1193 provider의 계정/네트워크 변경과 Spring SIWE를 연결했습니다. 재접속·로그아웃·지갑 전환을 검증했습니다. WalletConnect 2.6.3은 선택 설정으로 준비했으며 공개 Reown Project ID가 없어 QR 연결은 비활성화 상태입니다. RainbowKit의 wagmi 2 peer 요구 때문에 기존 wagmi를 강제 하향하지 않았습니다.

새 공개 매출 API는 개인 주소/명세 없이 월별 최신 APPROVED 버전의 정산대상 매출·전체 배분금만 반환합니다. Recharts 3.10.1 차트와 정확한 원 단위 표를 함께 제공합니다. 내 정산액은 현재 로그인 지갑의 최신 승인 명세에 한정합니다. 미승인 버전·중복 정정·누락 월 보간·가짜 가격 이력을 넣지 않습니다. 승인 자료가 없으면 빈 상태를 표시합니다.

개인 정산 근거 API/화면은 모델 없이 산식·지급 시도·정정·초과 지급을 설명합니다. 지갑 변경 시 명세·AI 응답·질문 초안을 다른 지갑에 노출하지 않습니다. 검토자 화면에서 원본 제출/첨부 컨트롤을 제거하고 대조·마감에 집중했습니다. 8건 동시 청약과 부분 배정/20단위 환불을 별도 DB에서 확인했습니다.

상단 운영자 모드에서 운영자·가게·고객·투자자 화면을 선택할 수 있습니다. 이는 운영자의 설명용 화면 전환이며 실제 지갑·서버 권한을 바꾸지 않습니다. 투자자 화면의 보유액은 현재 운영 지갑의 실제 자료입니다. 고객 화면은 공개 가게/계약/매출 안내이며 음식 주문·결제는 구현 범위가 아닙니다.

사용자 지갑 0x2647…0976의 TESTNET FAUCET Dojang은 2026-10-26 13:36 KST 실제 GIWA safe 블록에서 유효함을 읽기 전용으로 확인했습니다. [실제 체인 근거](evidence/service-flow/user-dojang-probe.json). 최신 블록과 safe 사이의 대기 안내를 개선하고 변경 감시를 최대 10분으로 늘렸습니다. 철회나 계약/mint/registry 사용자 서명은 대신 실행하지 않았습니다.

업무 OpenAPI 31개 경로와 생성 Web 타입을 공유합니다. Bojagi 공식 SDK·테스트 접근은 여전히 미확인으로 NOT_CONNECTED/503을 유지합니다. 실제 모델 호출도 미구성 상태입니다.

## 검증 범위

| 증거 | 확인 | 미확인 |
| --- | --- | --- |
| Java 38 tests | 인증·RPC·CSV·산식·권한·원장/지급·정정·부분 배정 | 사용자 GIWA 거래 |
| Foundry 9 tests | mock Dojang·mint/cap/중복/이전 제한·registry | 공식 발급·Bojagi |
| Python 4 tests | fake SDK로 도구·구조화 근거·입력 제한 | 실제 모델·API 비용 |
| [로컬 업무 E2E](evidence/business-local-e2e.json) | 별도 DB/Core+Anvil, 실제 로컬 계약 mint/registry safe, DB/체인 100 일치, 지급/권한/digest | 이 tx hash는 GIWA용이 아님 |
| [SIWE HTTP](evidence/siwe-smoke.json) | 임시 무자금 서명 → Next → Spring → DB → 실제 GIWA 읽기 조회 → logout | 사용자 MetaMask 승인 |
| [사용자 지갑 probe](evidence/demo-wallet-probe.json) | safe TESTNET FAUCET 미인증 | ETH 수령은 Dojang 발급이 아님 |
| [클라우드](evidence/cloud-status.json)·[수정 화면 공개 로그인](evidence/design/production-auth-smoke.json) | 시안 반영 앱 Vercel READY·서명 로그인/개인 화면/로그아웃 12개 검사. S3·백업·reboot는 기존 검증 기록 | 사용자 MetaMask 발급/거래·stop/start IP 갱신 |

Web/체인 타입·production build·codec 결과는 [최종 검사](evidence/final-checks.json)에 보관합니다. 검증 시각 이후 상시 가동을 보장하는 기록은 아닙니다. [남은 확인](remaining-work.md)을 완료 판정에 포함합니다.

## 이번 서비스 흐름 점검

- Java 38, Foundry 9, Python 4, chain codec 1 통과. 모델/계약 테스트의 mock 범위는 기존 표와 같습니다.
- [업무 E2E 12개](evidence/business-local-e2e.json): Anvil + 별도 PostgreSQL, 8개 동시 접수·배정·계약·지급. GIWA 거래가 아닙니다.
- [비로그인 화면 17개](evidence/service-flow/guest-browser.json), [역할별 화면 14개](evidence/service-flow/role-browser.json), [공통 팝업·차트·화면 전환 15개](evidence/service-flow/wallet-chart-browser.json) 통과. 역할 검사 중 가짜 AI 응답 한 건은 지갑 간 UI 격리 검증에만 사용했고 앱에는 포함하지 않았습니다.
- 개인 근거 API의 트랜잭션/잠금 조합을 실제 HTTP 검사에서 수정했습니다. 공개 Vercel/EC2 API와 실제 사용자 Dojang 읽기까지 확인했습니다.
- Organization [UpDish](https://github.com/UpDish)과 공개 저장소 [updish](https://github.com/UpDish/updish)를 만들고 기존 아이콘을 프로필에 적용했습니다. 비밀값/환경 파일/빌드 결과는 업로드 대상에서 제외합니다.


## CSV 시연 자료 추가

가상 음식점의 6개월 참고 매출과 정상/은행 누락/현금 부족/정정 CSV 총 9개를 공개 자산으로 준비했습니다. `fixtures/catalog.json`과 `pnpm generate:demo/check:demo`로 원본/공개 바이트를 맞춥니다. 승인 자료가 없으면 명시된 샘플 차트를 보여주며, 승인 기록·개인 정산액과 섞지 않습니다. 운영자/가게 담당자는 매출관리에서 샘플을 불러와 기존 제출·검토·정산 흐름을 실행할 수 있습니다. 계약 전 자료의 정산 차단도 유지합니다.

검사: Java CSV/catalog 표적 6개(신규 2개 포함), 공개 브라우저 13개, 별도 DB/Anvil의 서명 브라우저 40개, 기존 업무 E2E 12개 통과. 상세 근거는 [demo-data](evidence/demo-data/)입니다. 기존 전체 Java 38개 실행 기록과 이번 표적 실행을 혼동하지 않습니다. 서버 런타임/DB 스키마/클라우드 데이터 변경 없이 Web 정적 자산과 UI를 배포합니다.


## 전체 UX용 데이터 먼저 준비

사용자의 최신 지시에 따라 화면 개편보다 먼저 가게/상품 8개, 선택 계정 시나리오 7개, 청약 17건, 보유 9건, 월 매출 48건과 오류/정정 CSV 3개, 정산 7개 버전/개인 명세 16건, 지급 9건, 혜택 8개/발급·사용 6건을 연결했습니다. 가상의 고객/투자자/가게/검토/운영 역할별 데이터를 조회할 수 있습니다. `ux_demo_dataset`은 별도 불변 seed 테이블이며 기존 업무 원장이나 실제 지갑 권한은 바꾸지 않습니다. Core V6와 OPERATOR 전용 읽기 API 2개를 추가해 업무 OpenAPI는 33개 경로입니다. 프론트 메뉴/진입/화면 개편은 이번 작업에서 하지 않았습니다.

[데이터 사용 안내](../fixtures/ux/README.md), [검증 근거](evidence/ux-demo/). 전체 Java 49개, 마지막 메타데이터 변경 후 표적 4개, 별도 DB/BFF/SIWE HTTP 11개 검사 통과. 보유/쿠폰/승인 표시는 SAMPLE이고 실제 GIWA/결제/모델 완료를 주장하지 않습니다.

실제 EC2 DB에도 동일 source hash로 등록했고 기존 업무 행/active run이 보존됨을 확인했습니다. 공개 로그인/일반 사용자 fixture 차단 14개도 통과했습니다. 다음 화면 개편은 [이슈 #7](https://github.com/UpDish/updish/issues/7)이며 기존 시각 QA 통과와 새 전체 UX 승인 범위를 구분합니다.
