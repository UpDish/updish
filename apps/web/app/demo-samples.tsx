'use client';
import {useState} from 'react';
import {useDemoSamples,sampleUrl,type DemoScenario} from '../lib/demo-samples';
import {won} from '../lib/workbench';

export function DemoSamples({onLoad,startsOn,presentation=false}:{onLoad:(scenario:DemoScenario)=>void;startsOn:string;presentation?:boolean}){
  const catalog=useDemoSamples();
  const [month,setMonth]=useState('normal');
  const selected=catalog.data?.scenarios.find(s=>s.id===month);
  return <div className="demo-samples">
    <div className="panel-heading"><h3>{presentation?'2호점 가상 매출 CSV':'흐름 점검용 샘플 CSV'}</h3><span className="badge">가상 자료</span></div>
    <p className="hint">샘플을 불러온 뒤 내용을 확인하고 제출합니다. 제출 → 다른 검토 지갑 마감 → 산정 → 별도 지갑 승인을 순서대로 진행해 주세요.</p>
    {catalog.isPending?<p role="status">샘플 목록을 불러오는 중…</p>:catalog.error?<p role="alert">샘플 목록을 불러오지 못했습니다. <button className="inline-button" onClick={()=>void catalog.refetch()}>다시 조회</button></p>:<>
      <div className="demo-case-grid">{catalog.data?.scenarios.filter(s=>s.workflow).map(s=><article key={s.id}><button className="secondary small" onClick={()=>onLoad(s)}>{s.label}</button><p>{s.period} · 예상 매출 {won(s.expectedNetWon)}</p><p>{presentation&&s.id==='cash-shortage'?'매출 2,400만원 × 10% = 분배 의무 240만원, 모형 현금 여력 30만원으로 추가 예치를 차단합니다.':s.description}</p><a href={presentation?`/samples/presentation-v03/${s.filename}`:sampleUrl(s)} download={s.filename}>CSV 다운로드</a></article>)}</div>
      {!presentation?<><div className="demo-month-loader"><label htmlFor="demo-month">월별 매출 샘플</label><select id="demo-month" value={month} onChange={event=>setMonth(event.target.value)}>{catalog.data?.scenarios.filter(s=>s.history).sort((a,b)=>a.period.localeCompare(b.period)).map(s=><option key={s.id} value={s.id}>{s.period} · {won(s.expectedNetWon)}</option>)}</select><button className="small secondary" disabled={!selected} onClick={()=>{if(selected)onLoad(selected);}}>선택 월 CSV 불러오기</button></div>{selected&&selected.period<startsOn.slice(0,7)?<p className="hint">선택한 월은 계약 시작 전의 참고 매출입니다. CSV 대조는 할 수 있지만 이 계약의 정산으로 산정할 수 없습니다.</p>:null}</>:<p className="hint">본점의 과거 월별 자료는 가게 상세에서 참고용으로 조회합니다. 이곳은 2호점 영업을 가정한 정산 시연 자료입니다.</p>}
    </>}
  </div>;
}
