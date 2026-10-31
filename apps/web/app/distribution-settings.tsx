'use client';
import {useEffect,useState} from 'react';
import {useConnection,usePublicClient,useWalletClient} from 'wagmi';
import type {Abi,Address,Hex} from 'viem';
import {giwaSepolia} from '../../../packages/chain-config/giwa';
import builds from '../lib/contract-build.json';
import {command,type Offering} from '../lib/workbench';
import {useDistributions} from './distribution-receipts';
import {Modal} from './modal';
type Props={offering:Offering;contracts:{units_address:string;registry_address:string}[];onRefresh:()=>Promise<void>;onNotice:(s:string)=>void};
export function DistributionSettings({offering:o,contracts,onRefresh,onNotice}:Props){
  const connection=useConnection(),{data:wallet}=useWalletClient(),publicClient=usePublicClient({chainId:91342});
  const history=useDistributions(connection.address??'');
  const config=history.data?.configs.find(c=>c.offering_id===o.id);
  const [open,setOpen]=useState(false),[cash,setCash]=useState(''),[vault,setVault]=useState(''),[busy,setBusy]=useState(false);
  const [deploymentHashes,setDeploymentHashes]=useState<{cash?:string;vault?:string}>({});
  const storage=`updish.distribution.v1.${o.id}`;
  useEffect(()=>{try{const value=JSON.parse(localStorage.getItem(storage)??'{}');setCash(config?.cash_address??value.cash??'');setVault(config?.vault_address??value.vault??'');setDeploymentHashes({cash:localStorage.getItem(`${storage}.cash.tx`)??undefined,vault:localStorage.getItem(`${storage}.vault.tx`)??undefined});}catch{onNotice('이전 분배 계약 주소를 읽지 못했습니다.');}},[storage,config?.cash_address,config?.vault_address,onNotice]);
  async function deploy(kind:'cash'|'vault',recoverOnly=false){
    if(!wallet||!publicClient||!connection.address||connection.chainId!==91342)return;
    if(kind==='vault'&&(!contracts[0]||!/^0x[0-9a-fA-F]{40}$/.test(cash))){onNotice('수량·기록 계약을 등록하고 DEMO 토큰을 먼저 배포해 주세요.');return;}
    setBusy(true);
    try{
      let hash=localStorage.getItem(`${storage}.${kind}.tx`) as Hex|null;
      if(!hash){
        if(recoverOnly)throw new Error('복구할 배포 해시가 없습니다.');
        const build=kind==='cash'?builds.UpDishDemoCash:builds.UpDishDistribution;
        const args=kind==='cash'?[connection.address]:[connection.address,cash as Address,contracts[0].units_address as Address,contracts[0].registry_address as Address,`0x${o.run_id.replaceAll('-','').padStart(64,'0')}` as Hex,BigInt(o.token_id),BigInt(o.target_units)];
        hash=await wallet.deployContract({abi:build.abi as Abi,bytecode:build.bytecode as Hex,args,account:connection.address,chain:giwaSepolia});
        localStorage.setItem(`${storage}.${kind}.tx`,hash);
      }
      setDeploymentHashes(previous=>({...previous,[kind]:hash}));
      onNotice('배포 거래를 확인하고 있습니다. 응답이 지연되면 기존 배포 확인을 사용하세요.');
      const receipt=await publicClient.waitForTransactionReceipt({hash,timeout:120_000});
      if(receipt.status!=='success'){localStorage.removeItem(`${storage}.${kind}.tx`);throw new Error('실패한 배포 영수증을 확인했습니다. 다음 시도에서 새 배포를 요청할 수 있습니다.');}
      if(!receipt.contractAddress)throw new Error('계약 주소를 확인하지 못했습니다.');
      const nextCash=kind==='cash'?receipt.contractAddress:cash,nextVault=kind==='vault'?receipt.contractAddress:vault;
      setCash(nextCash);setVault(nextVault);localStorage.setItem(storage,JSON.stringify({cash:nextCash,vault:nextVault}));onNotice('배포 주소를 확인했습니다. 서버 검증·등록을 진행해 주세요.');
    }catch(e){onNotice(e instanceof Error?e.message.split('\n')[0]:'배포 상태 확인 실패');}finally{setBusy(false);}
  }
  async function register(){setBusy(true);try{await command('distribution/contracts',{cashAddress:cash,vaultAddress:vault});await onRefresh();setOpen(false);onNotice('DEMO 자산과 분배 계약의 빌드·설정을 검증했습니다.');}catch(e){onNotice(e instanceof Error?e.message:'계약 확인 실패');}finally{setBusy(false);}}
  return <section className="card distribution-setup"><div className="panel-heading"><h2>테스트 자산 분배</h2><span className="badge">{config?'연결됨':'사전 준비'}</span></div><p>승인 정산을 GIWA의 DEMO 토큰으로 분배합니다. 현금 가치·원화 담보는 없습니다.</p><button className="secondary" onClick={()=>setOpen(true)}>분배 계약 설정</button>
    {open?<Modal title="테스트 자산·분배 계약 설정" wide busy={busy} onClose={()=>setOpen(false)}><p>DEMO 토큰은 수량·정산 기록 계약의 확정을 기다리는 동안 먼저 배포할 수 있습니다. 분배 계약은 두 계약을 서버에서 검증·등록한 뒤 배포합니다.</p><div className="actions"><button disabled={busy} onClick={()=>void deploy('cash')}>1. DEMO 토큰 배포</button><button className="secondary" disabled={busy} onClick={()=>void deploy('cash',true)}>기존 토큰 배포 확인</button><button disabled={busy||!contracts.length||!cash} onClick={()=>void deploy('vault')}>2. 분배 계약 배포</button><button className="secondary" disabled={busy} onClick={()=>void deploy('vault',true)}>기존 분배 배포 확인</button></div><div className="actions">{deploymentHashes.cash?<a href={`https://sepolia-explorer.giwa.io/tx/${deploymentHashes.cash}`} target="_blank" rel="noreferrer">DEMO 토큰 배포 영수증 ↗</a>:null}{deploymentHashes.vault?<a href={`https://sepolia-explorer.giwa.io/tx/${deploymentHashes.vault}`} target="_blank" rel="noreferrer">분배 계약 배포 영수증 ↗</a>:null}</div><label htmlFor="demo-cash">DEMO 토큰 주소</label><input id="demo-cash" value={cash} onChange={e=>setCash(e.target.value)}/><label htmlFor="demo-vault">분배 계약 주소</label><input id="demo-vault" value={vault} onChange={e=>setVault(e.target.value)}/><button disabled={busy||!/^0x[0-9a-fA-F]{40}$/.test(cash)||!/^0x[0-9a-fA-F]{40}$/.test(vault)} onClick={()=>void register()}>3. 빌드·상품 설정 검증 후 등록</button><p className="hint">배포 거래는 지갑이 서명하고 테스트 ETH 가스비가 발생합니다. 사용자 키를 서버에 저장하지 않습니다.</p></Modal>:null}
  </section>;
}
