'use client';

import {useQuery} from '@tanstack/react-query';
import {useEffect,useRef} from 'react';
import {api} from '../lib/auth';
import {labels,won,type Statement} from '../lib/workbench';
const paymentLabels:Record<string,string>={FAILED:'실패',SIMULATED_SUCCESS:'모의 성공',SIMULATED_PARTIAL:'모의 부분 지급'};

export function StatementPanel({id,address,onClose,embedded=false}:{id:string;address:string;onClose:()=>void;embedded?:boolean}) {
  const panel=useRef<HTMLElement>(null);
  useEffect(()=>{if(!embedded){panel.current?.focus({preventScroll:true});panel.current?.scrollIntoView({block:'start'});}},[id,embedded]);
  const query=useQuery({queryKey:['statement',address,id],queryFn:()=>api<Statement>(`/api/workbench/settlements/${id}/statement`),retry:false});
  const s=query.data;
  return <section ref={panel} tabIndex={-1} className="card statement-panel" aria-labelledby="statement-heading" aria-busy={query.isFetching}>
    <div className="card-title"><h2 id="statement-heading">내 정산 근거</h2>{!embedded?<button className="small secondary" onClick={onClose}>닫기</button>:null}</div>
    {query.isPending?<p role="status">원장의 계산 근거와 지급 이력을 조회 중입니다.</p>:query.error?<div role="alert"><p className="error">{query.error.message}</p><button className="small secondary" onClick={()=>void query.refetch()}>다시 조회</button></div>:s?<>
      <div className="section-row"><b>{s.period} · v{s.version}</b><span className="badge">{labels[s.status]??s.status}</span></div>
      {!s.latest?<p className="notice">이후 정정 버전이 있습니다. 지급 가능 잔액은 최신 승인 명세를 확인해 주세요.</p>:null}
      <div className="statement-formula"><span>정산대상 매출 <b>{won(s.netSalesWon)}</b></span><span>전체 배분율 <b>{(s.rateBps/100).toFixed(1)}%</b></span><span>내 보유 비중 <b>{s.ownUnits.toLocaleString()} / {s.totalUnits.toLocaleString()}단위</b></span></div>
      <p className="hint">전체 배분금 {won(s.poolWon)}을 보유 비중으로 나눕니다. 원 단위 잔여액을 배분한 서버 계산 결과이며, 세금·수수료를 반영하지 않은 모의 금액입니다.</p>
      <div className="table-wrap"><table><tbody><tr><th scope="row">이번 버전의 세전 의무액</th><td className="numeric">{won(s.amountWon)}</td></tr><tr><th scope="row">이전 버전 기지급</th><td className="numeric">{won(s.priorPaidWon)}</td></tr><tr><th scope="row">이번 버전 모의 지급</th><td className="numeric">{won(s.paidWon)}</td></tr><tr><th scope="row">미지급 잔액</th><td className="numeric"><b>{won(s.unpaidWon)}</b></td></tr><tr><th scope="row">{s.version>1?'이전 의무액 대비 정정 차액':'최초 산정 금액'}</th><td className="numeric">{won(s.deltaWon)}</td></tr></tbody></table></div>
      {BigInt(s.overpaidWon)>0n?<p className="notice">기지급액이 정정 의무액보다 {won(s.overpaidWon)} 많습니다. 추가 지급을 차단하며 자동으로 회수하지 않습니다.</p>:null}
      {BigInt(s.cashShortfallWon)>0n?<p className="error">전체 정산의 현금 여력이 {won(s.cashShortfallWon)} 부족합니다. 의무액과 지급 가능액은 다릅니다.</p>:null}
      <h3>내 모의 지급 이력</h3>{s.payments.length?<div className="table-wrap"><table><thead><tr><th>시각</th><th>결과</th><th className="numeric">요청</th><th className="numeric">모의 지급</th></tr></thead><tbody>{s.payments.map(p=><tr key={p.id}><td>{new Date(p.created_at).toLocaleString('ko-KR')}</td><td>{paymentLabels[p.outcome]??p.outcome}</td><td className="numeric">{won(p.requested_won)}</td><td className="numeric">{won(p.paid_won)}</td></tr>)}</tbody></table></div>:<p className="hint">아직 모의 지급을 시도한 이력이 없습니다.</p>}
      <details className="statement-sources"><summary>근거 자료와 데이터 버전</summary><p className="hint">마감 증빙 {s.evidenceId} · {labels[s.evidenceStatus]??s.evidenceStatus}</p><p className="mono">원본 SHA-256 {s.sourceHash}</p><p className="mono">정산 digest {s.dataVersion}</p><p className="hint">산식 {s.algorithm} · 만기 원금 별도 상환 의무 없음</p></details>
      <p className="hint">이 화면은 원장에 저장된 근거를 보여줍니다. AI 응답이나 실제 현금 지급 결과가 아닙니다.</p>
    </>:null}
  </section>;
}
