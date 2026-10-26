'use client';

import {useState} from 'react';
import dynamic from 'next/dynamic';
import {useQuery} from '@tanstack/react-query';
import {api} from '../lib/auth';
import {won,type Dashboard,type Performance} from '../lib/workbench';
import type {ChartPoint} from './performance-chart';

const Chart=dynamic(()=>import('./performance-chart'),{ssr:false,loading:()=> <div className="performance-plot chart-loading" role="status">차트를 불러오는 중…</div>});
const metrics=[{id:'sales',label:'월 매출'},{id:'pool',label:'전체 배분금'},{id:'own',label:'내 정산액'}] as const;
type Metric=typeof metrics[number]['id'];
export function PerformancePanel({offeringId,dashboard,onEvidence}:{offeringId:string;dashboard?:Dashboard;onEvidence:()=>void}) {
  const [selected,setSelected]=useState<Metric>('sales');
  const metric=selected==='own'&&!dashboard?'sales':selected;
  const label=metrics.find(m=>m.id===metric)!.label;
  const result=useQuery({queryKey:['performance',offeringId],queryFn:()=>api<Performance>('/api/offering/performance'),retry:false});
  const current=result.data?.offeringId===offeringId?result.data:undefined;
  const points:ChartPoint[]=(current?.points??[]).flatMap(point=>{
    const own=dashboard?.settlements.find(s=>s.period===point.period&&s.version===point.version&&s.status==='APPROVED');
    if(metric==='own'&&!own)return [];
    const amount=metric==='sales'?point.netSalesWon:metric==='pool'?point.poolWon:own!.amount_won;
    return [{period:point.period,version:point.version,amount,value:Number(amount)}];
  });
  const safe=points.every(p=>Number.isSafeInteger(p.value));
  return <section aria-label="승인 매출과 정산 차트">
    <div className="panel-heading"><h2>매출 · 정산 추이</h2><span>승인 자료 · KRW</span></div>
    <div className="chart-metrics" aria-label="차트 지표">{metrics.filter(m=>m.id!=='own'||dashboard).map(m=><button key={m.id} aria-pressed={metric===m.id} onClick={()=>setSelected(m.id)}>{m.label}</button>)}<button className="chart-refresh" onClick={()=>void result.refetch()} disabled={result.isFetching} aria-label="차트 새로고침">새로고침</button></div>
    {result.isPending?<div className="chart-empty" role="status">승인 자료를 불러오는 중…</div>:result.error?<div className="chart-empty" role="alert"><p>차트 자료를 불러오지 못했습니다.</p><button className="secondary" onClick={()=>void result.refetch()}>다시 조회</button></div>:!current?<div className="chart-empty" role="status">시연 상품이 변경됐습니다. 새로고침해 주세요.</div>:points.length?<>
      {safe?<Chart points={points} label={label}/>:<p className="hint">큰 금액의 정확도를 위해 아래 표로 표시합니다.</p>}
      <div className="table-wrap"><table className="performance-table"><caption>{label} · 월별 최신 승인 버전</caption><thead><tr><th scope="col">대상 월</th><th scope="col">승인 버전</th><th scope="col">{label}</th></tr></thead><tbody>{points.map(p=><tr key={p.period}><th scope="row">{p.period}</th><td>v{p.version}</td><td>{won(p.amount)}</td></tr>)}</tbody></table></div>
    </>:<div className="chart-empty"><strong>{metric==='own'?'내 승인 정산 내역이 없습니다.':'승인된 정산 자료가 없습니다.'}</strong><p>{metric==='own'?'배정 후 산정·승인된 개인 금액이 표시됩니다.':'매출 자료를 제출하고 검토·정산 승인을 마치면 차트에 표시됩니다.'}</p><button className="inline-button" onClick={onEvidence}>매출 자료 관리</button></div>}
    <p className="chart-footnote">월별 최신 승인 버전만 표시합니다. 정정 승인 시 해당 월을 갱신하며, 자료가 없는 월은 채우지 않습니다. 내 정산액은 세전 의무액으로 지급액과 다릅니다. 모의 자료 · 실제 현금 지급 없음.</p>
  </section>;
}
