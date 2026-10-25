# 첫 개발 단계 결과

현재 상태는 [업무 구현 결과](development-status.md)와 [배포 안내](deploy-runbook.md)를 기준으로 한다. 아래 내용은 당시의 이력이다.

이 문서는 첫 단계의 이력이다. 이후 구현한 지갑 연결·SIWE·Dojang 확인 흐름은 [현재 로그인 개발 상태](wallet-status.md)를 기준으로 한다.

확인일: 2026년 10월 25일 KST. 기준: 해커톤 개발 스펙 v0.2.

프로젝트 기본 구조와 GIWA·Dojang 읽기 연동을 구현하고 로컬에서 확인했다. 현재 사용자의 자금·개인 키는 사용하지 않았고 테스트넷 트랜잭션을 전송하지 않았다.

## 구현한 내용

| 영역 | 결과 |
| --- | --- |
| 저장소 | 상위 홈 Git과 분리된 독립 저장소, `codex/bootstrap` 브랜치 |
| Core API | Spring Boot 4.1.2·Java 25·Gradle 9.8.2, JPA·Flyway·Security 기본 구성 |
| DB | PostgreSQL 18.6 컨테이너 기동, migration 1건 적용, EBS로 옮길 수 있는 named volume |
| Agent API | FastAPI 0.162.0·Python 3.13, health·capabilities. 모델 호출 미구현 |
| Web | Next.js 16.4.3·React 19.3.1, 같은 출처 API 중계와 실제 연동 확인 화면 |
| Chain | 공식 주소·최소 ABI, 읽기 전용 probe, Solidity 자격 reader |
| 실행 | 로컬 실행 안내·앱 Dockerfile·Compose profile. 클라우드 자원은 생성하지 않음 |

## 실제 GIWA 확인

[원본 응답](evidence/giwa-probe.json)에 RPC 호스트·블록·관측 code hash를 저장했다.

- Chain ID **91342** 확인.
- 공식 DojangScroll 주소에서 proxy bytecode **141 bytes** 확인.
- EAS 주소에서 bytecode **2,059 bytes** 확인.
- `safe`와 `finalized` 블록 조회 응답 확인.
- 0 주소를 음성 대조군으로 사용해 TESTNET FAUCET의 `isVerified`가 false인 상태 확인.
- 동일 safe 블록에 계약 코드와 Dojang 조회를 고정.
- 실제 지갑의 발급 성공·철회는 아직 확인하지 않음.

관측 code hash는 해당 주소에서 읽은 결과다. proxy 구현 전체에 대한 별도 보안 검토나 실명 확인 결과를 뜻하지 않는다.

## 확인 과정에서 반영한 동작

공식 DojangScroll 소스의 UID getter는 attestation 유효성을 검증하며 미인증·무효 상태에서 revert한다. 따라서 먼저 `isVerified`를 읽고 true일 때만 UID를 요청한다. false인 경우 UID는 null이며 RPC 오류와 구별한다.

공개 RPC의 최신 블록 기준 조회에서 간헐적 빈 응답을 관측했다. Core는 일시적인 전송·응답 오류에 한 번 재시도하고, 확인 기준을 safe 블록으로 고정했다. 계속 실패하면 503을 반환한다. 응답 ID·chain ID·계약 코드 검사를 생략하거나 오류를 미인증·성공으로 바꾸지 않는다.

safe 블록은 최신 head보다 뒤에 있다. 새 Dojang 발급·철회가 화면에 나타나기까지 지연될 수 있으며 화면에 이 기준을 표시했다. 향후 mint의 컨트랙트 검사는 실행 시점의 온체인 상태로 다시 수행해야 한다.

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| Java 단위·HTTP adapter·Spring/DB context | **12건 통과** |
| Foundry 로컬 계약 검증 | **3건 통과**: 발급·철회, 다른 발급자 거부, 조회 실패 전파 |
| viem과 Java ABI selector 대조 | **1건 통과** |
| 체인 스크립트 TypeScript 검사 | 통과 |
| Next.js production build와 타입 검사 | 통과 |
| FastAPI health·capabilities | 실제 로컬 HTTP 응답 확인 |
| Compose 설정 검사·PostgreSQL health | 통과 |
| 브라우저 → Next.js → Spring → GIWA → 화면 | 네트워크 확인과 미인증 조회 표시 확인 |
| 잘못된 지갑 주소 | HTTP 400 |
| 공개 조회 경로에 대한 쓰기 요청 | HTTP 403 |

[로컬 API 응답](evidence/local-smoke.json), [화면 캡처](evidence/integration-screen.png)를 보관한다. Solidity의 발급·철회 검증은 로컬 mock 계약을 사용하며 실제 Playground 발급 결과와 구분한다. Dockerfile의 전체 앱 이미지 빌드는 이번 확인 범위에 포함하지 않았다.

## 남은 작업

1. 실제 사용자 지갑 연결·SIWE·서버 역할 연결.
2. 준비한 시연 지갑으로 공식 Playground 발급·철회, positive 경로와 safe 반영 지연 확인.
3. 모의 청약·배정·제한형 ERC-1155와 중복 mint 방지.
4. CSV 대조·정산·정정·정산 기록 컨트랙트.
5. [Bojagi 조사](research/bojagi.md)의 공식 SDK·테스트 환경 접근 조건 해소.
6. Agent의 실제 근거 조회·모델 호출과 EC2·Vercel 배포.

로컬 확인 주소는 `http://127.0.0.1:3000`이다. 서버를 종료한 뒤 재실행하는 명령은 저장소 [실행 안내](../README.md)에 있다.
