'use client';

import {useState, type FormEvent, type KeyboardEvent} from 'react';
import {labels, won, type Dashboard, type Offering} from '../lib/workbench';
import {PerformancePanel} from './performance-panel';

type MarketProps = {
  customer?:boolean;
  offering: Offering; dashboard?: Dashboard; units: number;
  onUnits: (value:number)=>void; agreements:boolean[];
  onAgreement:(index:number,checked:boolean)=>void;
  signed:boolean; pending:boolean; onSubscribe:()=>void;
  onWallet:()=>void; onPortfolio:()=>void; onEvidence:()=>void;
};
const views=[{id:'performance',label:'매출 차트'},{id:'overview',label:'상품 정보'},{id:'calculator',label:'수령액 계산'},{id:'risk',label:'위험 안내'}] as const;
type View=typeof views[number]['id'];

export function ProductStatus({status}:{status:string}) {
  const tone=status==='REFUNDED'?'bad':status==='FUNDED'?'good':'';
  return <span className={`badge ${tone}`}>{labels[status]??status}</span>;
}

export function MarketHome({offering:o,dashboard:data,customer=false,units,onUnits,agreements,onAgreement,signed,pending,onSubscribe,onWallet,onPortfolio,onEvidence}:MarketProps) {
  const [view,setView]=useState<View>('performance');
  const [sales,setSales]=useState(30_000_000);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const valid=Number.isSafeInteger(units)&&units>0&&units<=o.target_units;
  const quantity=valid?BigInt(units):0n;
  const principal=quantity*BigInt(o.unit_price);
  const pool=BigInt(sales)*BigInt(o.rate_bps)/10_000n;
  const monthly=pool*quantity/BigInt(o.target_units);
  const progress=Math.min(100,Math.round(o.accepted_units/o.target_units*1000)/10);
  const held=data?.holdings.reduce((sum,h)=>sum+h.units,0);
  const visible=`${o.store_name} ${o.title}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())&&(filter==='all'||(filter==='open')===(o.status==='OPEN'));
  const blocked=!signed||!agreements.every(Boolean)||!valid||o.status!=='OPEN'||pending;
  const step=data?.holdings.length?3:data?.subscriptions.some(s=>s.status==='ACCEPTED')?2:signed?1:0;
  const steps=['지갑 로그인','청약 접수','배정 대기','배정 완료'];
  function submit(event:FormEvent) {event.preventDefault();if(!blocked)onSubscribe();}
  function moveTab(event:KeyboardEvent<HTMLButtonElement>,index:number) {
    const next=event.key==='ArrowRight'?(index+1)%views.length:event.key==='ArrowLeft'?(index+views.length-1)%views.length:event.key==='Home'?0:event.key==='End'?views.length-1:-1;
    if(next<0)return;
    event.preventDefault();setView(views[next].id);document.getElementById(`product-tab-${views[next].id}`)?.focus();
  }
  return <div className="exchange-layout">
    <div className="exchange-main">
      <section className="exchange-panel instrument-panel" aria-labelledby="instrument-name">
        <div className="instrument-title"><div><h1 id="instrument-name">{o.store_name}</h1><span>{o.title}</span></div><ProductStatus status={o.status}/></div>
        <div className="instrument-summary">
          <div className="unit-quote"><span>1단위 청약 금액</span><strong>{BigInt(o.unit_price).toLocaleString('ko-KR')}<small>KRW</small></strong><p>음식점 매출배분 · 모의 청약</p></div>
          <dl className="quote-facts"><div><dt>전체 매출 배분율</dt><dd>{(o.rate_bps/100).toFixed(1)}<small>%</small></dd></div><div><dt>배분 기간</dt><dd>{o.months}<small>개월</small></dd></div><div><dt>모집 금액</dt><dd>{won(BigInt(o.unit_price)*BigInt(o.target_units))}</dd></div><div><dt>모집 수량</dt><dd>{o.target_units.toLocaleString()}<small>단위</small></dd></div></dl>
        </div>
        <div className="instrument-foot"><span>접수 <b>{o.accepted_units.toLocaleString()}단위</b></span><span>계약 v{o.contract_version}</span><span>만기 원금 별도 상환 의무 없음</span><a className="mobile-order-link" href="#subscription-title">청약 입력</a></div>
      </section>
      <section className="exchange-panel information-panel">
        <div className="exchange-tabs" role="tablist" aria-label="상품 상세 정보">{views.map((item,index)=><button key={item.id} id={`product-tab-${item.id}`} role="tab" aria-selected={view===item.id} aria-controls="product-panel" tabIndex={view===item.id?0:-1} onClick={()=>setView(item.id)} onKeyDown={event=>moveTab(event,index)}>{item.label}</button>)}</div>
        <div id="product-panel" role="tabpanel" aria-labelledby={`product-tab-${view}`} className="information-content" tabIndex={0}>
          {view==='performance'?<PerformancePanel key={o.id} offeringId={o.id} storeName={o.store_name} rateBps={o.rate_bps} dashboard={data} onEvidence={onEvidence}/>:null}
          {view==='overview'?<><div className="panel-heading"><h2>계약 주요 조건</h2><span>계약 기준 · 수익 보장 없음</span></div>
            <table className="terms-table"><tbody><tr><th scope="row">배분 기준</th><td>검토·승인된 월 정산대상 매출</td></tr><tr><th scope="row">약정 배분율</th><td>전체 매출의 {(o.rate_bps/100).toFixed(1)}%</td></tr><tr><th scope="row">배분 기간</th><td>{o.months}개월</td></tr><tr><th scope="row">참여 단위</th><td>1단위 · {won(o.unit_price)}</td></tr><tr><th scope="row">배정 방식</th><td>접수 순서로 배정 · 마지막 초과분은 부분 배정 및 모의 환불</td></tr><tr><th scope="row">원금 처리</th><td>만기 원금을 별도로 상환할 의무가 없습니다.</td></tr></tbody></table>
            <div className="information-note"><b>매출과 정산액은 어디에서 확인하나요?</b><p>가게의 POS·PG·은행 자료를 대조·승인한 뒤, 보유 수량을 기준으로 산정합니다. 본인의 승인된 정산액은 투자내역에서 확인할 수 있습니다.</p><button className="inline-button" onClick={onPortfolio}>내 정산 내역 보기</button></div>
          </>:null}
          {view==='calculator'?<><div className="panel-heading"><h2>월 수령액 계산</h2><span className="badge">예시 계산</span></div><p className="hint">아래 매출은 가정입니다. 승인된 매출·정산액이나 보장 수익이 아니며 세금·수수료를 반영하지 않습니다.</p>
            <div className="scenario-selector" aria-label="예시 월 매출">{[30_000_000,24_000_000,18_000_000].map(value=><button key={value} className={sales===value?'selected':''} aria-pressed={sales===value} onClick={()=>setSales(value)}>{(value/10000).toLocaleString()}만원</button>)}</div>
            <label htmlFor="quantity-range">계산 수량 <b>{valid?units.toLocaleString():'수량 확인'}단위</b></label><input id="quantity-range" type="range" min={1} max={o.target_units} value={valid?units:1} onChange={event=>onUnits(Number(event.target.value))}/>
            <dl className="calculation-results" aria-live="polite"><div><dt>예시 월 전체 배분금</dt><dd>{won(pool)}</dd></div><div><dt>내 월 세전 분배금</dt><dd>{won(monthly)}</dd></div></dl><p className="hint">월 예시 매출 × 배분율 × 선택 수량 ÷ 전체 {o.target_units.toLocaleString()}단위. 실제 모의 정산은 잔여 원을 배분하므로 1원 차이가 날 수 있습니다.</p>
          </>:null}
          {view==='risk'?<><div className="panel-heading"><h2>청약 전 확인할 위험</h2><span className="table-note">손실 가능</span></div><ul className="risk-list"><li><b>원금 별도 상환 없음</b><p>계약 만기 원금을 별도로 돌려주는 구조가 아닙니다.</p></li><li><b>매출 감소·지급 실패</b><p>매출이 줄거나 현금이 부족하면 실제 지급액이 줄고 손실이 생길 수 있습니다.</p></li><li><b>중도 이전 제한</b><p>즉시 매도하거나 현금화하는 거래 시장을 제공하지 않습니다.</p></li></ul><p className="hint">TESTNET FAUCET Dojang은 이 시연의 참여 자격 확인용이며 업비트 실명 인증이 아닙니다.</p></>:null}
        </div>
      </section>
      <section className="exchange-panel collection-panel"><div className="panel-heading"><h2>모집 현황</h2><span>접수와 보유는 다릅니다</span></div><div className="collection-summary"><strong>{o.accepted_units.toLocaleString()}<small> / {o.target_units.toLocaleString()}단위</small></strong><span>{progress}% 접수</span></div><progress value={o.accepted_units} max={o.target_units} aria-label="모집 접수 수량"/><div className="collection-meta"><span>모집 목표 <b>{won(BigInt(o.unit_price)*BigInt(o.target_units))}</b></span><span>실제 현금 이동 없음</span></div></section>
    </div>
    <aside className="exchange-side" aria-label="상품 목록과 청약">
      <section className="exchange-panel market-directory">
        <label className="market-search" htmlFor="market-search">상품 검색<input id="market-search" type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="가게명 / 상품명 검색"/></label>
        <div className="directory-filters" aria-label="상품 상태 필터">{[['all','전체'],['open','모집 중'],['closed','모집 종료']].map(([value,label])=><button key={value} className={filter===value?'active':''} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div><div className="directory-labels"><span>상품명</span><span>1단위 금액</span></div>
        {visible?<button className="directory-product" aria-label={`${o.store_name} 상품 정보 보기`} onClick={()=>setView('overview')}><span><b>{o.store_name}</b><small>{labels[o.status]??o.status} · 매출배분 {(o.rate_bps/100).toFixed(1)}%</small></span><strong>{won(o.unit_price)}</strong></button>:<p className="directory-empty" role="status">조건에 맞는 상품이 없습니다.</p>}<p className="directory-count">가상 상품 1개 · 해커톤 시연</p>
      </section>
      {customer?<section className="exchange-panel customer-guide"><div className="panel-heading"><h2>가게 공개 정보</h2></div><p>가게의 계약 조건과 승인된 월 매출·배분금을 확인할 수 있습니다.</p><p className="hint">해커톤의 고객 관점 안내 화면입니다. 음식 주문·결제 기능은 제공하지 않습니다.</p><button className="full" onClick={onWallet}>투자자 화면에서 참여 안내 보기</button></section>:<><section className="exchange-panel subscription-card" aria-labelledby="subscription-title">
        <div className="order-heading"><h2 id="subscription-title">모의 청약</h2><button onClick={onPortfolio}>내 청약내역</button></div><ol className="order-steps">{steps.map((label,index)=><li key={label} className={index===step?'current':index<step?'completed':''} aria-current={index===step?'step':undefined}>{index+1}. {label}</li>)}</ol>
        <form onSubmit={submit}><div className="order-price"><span>1단위 금액</span><b>{won(o.unit_price)}</b></div><label htmlFor="units">청약 수량 <span>단위</span></label><input id="units" type="number" min={1} max={o.target_units} step={1} value={Number.isFinite(units)?units:''} aria-invalid={!valid} aria-describedby={!valid?'units-error':undefined} onChange={event=>onUnits(Number(event.target.value))}/>
          <div className="quantity-presets" aria-label="수량 빠른 입력">{[10,50,100,200].filter(value=>value<=o.target_units).map(value=><button key={value} type="button" aria-pressed={units===value} onClick={()=>onUnits(value)}>{value}단위</button>)}</div>{!valid?<p id="units-error" className="error" role="alert">1~{o.target_units.toLocaleString()} 사이의 정수를 입력해 주세요.</p>:null}<div className="subscription-total" aria-live="polite"><span>모의 청약 총액</span><b>{won(principal)}</b></div>
          <details className="agreement-details"><summary>청약 전 필수 확인 <span>{agreements.filter(Boolean).length}/3</span></summary><div className="agreement-box">{['원금 별도 상환 의무가 없음을 이해했습니다.','매출 감소와 지급 실패로 손실이 생길 수 있음을 이해했습니다.','실제 자금이 이동하지 않는 모의 청약임을 확인했습니다.'].map((label,index)=><label className="check-row" key={label}><input type="checkbox" checked={agreements[index]} onChange={event=>onAgreement(index,event.target.checked)}/><span>{label}</span></label>)}</div></details>
          {signed?<><button className="full" type="submit" disabled={blocked}>{pending?'청약 접수 중…':o.status==='OPEN'?'모의 청약 신청':labels[o.status]??o.status}</button><p className="order-help">{o.status!=='OPEN'?'현재 상품은 청약 접수가 종료됐습니다.':!valid?'유효한 청약 수량을 입력해 주세요.':!agreements.every(Boolean)?'필수 확인 3개 항목에 동의하면 신청할 수 있습니다.':'신규 참여 시 서버가 Dojang 자격을 확인합니다.'}</p></>:<><button className="full" type="button" onClick={onWallet}>지갑 연결하고 로그인</button><p className="order-help">로그인 후 모의 청약할 수 있습니다. 로그인 서명에는 가스비가 없습니다.</p></>}
        </form>
      </section>
      <section className="exchange-panel my-account-panel"><div className="panel-heading"><h2>내 투자</h2><button className="inline-button" onClick={onPortfolio}>전체 내역</button></div><div className="account-holding"><span>배정 확정 수량</span><b>{held===undefined?'로그인 필요':`${held.toLocaleString()}단위`}</b></div><button className="workspace-link" onClick={onEvidence}>가게 매출 자료 관리</button></section></>}
    </aside>
  </div>;
}
