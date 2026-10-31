import {api} from './auth';
import type {components} from './api.generated';
type Schema=components['schemas'];
export type Offering=Schema['Offering'];
export type Sub=Schema['Subscription'];
export type Holding=Schema['Holding'];
export type Report=Schema['Report'];
export type Evidence=Schema['Evidence'];
export type Settlement=Schema['Settlement'];
export type Line=Schema['Line'];
export type MySettlement=Schema['MySettlement'];
export type Job=Omit<Schema['Job'],'calldata'|'tx_hash'> & {calldata:`0x${string}`|null;tx_hash:`0x${string}`|null};
export type Attachment=Schema['Attachment'];
export type Dashboard=Omit<Schema['Dashboard'],'chain_jobs'|'all_jobs'> & {chain_jobs:Job[];all_jobs?:Job[]};
export type Explanation=Schema['Explanation'];
export type Statement=Schema['Statement'];
export type Performance=Schema['Performance'];
export function won(value:string|number|bigint) {try {return BigInt(value).toLocaleString('ko-KR')+'원';} catch {return '확인 필요';}}
export function short(address:string) {return address.slice(0,6)+'…'+address.slice(-4);}
export function due(line:Pick<Line,'amount_won'|'paid_won'|'prior_paid_won'>) {const n=BigInt(line.amount_won)-BigInt(line.paid_won)-BigInt(line.prior_paid_won);return n>0?n:0n;}
export async function command<T=unknown>(path:string,body:object={}) {
  const csrf=await api<{token:string;headerName:string}>('/api/auth/csrf');
  return api<T>(`/api/workbench/${path}`,{method:'POST',headers:{'Content-Type':'application/json',[csrf.headerName]:csrf.token},body:JSON.stringify(body),signal:AbortSignal.timeout((path.endsWith('/explain')||path==='agent/chat')?60_000:35_000)});
}
export const labels:Record<string,string>={MINT:'보유 수량 발행',SETTLEMENT:'매출 확정 기록',FUND_DISTRIBUTION:'분배 자금 예치',PAY_DISTRIBUTION:'테스트 토큰 분배',OPEN:'모집 중',FUNDED:'배정 완료',REFUNDED:'모의 환불',MATURED:'만기',ACCEPTED:'접수 · 보유 미반영',ALLOCATED:'배정 완료',CANCELLED:'취소',BLOCKED:'보완 필요',REVIEW:'검토 대기',CLOSED:'마감',APPROVED:'승인',AWAITING_DEPLOYMENT:'계약 등록 대기',AWAITING_SIGNATURE:'지갑 승인 대기',SUBMITTED:'거래 제출',INCLUDED:'블록 포함',SAFE:'safe 확인',FAILED:'실패',CHECK_PENDING:'확인 대기',PENDING:'업로드 대기',READY:'업로드 검증 완료'};
