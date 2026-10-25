# 지갑 연결 · Dojang 시연 안내

기준일: 2026-10-25 KST. 로컬 앱: http://127.0.0.1:3000/

## 준비할 것

1. Chrome·Edge 등에 설치한 [MetaMask](https://metamask.io/download/) 같은 브라우저 확장 지갑과 테스트용 일반 계정 1개. 현재 EOA의 메시지 서명을 지원하며 Safe 같은 계약 지갑의 EIP-1271 로그인은 지원하지 않는다.
2. **GIWA Sepolia**의 테스트 ETH. Ethereum Sepolia 잔액과 별개다. 로그인에는 ETH가 필요 없고, Dojang 발급·철회 거래에 가스비가 든다.
3. [GIWA 공식 Faucet](https://faucet.giwa.io/)에서 해당 테스트 계정 주소로 요청한다. 공식 문서는 24시간마다 최대 **0.005 ETH**를 안내한다. 대안은 [Nodit Faucet](https://faucet.lambda256.io/giwa-sepolia)으로, 문서상 24시간마다 최대 **0.01 ETH**다. 실제 잔액·예상 가스는 지갑에서 확인한다. 테스트 ETH를 구매할 필요는 없다.

앱과 개발자에게 개인 키나 복구 문구를 제공하지 않는다. Faucet에는 공개 주소만 입력한다. 자동 검증에서 만든 임시 지갑은 사용자 시연 지갑으로 사용하지 않는다.

## 네트워크

| 항목 | 값 |
| --- | --- |
| 이름 | GIWA Sepolia |
| Chain ID | 91342 |
| 통화 | ETH (테스트 ETH) |
| RPC | https://sepolia-rpc.giwa.io |
| 탐색기 | https://sepolia-explorer.giwa.io |

앱의 **GIWA Sepolia로 전환** 버튼이 지갑의 전환·추가 요청을 연다. 지갑에서 네트워크 정보를 확인하고 승인한다. 인앱 브라우저에서 확장 지갑을 찾지 못하면 지갑이 설치된 Chrome·Edge에서 위 로컬 주소를 연다.

## 시연 순서

1. 앱에서 **브라우저 지갑 연결**을 누르고 테스트 계정을 선택한다.
2. GIWA Sepolia로 전환한 다음 **서명하고 로그인**을 누른다. 로그인 메시지의 사이트 주소, Chain ID 91342와 용도를 확인하고 지갑에서 서명한다. 로그인은 가스비가 없는 메시지 서명이다.
3. **내 Dojang** 카드에서 연결한 주소와 현재 조회 상태를 확인한다. 처음에는 보통 **유효한 테스트 Dojang 없음**이 표시된다. 이미 발급돼 있다면 철회부터 시험할 수 있다.
4. 카드의 **발급·철회 Playground**를 연다. [공식 Playground](https://sepolia-playground.giwa.io/)에서도 앱과 **같은 주소**를 연결한다. 두 사이트의 로그인·연결은 별개이므로 주소를 직접 대조한다.
5. 발급 전에 앱의 **발급 후 변경 확인 시작**을 누르고, Playground에서 **Issue Dojang** 거래를 승인한다. 거래가 완료되면 앱으로 돌아온다. 5초 간격으로 최대 3분간 조회한다. **유효한 테스트 Dojang**과 UID, 기준 safe 블록이 표시되면 발급 상태가 확인된 것이다.
6. **철회 후 변경 확인 시작**을 누르고 Playground의 **Revoke Dojang** 거래를 승인한다. 앱에서 유효 상태가 해제되는지 확인하고, 거래 영수증에서 철회 성공을 함께 확인한다.
7. 확인을 끝내면 **로그아웃 · 연결 해제**를 누른다. 계정·네트워크 변경 시에도 앱은 로그아웃을 요청한다.

앱 안에서 발급·철회 거래를 직접 보내는 버튼은 구현하지 않았다. 공식 Playground가 거래를 만들고 사용자가 지갑에서 승인하며, 앱은 로그인한 지갑의 결과를 확인한다. VerifiedToken·UP ID 발급은 이번 Dojang 확인에 필요하지 않다.

## 결과 해석

- 허용 발급자는 **TESTNET FAUCET**이다. **UPBIT KOREA 실명 인증·투자 적격성 확인을 뜻하지 않는다.**
- 발급자 ID: `0xaa92f8c143657dde575de430aecaea6ca91f2e6072339b16932d426895d8d678`.
- 새 거래는 safe 블록에 반영된 뒤 조회된다. 3분이 지나도 반영되지 않으면 Playground의 거래 성공·네트워크·계정 주소를 확인하고 새로고침한다.
- 미인증 상태만으로 **철회·만료·미발급을 구분할 수 없다**. 화면은 유효 상태 해제로 표시하며, 철회 거래의 성공은 Playground·탐색기의 영수증으로 함께 확인한다.
- 조회 오류는 미인증으로 처리하지 않는다. 이전 조회가 남아 있다면 이전 결과라는 설명과 오류가 표시된다. 현재 상태 확인 전에는 변경 완료로 판정하지 않는다.
- 화면의 변경 이력은 현재 화면에서만 유지된다. 거래 영수증을 저장하는 업무 원장은 아직 구현하지 않았다.

## 공식 근거

- [GIWA Playground 사용법](https://docs.giwa.io/giwa-chain/en/get-started/giwa-playground): TESTNET FAUCET 사용, Issue/Revoke Dojang, 거래 가스.
- [Faucet 안내](https://docs.giwa.io/giwa-chain/en/get-started/faucets): 테스트 ETH와 한도.
- [Dojang 계약 목록](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts): 공식 Scroll·EAS·발급자.
- [EIP-4361](https://eips.ethereum.org/EIPS/eip-4361): Sign-In with Ethereum 메시지와 검증 기준.
