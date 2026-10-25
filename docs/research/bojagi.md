# Bojagi 공식 연동 조사

확인 기준일: 2026년 10월 25일 KST. 상태: **NOT_CONNECTED**.

GIWA 공식 사이트는 Bojagi를 영지식 증명 기반의 PRIVATE TRANSFERS 프로토콜로 소개한다. UpDish에서는 개인별 테스트 분배 거래정보 보호에 연결하는 목표를 유지한다. 이번 조사에서 공식 SDK·testnet 호출 절차를 확인하지 못했으므로 실제 프로토콜 호출은 구현하지 않았다.

## 확인한 경로

| 경로 | 확인 결과 |
| --- | --- |
| [GIWA 공식 사이트](https://giwa.io/home) | Bojagi의 목적·기술 소개 확인. SDK·검증기·테스트 자산·호출 예제는 확인하지 못함 |
| [공식 GIWA 문서](https://docs.giwa.io/) | GIWA·Dojang·Playground 문서 확인. Bojagi 개발 절차는 확인하지 못함 |
| [공식 GitHub 조직](https://github.com/giwa-io) | 공개 repository 9개를 GitHub API로 조회. Bojagi 전용 공개 저장소는 확인하지 못함 |
| [공개 저장소 목록 API](https://api.github.com/orgs/giwa-io/repos?per_page=100) | node, dojang, .github, chains, PoWFaucet, viem, rundler, chain-operations, superchain-registry |
| [Dojang 공식 소스](https://github.com/giwa-io/dojang) | Dojang 계약과 조회 구조 확인. Bojagi SDK로 대체할 자료는 아님 |
| [Bojagi/bojagi](https://github.com/bojagi/bojagi) | 동명 UI 리뷰 도구. GIWA 프라이버시 프로토콜과 구분하며 의존성에 추가하지 않음 |

공개 SDK가 존재하지 않는다는 결론은 아니다. 현재 확인한 공식 공개 경로로는 출처·접근 권한·호환성을 검증할 수 없다는 상태다.

## 실제 연동에 필요한 자료

- 공식 SDK 배포처·버전·라이선스와 GIWA Sepolia 지원 여부.
- 테스트 계약·검증기·지원 자산·테스트 자산 준비 방법.
- 증명 생성·제출·검증·결과 조회 예제와 인증 조건.
- 지원 runtime·Linux ARM 또는 x86_64·메모리 요구량.
- 공개되는 송수신자·금액·메타데이터의 범위.
- 재시도·중복 제출·최종 성공을 판단하는 기준.

이 자료를 확인한 뒤 공식 sample을 독립 검증하고 UpDish의 분배 업무와 연결한다. 접근되지 않은 프로토콜을 자체 암호화나 가짜 proof로 대신하지 않는다. 현재 API와 웹은 미연결 상태를 명시한다.

## Dojang과의 구분

Dojang은 공개 계약·ABI·Playground 경로가 있어 현재 읽기 전용으로 연결했다. [공식 Playground 문서](https://docs.giwa.io/giwa-chain/en/get-started/giwa-playground)는 TESTNET FAUCET 발급과 철회를 안내한다. 실제 사용자 지갑으로 발급·철회하는 시연은 아직 실행하지 않았다.

개발 지원 문의처는 [Dojang 공식 안내](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang)의 `buidl@giwa.io`다. 이 주소가 Bojagi SDK 접근을 보장하는 것은 아니며, 이번 작업에서 외부 문의를 발송하지 않았다.
