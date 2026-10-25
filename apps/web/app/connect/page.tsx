'use client';

import { useState, type FormEvent } from 'react';
import { WalletPanel } from '../wallet-panel';

type Network = {
  network: string; chainId: number; blockNumber: string;
  contractCodeBytes: Record<string, number>; checkedAt: string;
};
type Verification = {
  address: string; status: 'VERIFIED_TESTNET' | 'NOT_VERIFIED'; verified: boolean;
  attester: string; attestationUid: string | null; blockNumber: string; checkedAt: string;
};

async function read<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(35_000) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? '조회에 실패했습니다.');
  return body as T;
}

export default function Page() {
  const [network, setNetwork] = useState<Network | null>(null);
  const [networkError, setNetworkError] = useState('');
  const [networkLoading, setNetworkLoading] = useState(false);
  const [address, setAddress] = useState('');
  const [verification, setVerification] = useState<Verification | null>(null);
  const [dojangError, setDojangError] = useState('');
  const [dojangLoading, setDojangLoading] = useState(false);

  async function checkNetwork() {
    setNetworkLoading(true); setNetworkError(''); setNetwork(null);
    try { setNetwork(await read<Network>('/api/chain/status')); }
    catch (error) { setNetworkError(error instanceof Error ? error.message : '연결에 실패했습니다.'); }
    finally { setNetworkLoading(false); }
  }

  async function checkDojang(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerification(null); setDojangError('');
    const requested = address.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(requested)) {
      setDojangError('0x로 시작하는 지갑 주소 42자를 입력해 주세요.'); return;
    }
    setDojangLoading(true);
    try { setVerification(await read<Verification>(`/api/dojang/${requested}`)); }
    catch (error) { setDojangError(error instanceof Error ? error.message : '조회에 실패했습니다.'); }
    finally { setDojangLoading(false); }
  }

  return <>
    <header><a className="logo" href="/">UpDish</a><span className="pill">해커톤 · 테스트넷</span></header>
    <main>
      <p className="eyebrow">WALLET · SIWE · DOJANG</p>
      <h1>투자 흐름의 시작,<br />확인할 수 있는 신뢰.</h1>
      <p className="lead">내 지갑으로 로그인하고 GIWA의 테스트 증명을 확인합니다. 공식 Playground에서 발급·철회한 결과를 이곳에서 이어서 확인하세요.</p>
      <WalletPanel />
      <h2 className="diagnostic-title">공개 연동 조회</h2>
      <div className="grid">
        <section className="card" aria-busy={networkLoading}>
          <span className="step">NETWORK</span><h2>GIWA 연결</h2>
          <p>네트워크와 공식 Dojang·EAS 계약의 배포 상태를 조회합니다.</p>
          <button onClick={checkNetwork} disabled={networkLoading}>{networkLoading ? '확인 중…' : '연결 확인'}</button>
          <div aria-live="polite">
            {network ? <div className="result">
              <strong className="success">테스트넷 연결 확인</strong>
              <dl><dt>네트워크</dt><dd>{network.network}</dd><dt>Chain ID</dt><dd>{network.chainId}</dd>
                <dt>기준 블록 (safe)</dt><dd>{network.blockNumber}</dd>
                <dt>Dojang 계약</dt><dd>{network.contractCodeBytes.DojangScroll} bytes</dd>
                <dt>EAS 계약</dt><dd>{network.contractCodeBytes.EAS} bytes</dd></dl>
            </div> : null}
          </div>
          {networkError ? <p role="alert" className="error">{networkError}</p> : null}
        </section>
        <section className="card" aria-busy={dojangLoading}>
          <span className="step">PUBLIC LOOKUP</span><h2>주소로 Dojang 조회</h2>
          <p>허용 발급자는 TESTNET FAUCET으로 고정됩니다. 업비트 실명 인증과 구분되는 테스트 증명입니다.</p>
          <form onSubmit={checkDojang}>
            <label htmlFor="wallet">조회할 지갑 주소</label>
            <input id="wallet" value={address} onChange={event => setAddress(event.target.value)}
              placeholder="0x…" autoComplete="off" spellCheck={false} required maxLength={42} disabled={dojangLoading} />
            <button type="submit" disabled={dojangLoading}>{dojangLoading ? '조회 중…' : 'Dojang 조회'}</button>
          </form>
          <div aria-live="polite">
            {verification ? <div className="result">
              <strong className={verification.verified ? 'success' : 'pending'}>
                {verification.verified ? '테스트 Dojang 확인됨' : '유효한 테스트 Dojang이 없습니다'}
              </strong>
              <p className="mono">{verification.address}</p>
              <p>발급자: {verification.attester} · safe 블록: {verification.blockNumber}</p>
              <p>방금 발급·철회한 결과는 안전 확인된 블록에 포함된 뒤 반영됩니다.</p>
              {verification.attestationUid ? <p className="mono">UID: {verification.attestationUid}</p> : null}
              <a href="https://sepolia-playground.giwa.io/" target="_blank" rel="noreferrer">공식 Playground 열기 ↗</a>
            </div> : null}
          </div>
          {dojangError ? <p role="alert" className="error">{dojangError}</p> : null}
        </section>
      </div>
      <section className="notice"><span className="step">03 / PROTECT</span><h2>Bojagi 연결 조건 확인 중</h2>
        <p>공식 SDK·테스트 환경·검증기 접근을 확인한 뒤 개인별 테스트 분배를 연결합니다. 현재 프로토콜은 연결되지 않았습니다.</p>
      </section>
      <footer>Spring Boot 4.1.2 / Java 25 · FastAPI 0.162.0 / Python 3.13 · Next.js 16.4.3 · PostgreSQL 18.6</footer>
    </main>
  </>;
}
