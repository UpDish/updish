'use client';

import {useState} from 'react';
import dynamic from 'next/dynamic';
import {useQuery} from '@tanstack/react-query';
import {api} from '../lib/auth';
import {won,type Dashboard,type Performance} from '../lib/workbench';
import {sampleUrl,useDemoSamples} from '../lib/demo-samples';
import type {ChartPoint} from './performance-chart';

const Chart=dynamic(()=>import('./performance-chart'),{ssr:false,loading:()=> <div className="performance-plot chart-loading" role="status">차트를 불러오는 중…</div>});
const metrics=[{id:'sales',label:'월 매출'},{id:'pool',label:'전체 배분금'},{id:'own',label:'내 정산액'}] as const;
type Metric=typeof metrics[number]['id'];
export function PerformancePanel({offeringId,storeName,rateBps,dashboard,onEvidence,referenceOnly=false,compact=false}:{offeringId:string;storeName:string;rateBps:number;dashboard?:Dashboard;onEvidence?:()=>void;referenceOnly?:boolean;compact?:boolean}) {
  const [selected,setSelected]=useState<Metric>('sales');
  const [source,setSource]=useState<'auto'|'samples'|'approved'>('auto');
  const result=useQuery({queryKey:['performance',offeringId],queryFn:()=>api<Performance>('/api/offering/performance'),retry:false});
  const catalog=useDemoSamples();
  const current=result.data?.offeringId===offeringId?result.data:undefined;
  const sampleAllowed=catalog.data?.storeName.startsWith(storeName);
  const samples=source==='samples'||(source==='auto'&&!!current&&current.points.length===0&&sampleAllowed);
  const metric=(samples&&referenceOnly)||(selected==='own'&&(!dashboard||samples))?'sales':selected;
  const label=metrics.find(m=>m.id===metric)!.label;
  const history=catalog.data?.scenarios.filter(s=>s.history).sort((a,b)=>a.period.localeCompare(b.period))??[];
  const points:(ChartPoint&{filename?:string})[]=samples?history.map(s=>{
    const amount=metric==='pool'?(BigInt(s.expectedNetWon)*BigInt(rateBps)/10000n).toString():s.expectedNetWon;
    return {period:s.period,version:null,amount,value:Number(amount),filename:s.filename};
  }):(current?.points??[]).flatMap(point=>{
    const own=dashboard?.settlements.find(s=>s.period===point.period&&s.version===point.version&&s.status==='APPROVED');
    if(metric==='own'&&!own)return [];
    const amount=metric==='sales'?point.netSalesWon:metric==='pool'?point.poolWon:own!.amount_won;
    return [{period:point.period,version:point.version,amount,value:Number(amount)}];
  });
  const safe=points.every(p=>Number.isSafeInteger(p.value));
  const loading=samples?catalog.isPending:result.isPending;
  const error=samples?catalog.error:result.error;
  const availableMetrics=metrics.filter(m=>(!samples||!referenceOnly||m.id==='sales')&&(m.id!=='own'||(dashboard&&!samples)));
  const dataTable=<div className="table-wrap"><table className="performance-table"><caption>{label} · {samples?'가상 CSV 기준':'월별 최신 승인 버전'}</caption><thead><tr><th scope="col">대상 월</th><th scope="col">{samples?'원본 CSV':'승인 버전'}</th><th scope="col">{label}{samples?' 예시':''}</th></tr></thead><tbody>{points.map(p=><tr key={p.period}><th scope="row">{p.period}</th><td>{p.filename?<a href={`/samples/${p.filename}`} download={p.filename}>CSV 다운로드</a>:`v${p.version}`}</td><td>{won(p.amount)}</td></tr>)}</tbody></table></div>;
  return <section aria-label="매출과 정산 차트">
    <div className={compact?'sr-only':'panel-heading'}><h2>{referenceOnly?(samples?'본점의 참고 매출':'2호점 승인 매출·분배'):'매출 · 정산 추이'}</h2><span>{samples?'샘플 CSV · 승인 전':'승인 업무 자료'} · KRW</span></div>
    <div className={compact?'chart-toolbar':'chart-controls'}>
    <div className="chart-source" aria-label="차트 자료 선택"><button aria-pressed={samples} disabled={!sampleAllowed} onClick={()=>setSource('samples')}>{referenceOnly?'본점 참고':'샘플 CSV'}</button><button aria-pressed={!samples} onClick={()=>setSource('approved')}>{referenceOnly?'2호점 승인':'승인 기록'}</button></div>
    <div className="chart-metrics" aria-label="차트 지표">{compact&&availableMetrics.length===1?<span className="chart-current-metric">{label} · KRW</span>:availableMetrics.map(m=><button key={m.id} aria-pressed={metric===m.id} onClick={()=>setSelected(m.id)}>{m.label}</button>)}<button className="chart-refresh" onClick={()=>void (samples?catalog.refetch():result.refetch())} disabled={samples?catalog.isFetching:result.isFetching} aria-label="차트 새로고침">새로고침</button></div>
    </div>
    {samples?<p className="sample-chart-notice"><b>{referenceOnly?'본점의 참고 매출 · 가상 CSV':'성수 모퉁이 가상 매출 6개월'}</b> · {referenceOnly?'2호점의 승인 매출·예상 수익이 아닙니다. 배분 계산에는 별도로 제출·확정한 해당 프로젝트의 월 매출만 사용합니다.':`업무 원장에 승인·지급된 내역이 아닙니다. 전체 배분금은 현재 약정 ${(rateBps/100).toFixed(1)}%를 적용한 예시입니다.`}</p>:null}
    {loading?<div className="chart-empty" role="status">차트 자료를 불러오는 중…</div>:error?<div className="chart-empty" role="alert"><p>차트 자료를 불러오지 못했습니다.</p><button className="secondary" onClick={()=>void (samples?catalog.refetch():result.refetch())}>다시 조회</button></div>:samples&&!sampleAllowed?<div className="chart-empty">이 가게의 샘플 자료가 없습니다.</div>:!samples&&!current?<div className="chart-empty" role="status">시연 상품이 변경됐습니다. 새로고침해 주세요.</div>:points.length?<>
      {safe?<Chart points={points} label={samples?`${label} 예시`:label}/>:<p className="hint">큰 금액의 정확도를 위해 아래 표로 표시합니다.</p>}
      {compact?<details className="chart-data"><summary>월별 금액·원본 자료 보기</summary>{dataTable}</details>:dataTable}
    </>:<div className="chart-empty"><strong>{metric==='own'?'내 승인 정산 내역이 없습니다.':'승인된 정산 자료가 없습니다.'}</strong><p>{metric==='own'?'배정 후 산정·승인된 개인 금액이 표시됩니다.':'매출 자료를 제출하고 검토·정산 승인을 마치면 차트에 표시됩니다.'}</p>{onEvidence?<button className="inline-button" onClick={onEvidence}>매출 자료 관리</button>:null}</div>}
    <p className="chart-footnote">{samples?'샘플은 POS·PG·은행 대조를 검증한 가상 CSV입니다. 아래 파일을 제출하면 별도의 검토·정산·승인 흐름을 점검할 수 있습니다.':'월별 최신 승인 버전만 표시합니다. 정정 승인 시 해당 월을 갱신하며 자료가 없는 월은 채우지 않습니다. 내 정산액은 세전 의무액으로 지급액과 다릅니다.'} 모의 자료 · 실제 현금 지급 없음.</p>
    {catalog.data?<details className="demo-downloads"><summary>흐름 점검용 CSV 4종 내려받기</summary><ul>{catalog.data.scenarios.filter(s=>s.workflow).map(s=><li key={s.id}><a href={sampleUrl(s)} download={s.filename}>{s.label}</a><span>{s.description}</span></li>)}</ul>{onEvidence?<button className="inline-button" onClick={onEvidence}>매출관리에서 샘플 불러오기</button>:null}</details>:catalog.error?<p className="hint">샘플 목록을 불러오지 못했습니다. <button className="inline-button" onClick={()=>void catalog.refetch()}>샘플 다시 조회</button></p>:null}
  </section>;
}
