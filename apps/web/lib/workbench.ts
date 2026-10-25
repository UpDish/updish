import {api} from './auth';
export type Offering = {id:string;run_id:string;store_name:string;title:string;owner_address:string;contract_version:number;target_units:number;unit_price:string;rate_bps:number;months:number;status:string;token_id:string;accepted_units:number;risk:string;principal_redemption:string};
export type Sub = {id:string;address:string;units:number;status:string;synthetic:boolean};
export type Holding = {id:string;address:string;units:number;chain_units:number;synthetic:boolean};
export type Report = {grossWon:string;discountWon:string;refundWon:string;netWon:string;pgWon:string;bankWon:string;rowCount:number;acceptedCount:number;ready:boolean;issues:{code:string;eventId:string;message:string;blocking:boolean}[]};
export type Evidence = {id:string;period:string;filename:string;status:string;report:Report;submitted_by:string;reviewed_by:string|null};
export type Settlement = {id:string;period:string;version:number;status:string;pool_won:string;cash_available:string;digest:string;created_by:string;approved_by:string|null};
export type Line = {id:string;settlement_id:string;address:string;units:number;amount_won:string;paid_won:string;prior_paid_won:string;delta_won:string};
export type MySettlement = Settlement & Line & {line_id:string};
export type Job = {id:string;kind:string;status:string;reference_id:string;target:string|null;calldata:`0x${string}`|null;tx_hash:`0x${string}`|null;block_number:number|null;error_code:string|null};
export type Attachment={id:string;filename:string;size_bytes:number;status:string};
export type Dashboard={offering:Offering;user:{address:string;role:string};subscriptions:Sub[];holdings:Holding[];settlements:MySettlement[];chain_jobs:Job[];evidence?:Evidence[];all_subscriptions?:Sub[];all_holdings?:Holding[];all_settlements?:Settlement[];all_lines?:Line[];all_jobs?:Job[];events?:{id:string;actor:string;action:string;reason:string}[];contracts:{units_address:string;registry_address:string;operator_address:string}[]};
export type Explanation={explanation:string;sourceIds:string[];uncertainties:string[];dataVersion:string;mode:string};
export function won(value:string|number|bigint) {try {return BigInt(value).toLocaleString('ko-KR')+'원';} catch {return '확인 필요';}}
export function short(address:string) {return address.slice(0,6)+'…'+address.slice(-4);}
export function due(line:Pick<Line,'amount_won'|'paid_won'|'prior_paid_won'>) {const n=BigInt(line.amount_won)-BigInt(line.paid_won)-BigInt(line.prior_paid_won);return n>0?n:0n;}
export async function command<T=unknown>(path:string,body:object={}) {
  const csrf=await api<{token:string;headerName:string}>('/api/auth/csrf');
  return api<T>(`/api/workbench/${path}`,{method:'POST',headers:{'Content-Type':'application/json',[csrf.headerName]:csrf.token},body:JSON.stringify(body),signal:AbortSignal.timeout(path.endsWith('/explain')?60_000:35_000)});
}
export const labels:Record<string,string>={OPEN:'모집 중',FUNDED:'배정 완료',REFUNDED:'모의 환불',MATURED:'만기',ACCEPTED:'접수 · 보유 미반영',ALLOCATED:'배정 완료',CANCELLED:'취소',BLOCKED:'보완 필요',REVIEW:'검토 대기',CLOSED:'마감',APPROVED:'승인',AWAITING_DEPLOYMENT:'계약 등록 대기',AWAITING_SIGNATURE:'지갑 승인 대기',SUBMITTED:'거래 제출',INCLUDED:'블록 포함',SAFE:'safe 확인',FAILED:'실패',CHECK_PENDING:'확인 대기',PENDING:'업로드 대기',READY:'업로드 검증 완료'};
