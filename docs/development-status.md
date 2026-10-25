# 해커톤 업무 구현 결과

2026-10-25 KST. [v0.2](../../UpDish_해커톤_개발스펙_v0.2.md) 기준.

Spring에 가상 음식점/상품·계약·DB 역할·CSV 원본/대조·모의 청약/배정/환불·보유·정산/개인 명세/정정·모의 지급/실패/부분 성공·만기·작업 이력을 구현했습니다. Flyway V3–V5로 보관합니다. 리셋은 새 run을 추가하며 과거 DB/온체인 거래를 삭제하지 않습니다.

청약은 접수 시각/ID 순서로 최대 모집 수량만 배정하며 마지막 초과분을 refunded_units로 보존합니다. 모집 이상 접수 후 새 요청은 거부합니다. 가상 배경 3,500단위는 DB 전용이며 실제 자격·mint를 주장하지 않습니다.

증빙 제출자/마감자, 정산 산정자/승인자를 분리합니다. 개인 명세와 Agent 입력을 요청자 범위로 제한합니다. S3는 private bucket·instance role·5분 PUT·2분 GET·HEAD 완료 검증을 사용합니다. 앱을 통한 실제 파일 전송은 운영 지갑 로그인 이후 확인합니다.

UpDishDemoUnits는 상품 고정·cap·Dojang·배정 중복 방지·이전 제한을, SettlementRegistry는 digest와 원정산 참조 추가 기록을 구현합니다. 체인 작업은 DB에 보관하고 사용자가 지갑으로 서명합니다. 컴파일 runtime/immutable·owner/config·거래 수신자/calldata·receipt·canonical/safe 블록·잔고/기록을 대조합니다. v0.2의 서버 운영 키 대신 사용자의 운영 지갑을 직접 사용하는 구현 선택입니다.

FastAPI Agent는 승인 정산과 개인 명세를 한 번의 읽기 도구로 받아 구조화 설명을 생성합니다. 근거 ID·데이터 버전·SIMULATION을 포함하며 기본 모델 gpt-5-mini, store=false, 자동 재시도 없음, 출력/시간/동시·일일 제한과 버전별 캐시를 사용합니다. **키 저장 승인이 거절되어 실제 모델 응답은 확인하지 않았습니다.**

웹은 제공된 ZIP의 HTML을 직접 렌더링해 흰색 상단 메뉴·3개 컬러 타일·상품 표·별도 2열 상세/청약 화면을 반영했습니다. 임의의 대형 홍보 문구와 가게 그림을 제거하고, 실제 상품 1곳과 보유/매출 관리 바로가기를 배치했습니다. SIWE·역할·서버 검증은 유지했습니다. 데스크톱과 390px 모바일 비교 및 상호작용 결과는 [디자인 검증](../design-qa.md)에 보관합니다. 업무 OpenAPI 29개 경로와 생성 타입을 공유합니다. Bojagi 공식 SDK·테스트 접근은 미확인으로 NOT_CONNECTED/503을 유지합니다.

## 검증 범위

| 증거 | 확인 | 미확인 |
| --- | --- | --- |
| Java 36 tests | 인증·RPC·CSV·산식·권한·원장/지급·정정·부분 배정 | 사용자 GIWA 거래 |
| Foundry 9 tests | mock Dojang·mint/cap/중복/이전 제한·registry | 공식 발급·Bojagi |
| Python 4 tests | fake SDK로 도구·구조화 근거·입력 제한 | 실제 모델·API 비용 |
| [로컬 업무 E2E](evidence/business-local-e2e.json) | 별도 DB/Core+Anvil, 실제 로컬 계약 mint/registry safe, DB/체인 100 일치, 지급/권한/digest | 이 tx hash는 GIWA용이 아님 |
| [SIWE HTTP](evidence/siwe-smoke.json) | 임시 무자금 서명 → Next → Spring → DB → 실제 GIWA 음성 조회 → logout | 사용자 MetaMask 승인 |
| [사용자 지갑 probe](evidence/demo-wallet-probe.json) | safe TESTNET FAUCET 미인증 | ETH 수령은 Dojang 발급이 아님 |
| [클라우드](evidence/cloud-status.json)·[수정 화면 공개 로그인](evidence/design/production-auth-smoke.json) | 시안 반영 앱 Vercel READY·서명 로그인/개인 화면/로그아웃 12개 검사. S3·백업·reboot는 기존 검증 기록 | 사용자 MetaMask 발급/거래·stop/start IP 갱신 |

Web/체인 타입·production build·codec 결과는 [최종 검사](evidence/final-checks.json)에 보관합니다. 검증 시각 이후 상시 가동을 보장하는 기록은 아닙니다. [남은 확인](remaining-work.md)을 완료 판정에 포함합니다.
