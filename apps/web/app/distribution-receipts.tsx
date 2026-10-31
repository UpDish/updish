'use client';
import {useQuery} from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import {api} from '../lib/auth';
import {labels,short} from '../lib/workbench';
import {demoUnits,type Distributions} from '../lib/distributions';
const Chart=dynamic(()=>import('./performance-chart'),{loading:()=> <p role="status">수령 차트를 불러오는 중…</p>});
export function useDistributions(address:string){return useQuery({queryKey:['distributions',address],queryFn:()=>api<Distributions>('/api/workbench/distributions'),retry:false});}
export function DistributionReceipts({address}:{address:string}){
  const result=useDistributions(address);
  const rows=result.data?.payments.filter(r=>r.kind==='PAY_DISTRIBUTION'&&r.address?.toLowerCase()===address.toLowerCase())??[];
  const safe=rows.filter(r=>r.status==='SAFE');
  const grouped=new Map<string,bigint>();for(const r of safe)grouped.set(r.period,(grouped.get(r.period)??0n)+BigInt(r.amount_units));
  const points=[...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([period,amount])=>({period,version:null,amount:amount.toString(),value:Number(amount)}));
  return <section className="exchange-panel test-receipts"><div className="panel-heading section-padding"><h2>테스트 자산 수령 내역</h2><span className="muted">DEMO · GIWA Sepolia</span></div>
    {result.isPending?<p className="section-padding" role="status">수령 기록을 조회하는 중…</p>:result.error?<div className="section-padding" role="alert"><p>수령 상태를 가져오지 못했습니다.</p><button className="secondary" onClick={()=>void result.refetch()}>수령 내역 다시 조회</button></div>:rows.length?<>
      {points.length?<div className="receipt-chart"><Chart label="월별 테스트 수령" unit="DEMO" points={points}/></div>:null}
      <div className="table-wrap"><table><thead><tr><th>가게 · 기간</th><th className="numeric">테스트 수량</th><th>처리 상태</th><th>거래 확인</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><b>{r.store_name}</b><small className="cell-subtitle">{r.period} · v{r.version}</small></td><td className="numeric">{demoUnits(r.amount_units)}</td><td><span className={`badge ${r.status==='SAFE'?'good':''}`}>{r.status==='SAFE'?'수령 확인':labels[r.status]??r.status}</span></td><td>{r.tx_hash?<a href={`https://sepolia-explorer.giwa.io/tx/${r.tx_hash}`} target="_blank" rel="noreferrer">거래 영수증</a>:<span className="muted">아직 제출 전</span>}</td></tr>)}</tbody></table></div>
      <p className="hint section-padding">수신 지갑 {short(address)} · 원화 계산과 대응하는 시연 수량입니다. 현금·스테이블코인·원화 담보가 아니며 모의 원장 지급과 합산하지 않습니다.</p>
    </>:<div className="empty-state"><h3>아직 테스트 자산 수령 기록이 없습니다</h3><p>배정 수량 발행과 매출 승인이 끝난 뒤 분배합니다. 지갑에 실제 반영된 영수증을 확인해야 수령 완료로 표시합니다.</p></div>}
  </section>;
}
