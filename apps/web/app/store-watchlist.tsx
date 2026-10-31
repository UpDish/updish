'use client';

import type {Listing} from '../lib/market';
import {labels} from '../lib/workbench';

export type WatchlistState={search:string;filter:string};
/** The exchange's persistent market list, using contract data rather than prices. */
export function StoreWatchlist({listings,selectedId,onSelect,state,onChange}:{listings:Listing[];selectedId:string;onSelect:(id:string)=>void;state:WatchlistState;onChange:(state:WatchlistState)=>void}) {
  const {search,filter}=state;
  const visible=listings.filter(l=>`${l.store.name} ${l.store.district}`.includes(search.trim())&&(filter==='all'||(l.offering?.status??l.terms.status)==='OPEN'));
  return <section className="exchange-panel store-watchlist" aria-label="다른 가게 탐색">
    <div className="watchlist-search"><label className="sr-only" htmlFor="watchlist-search">다른 가게 검색</label><input id="watchlist-search" type="search" placeholder="가게명·지역 검색" value={search} onChange={e=>onChange({...state,search:e.target.value})}/></div>
    <div className="watchlist-tabs" aria-label="가게 목록 범위"><button aria-pressed={filter==='all'} onClick={()=>onChange({...state,filter:'all'})}>전체 가게</button><button aria-pressed={filter==='open'} onClick={()=>onChange({...state,filter:'open'})}>모집 중</button></div>
    <div className="watchlist-columns"><span>가게명</span><span>배분율 · 모집 상태</span></div>
    <nav className="watchlist-rows" aria-label="가게 선택">{visible.map(l=>{
      const o=l.offering,t=l.terms,status=o?.status??t.status;
      return <button key={l.store.id} className="watchlist-row" aria-pressed={selectedId===l.store.id} onClick={()=>onSelect(l.store.id)}><span><b>{l.store.name}</b><small>{l.store.district} · {l.store.category}</small></span><span><b>{(o?.rate_bps??t.rateBps)/100}%</b><small className={`market-state state-${status.toLowerCase()}`}>{labels[status]}</small></span></button>;
    })}{!visible.length?<p className="watchlist-empty" role="status">검색 결과가 없습니다.</p>:null}</nav>
    <div className="watchlist-foot">{visible.length}개 가상 가게 · 배분율은 확정 수익률이 아닙니다.</div>
  </section>;
}
