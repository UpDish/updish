'use client';

import {useState, type FormEvent} from 'react';
import {labels, won, type Dashboard, type Offering} from '../lib/workbench';

type Navigation = {onDetail:()=>void;onPortfolio:()=>void;onEvidence:()=>void};
type ProductProps = {offering:Offering;dashboard?:Dashboard};
export function ProductStatus({status}:{status:string}) {
  return <span className={`badge ${status==='OPEN'?'':status==='REFUNDED'?'bad':'good'}`}>{labels[status]??status}</span>;
}

export function MarketHome({offering:o,dashboard:data,onDetail,onPortfolio,onEvidence}:ProductProps&Navigation) {
  const held=data?.holdings.reduce((sum,h)=>sum+h.units,0);
  return <>
    <section className="market-tiles" aria-label="상품과 나의 투자">
      <button className="market-tile tile-blue" onClick={onDetail}>
        <div><span className="tile-badge">{labels[o.status]??o.status} · 모의 청약</span><h1>{o.store_name}</h1></div>
        <div><strong>전체 매출 배분율 {(o.rate_bps/100).toFixed(1)}%</strong><small>모집금액 {won(BigInt(o.unit_price)*BigInt(o.target_units))} · 총 {o.target_units.toLocaleString()}단위</small></div>
      </button>
      <button className="market-tile tile-red" onClick={onPortfolio}>
        <div><span className="tile-badge">나의 투자</span><h2>보유·정산 내역</h2></div>
        <div><strong>{held===undefined?'내 정산 한눈에':`${held.toLocaleString()}단위 보유`}</strong><small>{data?'개인 명세 · 지급 결과 확인':'지갑 로그인 후 조회할 수 있습니다'}</small></div>
      </button>
      <button className="market-tile tile-pink" onClick={onEvidence}>
        <div><span className="tile-badge">가게 운영자</span><h2>매출 자료 관리</h2></div>
        <div><strong>매출 근거 확인</strong><small>POS · PG · 은행 자료 확인</small></div>
      </button>
    </section>
    {data?<section className="card portfolio-preview">
      <div className="card-title"><h2>내 보유 및 정산 내역</h2><button className="small secondary" onClick={onPortfolio}>전체 내역 보기</button></div>
      <div className="table-wrap"><table><thead><tr><th>보유 상품명</th><th className="numeric">DB 보유</th><th className="numeric">GIWA 확인 보유</th><th>배정 상태</th><th>상세보기</th></tr></thead><tbody><tr><td><b>{o.store_name}</b></td><td className="numeric">{held?.toLocaleString()}단위</td><td className="numeric">{data.holdings.reduce((sum,h)=>sum+h.chain_units,0).toLocaleString()}단위</td><td><ProductStatus status={o.status}/></td><td><button className="small secondary" onClick={onPortfolio}>보유·정산 보기</button></td></tr></tbody></table></div>
    </section>:null}
    <section className="card market-list">
      <div className="card-title"><h2>요식업 매출배분 상품</h2><span className="table-note">가상 매장 1곳 · 모의 투자</span></div>
      <div className="table-wrap"><table><thead><tr><th>가게명</th><th className="numeric">약정 배분율</th><th className="numeric">1단위 금액</th><th className="numeric">모집금액</th><th>상태</th><th>상세보기</th></tr></thead><tbody><tr><td><b>{o.store_name}</b><small className="cell-subtitle">{o.title}</small></td><td className="numeric rate-value">{(o.rate_bps/100).toFixed(1)}%</td><td className="numeric">{won(o.unit_price)}</td><td className="numeric">{won(BigInt(o.unit_price)*BigInt(o.target_units))}</td><td><ProductStatus status={o.status}/></td><td><button className="small secondary" onClick={onDetail}>{o.status==='OPEN'?'청약 신청하기':'상세보기'}</button></td></tr></tbody></table></div>
      <div className="market-facts"><span>접수 수량 <b>{o.accepted_units.toLocaleString()} / {o.target_units.toLocaleString()}단위</b></span><span>계약 기간 <b>{o.months}개월</b></span><span>원금 처리 <b>만기 원금 별도 상환 의무 없음</b></span></div>
      <p className="hint">청약 접수 수량과 보유 수량은 다릅니다. 매출과 정산액은 증빙 검토·승인 후 개인 명세에서 확인합니다.</p>
    </section>
  </>;
}

