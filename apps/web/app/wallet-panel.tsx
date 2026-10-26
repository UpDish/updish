'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useConfig, useConnect, useConnection, useConnectors, useDisconnect, useSignMessage, useSwitchChain } from 'wagmi';
import { getConnection } from 'wagmi/actions';
import { api, authPost, type Session } from '../lib/auth';
import { DojangPanel } from './dojang-panel';
import {qrWalletEnabled,selectWallet} from '../lib/wallet-modal';

function message(error: unknown) {
  if (error instanceof Error && /provider not found/i.test(error.message)) return '브라우저 지갑을 찾지 못했습니다. 지갑이 설치된 Chrome·Edge에서 이 주소를 열어 주세요.';
  if (error instanceof Error && /reject|denied|cancel/i.test(error.message)) return '지갑 요청을 취소했습니다. 준비되면 다시 시도해 주세요.';
  return error instanceof Error ? error.message.split('\n')[0] : '지갑 요청을 완료하지 못했습니다.';
}

export function WalletPanel() {
  const config = useConfig();
  const wallet = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const sign = useSignMessage();
  const switchChain = useSwitchChain();
  const cache = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [notice, setNotice] = useState('');
  const [selecting,setSelecting]=useState(false);
  async function chooseWallet(connector:typeof connectors[number]) {
    setNotice('');setSelecting(true);
    try {await selectWallet();await connect.mutateAsync({connector});}
    catch(error){setNotice(message(error));}
    finally{setSelecting(false);}
  }
  const session = useQuery({ queryKey: ['session'], queryFn: () => api<Session>('/api/auth/session'), retry: false });
  const serverAddress = session.data?.authenticated ? session.data.user.address : undefined;
  const sameWallet = wallet.address?.toLowerCase() === serverAddress?.toLowerCase();
  const ready = wallet.status === 'connected' && sameWallet && wallet.chainId === 91342 && !!serverAddress;

  const logout = useMutation({ mutationFn: () => authPost<Session>('logout'),
    onSuccess: data => { cache.setQueryData(['session'], data); cache.removeQueries({ queryKey: ['my-dojang'] }); },
  });
  const login = useMutation({
    mutationFn: async () => {
      const current = getConnection(config);
      if (!current.address || current.chainId !== 91342) throw new Error('GIWA Sepolia 지갑을 연결해 주세요.');
      const challenge = await authPost<{ challengeId: string; message: string }>('challenge', { address: current.address });
      const signature = await sign.mutateAsync({ message: challenge.message, account: current.address });
      const after = getConnection(config);
      if (after.address !== current.address || after.chainId !== 91342) throw new Error('서명 중 지갑이 바뀌었습니다. 다시 로그인해 주세요.');
      const result = await authPost<Session>('verify', { ...challenge, signature });
      const final = getConnection(config);
      if (final.address !== current.address || final.chainId !== 91342) {
        await authPost('logout'); throw new Error('지갑 변경으로 로그인을 취소했습니다.');
      }
      return result;
    },
    onSuccess: data => { cache.setQueryData(['session'], data); setNotice('지갑 서명으로 로그인했습니다.'); },
  });

  useEffect(() => { setMounted(true); }, []);
  // Session privileges disappear from the screen immediately on wallet/network change.
  // The server session is also invalidated; failure remains visible and can be retried.
  useEffect(() => {
    if (mounted && serverAddress && !login.isPending && !logout.isPending && !logout.isError
        && wallet.status !== 'connecting' && wallet.status !== 'reconnecting'
        && (wallet.status === 'disconnected' || !sameWallet || wallet.chainId !== 91342)) {
      setNotice('지갑 또는 네트워크가 바뀌어 로그아웃했습니다.');
      logout.mutate();
    }
  }, [mounted, serverAddress, wallet.status, wallet.chainId, sameWallet, login.isPending, logout.isPending, logout.isError, logout.mutate]);

  async function disconnectWallet() {
    setNotice('');
    try {
      await logout.mutateAsync();
      await disconnect.mutateAsync({});
      login.reset();
    } catch (error) { setNotice(message(error)); }
  }

  return <div className="grid wallet-grid">
    <section className="card" aria-busy={login.isPending || connect.isPending || selecting}>
      <span className="step">01 / WALLET</span><h2>지갑으로 로그인</h2>
      <p>서명 한 번으로 로그인합니다. 로그인 서명은 가스비가 없고, 자금 이동을 승인하지 않습니다.</p>
      {!mounted || wallet.status === 'reconnecting' ? <p>지갑 연결 확인 중…</p> : wallet.status !== 'connected' ? <>
        <div className="actions">{connectors.map(connector => <button key={connector.uid}
          disabled={connect.isPending||selecting} onClick={() => void chooseWallet(connector)}>
          {connect.isPending||selecting ? '지갑 확인 중…' : '지갑 선택하고 연결'}
        </button>)}</div>
        <p className="hint">지갑이 없다면 <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">MetaMask 설치 ↗</a> 후 테스트용 계정을 준비해 주세요. 확장 지갑을 쓸 수 있는 Chrome·Edge에서 이 주소를 열어 주세요.</p>
        {!qrWalletEnabled?<p className="hint">현재는 설치된 브라우저 지갑을 지원합니다. 모바일 QR 연결은 준비 중입니다.</p>:null}
      </> : <>
        <p className="mono wallet-address">{wallet.address}</p>
        <p className="hint">{wallet.chainId === 91342 ? 'GIWA Sepolia · Chain 91342' : `현재 Chain ${wallet.chainId} · GIWA Sepolia 전환 필요`}</p>
        <div className="actions">
          {wallet.chainId !== 91342 ? <button onClick={() => switchChain.mutate({ chainId: 91342 })}
            disabled={switchChain.isPending}>GIWA Sepolia로 전환</button> : !ready ? <button
            onClick={() => { setNotice(''); login.mutate(); }} disabled={login.isPending || logout.isPending || !!serverAddress}>
            {login.isPending ? '지갑에서 서명해 주세요…' : '서명하고 로그인'}</button> : <strong className="success">로그인 완료 · {session.data?.authenticated&&session.data.user.role==='OPERATOR'?'운영자':session.data?.authenticated&&session.data.user.role==='REVIEWER'?'검토자':session.data?.authenticated&&session.data.user.role==='MERCHANT'?'가게':'투자자'}</strong>}
          <button className="secondary" onClick={disconnectWallet} disabled={logout.isPending || login.isPending}>로그아웃 · 연결 해제</button>
        </div>
        <p className="hint">개인 키·복구 문구를 입력하지 않습니다. 현재는 일반 계정 지갑의 서명을 지원합니다.</p>
      </>}
      <div aria-live="polite">{notice ? <p className="hint">{notice}</p> : null}</div>
      {[connect.error, switchChain.error, login.error, logout.error, session.error].filter(Boolean).map((error, index) =>
        <p className="error" role="alert" key={index}>{message(error)}</p>)}
      {logout.isError ? <button className="secondary" onClick={() => logout.mutate()}>로그아웃 다시 시도</button> : null}
    </section>
    {ready ? <DojangPanel key={serverAddress} address={serverAddress!} /> : <section className="card locked">
      <span className="step">02 / DOJANG</span><h2>내 Dojang 발급·철회 확인</h2>
      <p>지갑 연결과 로그인을 마치면 내 지갑의 테스트 Dojang을 조회할 수 있습니다.</p>
      <ol><li>테스트 지갑 연결</li><li>GIWA Sepolia 선택 · 로그인 서명</li><li>공식 Playground에서 발급·철회 후 여기서 확인</li></ol>
      <a href="https://faucet.giwa.io/" target="_blank" rel="noreferrer">테스트 ETH 받기 ↗</a>
    </section>}
  </div>;
}
