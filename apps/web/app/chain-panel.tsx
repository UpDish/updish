'use client';
import {useEffect,useState} from 'react';
import {usePublicClient,useWalletClient,useConnection} from 'wagmi';
import type {Abi,Address,Hex} from 'viem';
import {giwaSepolia,dojang} from '../../../packages/chain-config/giwa';
import builds from '../lib/contract-build.json';
import {Modal} from './modal';
import {command,labels,short,type Job,type Offering} from '../lib/workbench';
import {DistributionSettings} from './distribution-settings';
import {useDistributionTransactions} from '../lib/use-distribution-transactions';

type Props={offering:Offering;jobs:Job[];contracts:{units_address:string;registry_address:string}[];onRefresh:()=>Promise<void>;onNotice:(message:string)=>void};
export function ChainPanel({offering:o,jobs,contracts,onRefresh,onNotice}:Props) {
  const [settings,setSettings]=useState(false);
  const wallet=useConnection();const {data:client}=useWalletClient();const publicClient=usePublicClient({chainId:91342});
  const [unitsAddress,setUnitsAddress]=useState('');const [registryAddress,setRegistryAddress]=useState('');const [busy,setBusy]=useState('');const [pending,setPending]=useState<Record<string,string>>({});
  const [deploymentHashes,setDeploymentHashes]=useState<{units?:string;registry?:string}>({});
  const distributionTx=useDistributionTransactions(o,onRefresh,onNotice);
  const storageKey=`updish.deployment.v1.${o.id}`;
  useEffect(()=>{
    try {const saved=JSON.parse(localStorage.getItem(storageKey)??'{}');setUnitsAddress(contracts[0]?.units_address??saved.units??'');setRegistryAddress(contracts[0]?.registry_address??saved.registry??'');setPending(JSON.parse(localStorage.getItem(`updish.jobs.v1.${o.run_id}`)??'{}'));setDeploymentHashes({units:localStorage.getItem(`${storageKey}.units.transaction`)??undefined,registry:localStorage.getItem(`${storageKey}.registry.transaction`)??undefined});} catch {onNotice('이전 거래 정보를 읽지 못했습니다. 탐색기에서 거래를 확인해 주세요.');}
  },[storageKey,o.run_id,contracts,onNotice]);
  function saveAddresses(units:string,registry:string) {localStorage.setItem(storageKey,JSON.stringify({units,registry}));}
  async function deploy(kind:'units'|'registry') {
    if(!client||!wallet.address||wallet.chainId!==91342||!publicClient) return;
    setBusy(kind);onNotice(kind==='units'?'지갑에서 보유 수량 계약 배포를 확인해 주세요. 전송 ETH는 0이며 테스트 ETH 가스비가 발생합니다.':'지갑에서 정산 기록 계약 배포를 확인해 주세요. 전송 ETH는 0이며 테스트 ETH 가스비가 발생합니다.');
    try {
      const build=kind==='units'?builds.UpDishDemoUnits:builds.SettlementRegistry;
      const args=kind==='units'?[wallet.address,dojang.scroll,dojang.faucetAttester,BigInt(o.token_id),BigInt(o.target_units)]:[wallet.address];
      const hash=await client.deployContract({abi:build.abi as Abi,bytecode:build.bytecode as Hex,args,account:wallet.address,chain:giwaSepolia});
      localStorage.setItem(`${storageKey}.${kind}.transaction`,hash);setDeploymentHashes(previous=>({...previous,[kind]:hash}));onNotice(`배포 거래를 제출했습니다: ${hash}. 응답 지연 시 다시 배포하지 말고 거래를 확인해 주세요.`);
      const receipt=await publicClient.waitForTransactionReceipt({hash,timeout:120_000});
      if(receipt.status!=='success'||!receipt.contractAddress) throw new Error('배포 거래가 성공하지 않았습니다.');
      if(kind==='units') {setUnitsAddress(receipt.contractAddress);saveAddresses(receipt.contractAddress,registryAddress);} else {setRegistryAddress(receipt.contractAddress);saveAddresses(unitsAddress,receipt.contractAddress);}
      onNotice('배포가 블록에 포함됐습니다. 두 계약 주소를 서버에 등록해 검증해 주세요.');
    } catch(error) {onNotice(error instanceof Error?error.message.split('\n')[0]:'배포 상태를 확인하지 못했습니다.');}
    finally {setBusy('');}
  }
  async function recover(kind:'units'|'registry') {
    const hash=localStorage.getItem(`${storageKey}.${kind}.transaction`) as Hex|null;if(!hash||!publicClient) {onNotice('복구할 배포 거래 해시가 없습니다.');return;}
    setBusy('recover');try {const receipt=await publicClient.getTransactionReceipt({hash});if(receipt.status!=='success'||!receipt.contractAddress) throw new Error('배포 성공 영수증이 없습니다.');if(kind==='units'){setUnitsAddress(receipt.contractAddress);saveAddresses(receipt.contractAddress,registryAddress);}else{setRegistryAddress(receipt.contractAddress);saveAddresses(unitsAddress,receipt.contractAddress);}onNotice('기존 배포 거래에서 주소를 복구했습니다.');}catch(e){onNotice(e instanceof Error?e.message.split('\n')[0]:'배포 복구 실패');}finally{setBusy('');}
  }
  async function register() {setBusy('register');try {await command('contracts',{unitsAddress,registryAddress});await onRefresh();onNotice('서버가 빌드 코드·소유자·Dojang·상품 설정을 검증했습니다.');}catch(e){onNotice(e instanceof Error?e.message:'계약 등록 실패');}finally{setBusy('');}}
  async function send(job:Job) {
    if(['FUND_DISTRIBUTION','PAY_DISTRIBUTION'].includes(job.kind)){await distributionTx.send(job);return;}
    if(!client||!wallet.address||wallet.chainId!==91342) return;setBusy(job.id);
    try {
      const saved=JSON.parse(localStorage.getItem(`updish.jobs.v1.${o.run_id}`)??'{}') as Record<string,Hex>;
      let hash=job.tx_hash??saved[job.id];
      if(!hash) {
        const prepared=await command<Job>(`jobs/${job.id}/prepare`);
        if(prepared.tx_hash) hash=prepared.tx_hash;
        else {if(prepared.status!=='AWAITING_SIGNATURE'||!prepared.target||!prepared.calldata) throw new Error('계약 주소를 먼저 등록해 주세요.');
          onNotice(job.kind==='MINT'?'지갑에서 배정된 보유 수량 발행을 확인해 주세요. 전송 ETH는 0이며 테스트 ETH 가스비가 발생합니다.':'지갑에서 승인 매출 기록을 확인해 주세요. 전송 ETH는 0이며 테스트 ETH 가스비가 발생합니다.');
          hash=await client.sendTransaction({to:prepared.target as Address,data:prepared.calldata,account:wallet.address,chain:giwaSepolia,value:0n});
          saved[job.id]=hash;localStorage.setItem(`updish.jobs.v1.${o.run_id}`,JSON.stringify(saved));setPending(saved);
        }
      }
      await command(`jobs/${job.id}/transaction`,{hash});await onRefresh();onNotice('거래 해시를 연결했습니다. safe 반영은 별도로 확인해 주세요.');
    }catch(e){onNotice(e instanceof Error?e.message.split('\n')[0]:'거래 제출 상태를 확인하지 못했습니다.');}finally{setBusy('');}
  }
  async function check(job:Job,retry=false) {setBusy(job.id);try {await command(`jobs/${job.id}/${retry?'retry':'check'}`);if(retry){const saved={...pending};delete saved[job.id];localStorage.setItem(`updish.jobs.v1.${o.run_id}`,JSON.stringify(saved));setPending(saved);}await onRefresh();onNotice(retry?'실패 영수증이 확인된 작업을 재시도 상태로 바꿨습니다.':'체인 영수증과 상태를 다시 확인했습니다.');}catch(e){onNotice(e instanceof Error?e.message:'체인 확인 실패');}finally{setBusy('');}}
  return <section className="card"><span className="eyebrow">GIWA TESTNET TRANSACTIONS</span><h2>계약 배포와 온체인 반영</h2><p>지갑이 직접 테스트 거래를 서명합니다. 사용자 개인 키를 서버로 보내지 않습니다. 가상 배경 보유는 실제 mint 작업에서 제외됩니다.</p>
    <div className="actions"><span className="badge">{contracts.length?'계약 등록됨':'계약 등록 필요'}</span><button className="secondary small" onClick={()=>setSettings(true)}>계약 설정</button></div>
    {settings?<Modal title="GIWA 계약 설정" wide busy={!!busy} onClose={()=>setSettings(false)}>    <div className="actions"><button className="small" disabled={!!busy} onClick={()=>void deploy('units')}>이 상품의 토큰 계약 배포</button><button className="small secondary" disabled={!!busy} onClick={()=>void recover('units')}>토큰 배포 영수증 복구</button><button className="small" disabled={!!busy} onClick={()=>void deploy('registry')}>정산 기록 계약 배포</button><button className="small secondary" disabled={!!busy} onClick={()=>void recover('registry')}>기록 계약 영수증 복구</button></div>
    <label htmlFor="units-contract">토큰 계약 주소</label><input id="units-contract" value={unitsAddress} onChange={e=>setUnitsAddress(e.target.value)} placeholder="0x…"/><label htmlFor="registry-contract">정산 기록 계약 주소</label><input id="registry-contract" value={registryAddress} onChange={e=>setRegistryAddress(e.target.value)} placeholder="0x…"/><button className="small secondary" disabled={!!busy||!/^0x[0-9a-fA-F]{40}$/.test(unitsAddress)||!/^0x[0-9a-fA-F]{40}$/.test(registryAddress)} onClick={()=>void register()}>두 계약을 서버에서 검증 · 등록</button>
    <div className="actions">{deploymentHashes.units?<a href={`https://sepolia-explorer.giwa.io/tx/${deploymentHashes.units}`} target="_blank" rel="noreferrer">수량 계약 배포 영수증 ↗</a>:null}{deploymentHashes.registry?<a href={`https://sepolia-explorer.giwa.io/tx/${deploymentHashes.registry}`} target="_blank" rel="noreferrer">정산 기록 배포 영수증 ↗</a>:null}</div>
    <p className="hint">배포 응답이 지연되면 복구 버튼을 사용하세요. 거래 해시와 배포 주소만 이 브라우저에 보관합니다. 새 시연은 새 상품 ID이므로 토큰 계약도 새 상품에 맞아야 합니다.</p>
</Modal>:null}
    <DistributionSettings offering={o} contracts={contracts} onRefresh={onRefresh} onNotice={onNotice}/>
    <div className="table-wrap"><table><thead><tr><th>작업</th><th>상태</th><th>거래</th><th>실행</th></tr></thead><tbody>{jobs.map(job=><tr key={job.id}><td>{labels[job.kind]??job.kind} · {short(job.reference_id)}</td><td><span className="badge">{job.status==='NEEDS_CONFIG'&&contracts.length?'거래 준비 가능':labels[job.status]??job.status}</span>{job.error_code?<small className="error" title={job.error_code}> {job.error_code==='RPC_EMPTY_RESULT_ETH_GETBLOCKBYNUMBER'?'노드의 블록 조회 대기 · 영수증 다시 확인':job.error_code}</small>:null}</td><td>{job.tx_hash||pending[job.id]?<a href={`https://sepolia-explorer.giwa.io/tx/${job.tx_hash??pending[job.id]}`} target="_blank" rel="noreferrer">Explorer ↗</a>:'제출 전'}</td><td><div className="actions">{!job.tx_hash?<button className="small" disabled={!!busy||distributionTx.busy||job.status==='FAILED'} onClick={()=>void send(job)}>{pending[job.id]?'제출 해시 복구':'지갑으로 거래 제출'}</button>:<button className="small secondary" disabled={!!busy||distributionTx.busy} onClick={()=>void check(job)}>영수증 · safe 대조</button>}{job.status==='FAILED'?<button className="small secondary" disabled={!!busy||distributionTx.busy} onClick={()=>void check(job,true)}>실패 거래 재시도 준비</button>:null}</div></td></tr>)}</tbody></table></div>
    {!jobs.length?<p className="empty-text">배정 확정 또는 정산 승인 후 거래 작업이 생성됩니다.</p>:null}<p className="hint">제출된 거래의 safe 상태를 자동 확인합니다. 블록 포함과 safe 확인을 구분하며, 확인 중에는 같은 거래를 다시 보내지 않습니다.</p>
  </section>;
}