type DetailProps=ProductProps&{units:number;onUnits:(value:number)=>void;agreements:boolean[];onAgreement:(index:number,checked:boolean)=>void;signed:boolean;pending:boolean;onSubscribe:()=>void;onBack:()=>void;onWallet:()=>void;onPortfolio:()=>void};
export function MarketDetail({offering:o,dashboard:data,units,onUnits,agreements,onAgreement,signed,pending,onSubscribe,onBack,onWallet,onPortfolio}:DetailProps) {
  const [sales,setSales]=useState(30_000_000);
  const valid=Number.isSafeInteger(units)&&units>0&&units<=o.target_units;
  const quantity=valid?BigInt(units):0n;
  const pool=BigInt(sales)*BigInt(o.rate_bps)/10_000n;
  const monthly=pool*quantity/BigInt(o.target_units);
  const total=monthly*BigInt(o.months);
  const principal=quantity*BigInt(o.unit_price);
  const steps=['지갑 로그인','청약 접수','배정 대기','배정 완료'];
  const step=data?.holdings.length?3:data?.subscriptions.some(s=>s.status==='ACCEPTED')?2:signed?1:0;
  function submit(event:FormEvent) {event.preventDefault();if(valid)onSubscribe();}
  return <>
    <button className="back-button" onClick={onBack}>목록으로 돌아가기</button>
    <div className="product-detail-grid">
      <div className="detail-information">
        <section className="card contract-card">
          <div className="card-title"><h1>{o.store_name}</h1><ProductStatus status={o.status}/></div>
          <p className="detail-description">{o.title} · 계약 v{o.contract_version}. 아래 월 매출·분배금은 수령액 계산을 위한 가정입니다.</p>
          <table className="key-value-table"><tbody>
            <tr><th>약정 전체 매출 배분율</th><td className="rate-value">{(o.rate_bps/100).toFixed(1)}%</td></tr>
            <tr><th>월 예시 정산대상 매출</th><td>{won(sales)}</td></tr>
            <tr><th>월 전체 세전 배분금 (예시)</th><td className="blue-value">{won(pool)}</td></tr>
            <tr><th>계약 배분 기간</th><td>{o.months}개월 <span className="muted">· 만기 원금 별도 상환 의무 없음</span></td></tr>
          </tbody></table>
        </section>
        <section className="card calculator-card">
          <div className="card-title"><h2>선택 매장 맞춤 수령액 계산기</h2><span className="badge">가정 계산</span></div>
          <p className="hint">월 매출이 같은 수준으로 유지된다는 예시입니다. 승인된 정산액이나 보장 수익이 아니며 세금·수수료를 반영하지 않습니다.</p>
          <label htmlFor="quantity-range">보유 수량 선택: <b>{valid?units.toLocaleString():'수량 확인'}단위</b> <span className="muted">({won(principal)} 가정)</span></label>
          <input id="quantity-range" type="range" min={1} max={o.target_units} value={valid?units:1} onChange={e=>onUnits(Number(e.target.value))}/>
          <table className="key-value-table"><tbody><tr><th>개인 월 세전 분배금</th><td>{won(monthly)}</td></tr><tr><th>{o.months}개월 단순 누적 수령액</th><td className="rate-value">{won(total)}</td></tr><tr><th>모의 청약 금액 대비 차액</th><td className={total-principal>=0?'rate-value':'blue-value'}>{total-principal>0?'+':''}{won(total-principal)}</td></tr></tbody></table>
          <p className="hint">개인 금액은 이해를 위한 원 단위 절사 예시입니다. 실제 모의 정산은 전체 보유를 기준으로 잔여 원까지 배분하므로 예시와 1원 차이가 날 수 있습니다.</p>
        </section>
        <section className="card cash-risk-card">
          <div className="card-title"><h2>매출 하락 시 지급 여력</h2><span className="table-note">예시 가정</span></div>
          <p className="hint">변동비 55%·고정비 월 1,050만원 가정. 분배 의무와 지급 가능액은 다릅니다.</p>
          <div className="cash-scenarios" aria-label="예시 매출 선택">{[30_000_000,24_000_000,18_000_000].map(value=>{const balance=BigInt(value)*4500n/10000n-10500000n-BigInt(value)*BigInt(o.rate_bps)/10000n;return <button key={value} aria-pressed={sales===value} className={sales===value?'selected':''} onClick={()=>setSales(value)}><small>월 매출 {(value/10000).toLocaleString()}만원</small><b className={balance<0?'rate-value':'success'}>{balance>=0?'+':''}{won(balance)}</b><span className={`badge ${balance<0?'bad':'good'}`}>{balance<0?'현금 부족':'분배 후 잔여'}</span></button>;})}</div>
        </section>
      </div>
      <aside className="subscription-column"><section className="card subscription-card">
        <div className="card-title"><h2>청약 신청 영역</h2><span className="table-note">모의 투자</span></div>
        <ol className="subscription-steps">{steps.map((label,index)=><li key={label} className={index<step?'completed':index===step?'current':''} aria-current={index===step?'step':undefined}><span>{index+1}</span><small>{label}</small></li>)}</ol>
        <form onSubmit={submit}>
          <label htmlFor="units">신청 수량 <span className="muted">(1단위 {won(o.unit_price)})</span></label><input id="units" type="number" min={1} max={o.target_units} value={Number.isFinite(units)?units:''} onChange={e=>onUnits(Number(e.target.value))}/>
          {!valid?<p className="error">1~{o.target_units.toLocaleString()} 사이의 정수 수량을 입력해 주세요.</p>:null}
          <div className="subscription-total"><span>모의 청약 금액</span><b>{won(principal)}</b></div>
          <div className="agreement-box">{['원금 별도 상환 의무가 없음을 이해했습니다.','매출 감소와 지급 실패로 손실이 생길 수 있음을 이해했습니다.','실제 자금이 이동하지 않는 모의 청약임을 확인했습니다.'].map((label,index)=><label className="check-row" key={label}><input type="checkbox" checked={agreements[index]} onChange={e=>onAgreement(index,e.target.checked)}/><span>{label}</span></label>)}</div>
          <button className="full" type="submit" disabled={!signed||!agreements.every(Boolean)||!valid||o.status!=='OPEN'||pending}>{pending?'청약 접수 중…':o.status==='OPEN'?'모의 청약 신청하기':labels[o.status]}</button>
        </form>
        {!signed?<button className="full secondary" onClick={onWallet}>지갑 연결 · 로그인</button>:<button className="text-button" onClick={onPortfolio}>내 청약·배정 상태 보기</button>}
        <p className="hint">신규 참여 시 서버가 TESTNET FAUCET Dojang을 확인합니다. <button className="inline-button" onClick={onWallet}>내 자격 확인</button></p>
        <div className="investment-notice"><b>투자 전 필수 주의사항</b><p>만기 원금을 별도로 상환하지 않습니다. 매출 감소·현금 부족으로 손실이 생길 수 있고 중도 이전은 제한됩니다.</p><p>이 화면은 해커톤 시연이며 실제 투자금 수취·현금 지급을 수행하지 않습니다.</p></div>
      </section><section className="card compact-card"><div className="card-title"><h2>모집 현황</h2><ProductStatus status={o.status}/></div><div className="section-row"><span>접수 수량</span><b>{o.accepted_units.toLocaleString()} / {o.target_units.toLocaleString()}단위</b></div><progress value={o.accepted_units} max={o.target_units} aria-label="모집 접수 수량"/><p className="hint">접수 순서대로 배정하며 마지막 초과 청약은 부분 배정 후 미배정분을 모의 환불합니다.</p></section></aside>
    </div>
  </>;
}
