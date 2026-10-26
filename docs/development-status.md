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
- 개인 근거 API의 트랜잭션/잠금 조합을 실제 HTTP 검사에서 수정했습니다. 배포 API까지 확인한 뒤 완료로 기록합니다.
- Organization [UpDish](https://github.com/UpDish)과 공개 저장소 [updish](https://github.com/UpDish/updish)를 만들고 기존 아이콘을 프로필에 적용했습니다. 비밀값/환경 파일/빌드 결과는 업로드 대상에서 제외합니다.
