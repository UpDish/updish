'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type Verification } from '../lib/auth';

type Watch = { expected: boolean; baseline: Verification; deadline: number };
export function DojangPanel({ address }: { address: string }) {
  const cache = useQueryClient();
  const [watch, setWatch] = useState<Watch | null>(null);
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const watchRef = useRef(watch); watchRef.current = watch;
  const query = useQuery({ queryKey: ['my-dojang', address], queryFn: () => api<Verification>('/api/me/dojang'),
    retry: false, refetchOnWindowFocus: true, refetchInterval: watch ? 5000 : false,
  });
  const result = query.data;

  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) {
      cache.setQueryData(['session'], { authenticated: false });
    }
  }, [query.error, cache]);

  useEffect(() => {
    const current = watchRef.current;
    if (!current || !result) return;
    if (result.address.toLowerCase() === address.toLowerCase() && result.verified === current.expected
        && result.blockNumber !== current.baseline.blockNumber
        && result.checkedAt > current.baseline.checkedAt) {
      const text = current.expected ? '발급 후 유효 상태 확인' : '유효 상태 해제 확인 · 철회 또는 만료';
      setNotice(`${text} · safe 블록 ${result.blockNumber}`);
      setHistory(previous => [`${text} · ${result.checkedAt} · 블록 ${result.blockNumber}`, ...previous].slice(0, 6));
      setWatch(null);
    }
  }, [result, address]);

  useEffect(() => {
    if (!watch) return;
    const timer = setTimeout(() => { setWatch(null); setNotice('10분 동안 변경을 확인하지 못했습니다. Playground 거래 완료 여부를 확인한 뒤 다시 조회해 주세요.'); },
      Math.max(0, watch.deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [watch]);

  function waitFor(expected: boolean) {
    if (!result || query.isError || query.isFetching || result.verified === expected) return;
    setNotice('공식 Playground를 같은 지갑으로 연결해 거래를 승인해 주세요. safe 블록 반영을 최대 10분간 확인합니다.');
    setWatch({ expected, baseline: result, deadline: Date.now() + 600_000 });
  }

  return <section className="card" aria-busy={query.isFetching}>
    <span className="step">02 / DOJANG</span><h2>내 Dojang 발급·철회 확인</h2>
    <p>TESTNET FAUCET 발급자만 확인합니다. 업비트 실명 인증을 뜻하지 않는 테스트 증명입니다.</p>
    <div aria-live="polite">
      {result ? <div className="result">
        <strong className={result.verified ? 'success' : 'pending'}>{result.verified ? '유효한 테스트 Dojang' : 'safe 기준 미확인 · 미발급 또는 반영 대기'}</strong>
        <p className="mono">{result.address}</p><p>safe 블록 {result.blockNumber} · {new Date(result.checkedAt).toLocaleTimeString('ko-KR')}</p>
        {result.attestationUid ? <p className="mono">UID: {result.attestationUid}</p> : null}
        <p className="hint">{query.isError ? '이전 조회 결과입니다. 현재 상태는 확인되지 않았습니다.' : 'Playground에 Verified가 떠도 safe 블록 반영은 몇 분 더 걸릴 수 있습니다. 최근 발급했다면 중복 발급하지 말고 잠시 뒤 새로고침해 주세요.'}</p>
      </div> : <p>{query.isPending ? '내 지갑의 온체인 상태를 조회 중…' : '조회 결과를 확인해 주세요.'}</p>}
    </div>
    {query.error ? <p role="alert" className="error">{query.error instanceof ApiError && query.error.status === 401 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' : query.error.message}</p> : null}
    <div className="actions"><button className="secondary" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>
      {query.isFetching ? '조회 중…' : '내 Dojang 새로고침'}</button>
      <a className="button-link" href="https://sepolia-playground.giwa.io/" target="_blank" rel="noreferrer">발급·철회 Playground ↗</a></div>
    <p className="hint">Playground에도 위 주소를 연결하고 <b>Issue Dojang</b> 또는 <b>Revoke Dojang</b>을 승인해 주세요. 거래에 GIWA Sepolia 테스트 ETH가 필요합니다.</p>
    {!watch ? <div className="actions">
      <button className="secondary" disabled={!result || result.verified || query.isError || query.isFetching} onClick={() => waitFor(true)}>발급 후 변경 확인 시작</button>
      <button className="secondary" disabled={!result?.verified || query.isError || query.isFetching} onClick={() => waitFor(false)}>철회 후 변경 확인 시작</button>
    </div> : <button className="secondary" onClick={() => { setWatch(null); setNotice('자동 확인을 중지했습니다.'); }}>변경 확인 중… 중지</button>}
    <p className="hint" role="status">{notice}</p>
    {history.length ? <ul className="history">{history.map(item => <li key={item}>{item}</li>)}</ul> : null}
    <p className="hint">미인증 조회만으로 철회와 만료를 구분할 수 없습니다. 거래 영수증은 Playground·탐색기에서 확인해 주세요. 확인 이력은 현재 화면에서만 유지됩니다.</p>
    <a href="https://faucet.giwa.io/" target="_blank" rel="noreferrer">GIWA 테스트 ETH 받기 ↗</a>
  </section>;
}
