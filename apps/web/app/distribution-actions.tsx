'use client';
import {useState} from 'react';
import {useConnection} from 'wagmi';
import {command,labels,short,won,type Job,type Line,type Offering,type Settlement} from '../lib/workbench';
import {demoUnits} from '../lib/distributions';
import {useDistributionTransactions} from '../lib/use-distribution-transactions';
import {useDistributions} from './distribution-receipts';
export function DistributionActions({offering:o,settlement:s,lines,onRefresh,onNotice}:{offering:Offering;settlement:Settlement;lines:Line[];onRefresh:()=>Promise<void>;onNotice:(s:string)=>void}){
  const connection=useConnection(),history=useDistributions(connection.address??'');const tx=useDistributionTransactions(o,onRefresh,onNotice);const [preparing,setPreparing]=useState(false);
  const current=history.data?.payments.filter(p=>p.offering_id===o.id&&p.period===s.period)??[];
  const funding=current.find(p=>p.kind==='FUND_DISTRIBUTION'&&p.version===s.version);
  async function request(path:string,existingId?:string){setPreparing(true);try{if(existingId){await tx.check({id:existingId});return;}const job=await command<Job>(path);await tx.send(job);}catch(e){onNotice(e instanceof Error?e.message:'분배 작업을 준비하지 못했습니다.');}finally{setPreparing(false);}}
  return <div className="distribution-actions"><h3>GIWA 테스트 자산 분배</h3><p>세전 의무액과 대응하는 DEMO 수량입니다. 실제 원화는 이동하지 않습니다.</p><div className="actions"><button disabled={preparing||tx.busy||!history.data?.configs.length} onClick={()=>void request(`settlements/${s.id}/fund-distribution`,funding?.tx_hash?funding.id:undefined)}>{funding?.status==='SAFE'?'예치 확인 완료':funding?.tx_hash?'예치 영수증 확인':'DEMO 사용 승인·예치'}</button>{funding?<span className="badge">{labels[funding.status]??funding.status}</span>:null}</div>{history.error?<p className="error">분배 상태를 불러오지 못했습니다.</p>:!history.data?.configs.length?<p className="hint">GIWA 기록의 분배 계약 설정을 먼저 완료해 주세요.</p>:null}
    <div className="table-wrap"><table><thead><tr><th>수신 지갑</th><th>세전 의무액</th><th>확인된 테스트 수령</th><th>실행</th></tr></thead><tbody>{lines.map(l=>{const received=current.filter(p=>p.kind==='PAY_DISTRIBUTION'&&p.address===l.address&&p.status==='SAFE').reduce((n,p)=>n+BigInt(p.amount_units),0n);const pay=current.find(p=>p.line_id===l.id&&p.kind==='PAY_DISTRIBUTION');const synthetic=l.address==='0x000000000000000000000000000000000000b001';return <tr key={l.id}><td className="mono">{short(l.address)}{synthetic?<small className="cell-subtitle">가상 배경 · 송금 제외</small>:null}</td><td>{won(l.amount_won)}</td><td>{demoUnits(received)}</td><td>{synthetic?<span className="muted">체인 미발행</span>:<button className="secondary small" disabled={preparing||tx.busy||funding?.status!=='SAFE'||received>=BigInt(l.amount_won)} onClick={()=>void request(`lines/${l.id}/distribute`,pay?.tx_hash?pay.id:undefined)}>{pay?.tx_hash?'수령 영수증 확인':'지갑으로 DEMO 분배'}</button>}{pay?<span className="badge">{labels[pay.status]??pay.status}</span>:null}</td></tr>;})}</tbody></table></div>
  </div>;
}
