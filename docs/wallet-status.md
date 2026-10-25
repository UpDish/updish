# 지갑 · SIWE · Dojang 연결 결과

확인일: 2026-10-25 KST. 기존 v0.2 버전·배포 구성을 유지했다. 클라우드 자원이나 테스트넷 트랜잭션은 생성하지 않았다.

## 구현

- wagmi 3.7.9·viem 2.57.11로 확장 지갑 연결·GIWA 91342 전환·메시지 서명·연결 해제. React Query 5.104.5로 로그인·조회 상태 관리.
- Spring에서 canonical SIWE challenge 생성, 128비트 무작위 nonce, 5분 만료, 브라우저 세션·Origin·주소·URI·Chain ID 고정. web3j crypto 6.1.0으로 EIP-191 ECDSA 검증.
- nonce의 소비는 DB 조건부 UPDATE로 원자 처리한다. 같은 nonce의 동시 로그인도 하나만 성공한다. 새 challenge 요청은 같은 세션의 이전 challenge를 폐기한다.
- 서버 역할 INVESTOR 부여, 로그인 시 세션 ID·CSRF 토큰 교체. PostgreSQL 기반 Spring Session과 HttpOnly·SameSite=Lax 쿠키, 미사용 만료 30분. 토큰·개인 키를 브라우저 localStorage에 저장하지 않는다.
- Next 중계는 세션 쿠키·CSRF·허용 Origin만 전달한다. 공개 Origin과 Host를 함께 검사한다. Core도 별도로 Origin과 CSRF를 검사한다. 지갑·네트워크 변경 시 화면 접근 해제와 서버 로그아웃을 수행한다.
- 인증된 `/api/v1/me/dojang`은 세션의 주소로 조회한다. 공식 Playground·Faucet 연결, safe 블록 기준 상태·UID·조회 시점 표시, 발급/해제 변화 확인과 최대 3분 polling을 제공한다.

## 검증 범위와 결과

| 검증 | 결과 |
| --- | --- |
| Java 전체 | **20건 통과**: SIWE 8, GIWA 8, RPC 3, Spring/DB 1 |
| SIWE 부정 검증 | 메시지 각 필드 변조, 다른 서명자·세션·Origin, 만료, 이전 challenge, 동시 재사용 거부 |
| Next production build·타입, 체인 스크립트 타입 | 통과 |
| 실제 로컬 HTTP 흐름 | viem 임시 서명 → Next → Spring → DB 세션 → 실제 GIWA 조회 → 로그아웃 통과 |
| 브라우저 | 지갑 연결 → Chain 1에서 GIWA 전환 → 서명 로그인 → 실제 미인증 결과 표시, 계정 변경 후 서버 세션 false 확인 |
| 화면 변화 | **모의 API 응답**으로 발급 상태 진입·유효 상태 해제 시 polling 종료와 이력 표시 확인 |
| 사용자 지갑으로 실제 발급·철회 | **미실행**. 사용자가 테스트 지갑·ETH를 준비하고 Playground 거래 승인 필요 |

[HTTP 결과](evidence/siwe-smoke.json)와 [로그인 화면](evidence/siwe-login.png)을 보관했다. 화면은 자금 없는 임시 테스트 서명자로 로그인한 뒤 실제 GIWA의 미인증 응답을 표시한 장면이다. 브라우저의 EIP-1193 provider만 검증용으로 대체했으며 백엔드·서명 검증·DB·음성 체인 조회는 실제 실행했다. 모의 발급·해제 화면 응답을 실제 온체인 발급·철회 성공으로 보고하지 않는다.

정상 계정 변경 이벤트에서 화면 접근 해제와 서버 로그아웃이 확인됐다. SIWE 메시지는 HTTP 로컬 환경에서도 서명 출처를 일치시키기 위해 scheme을 명시한다.

최종 빌드 재기동 후 HTTP 서명 검증을 다시 통과했다. 검증용 provider가 없는 새 브라우저에서 지갑 부재 안내를 확인했으며 콘솔 오류·경고는 0건이었다. 임시 서명 helper는 종료했고 실제 로컬 앱·Core·PostgreSQL은 실행 중이다.

## 실제 지갑 확인에 남은 것

[지갑·Dojang 시연 안내](wallet-guide.md)에 따라 같은 지갑으로 Issue Dojang → 앱의 유효 상태·UID 확인 → Revoke Dojang → 앱의 유효 상태 해제와 탐색기 영수증 확인을 진행한다. 이번 범위의 발급·철회 서명 주체는 사용자 지갑이며 앱 안의 직접 거래 제출은 구현하지 않았다. EIP-1271 계약 지갑 검증과 영수증 영구 보관도 후속 범위다.

Spring Boot 4.1.2, Java 25, FastAPI 0.162.0, Python 3.13, Next.js 16.4.3, PostgreSQL 18.6, EC2·Vercel 배포 방향과 Bojagi 미연결 상태는 유지한다.
