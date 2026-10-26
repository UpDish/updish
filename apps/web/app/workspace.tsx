'use client';
import {useState} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useConnection} from 'wagmi';
import {api,type Session} from '../lib/auth';
import {command,short,type Dashboard} from '../lib/workbench';
import {personaChoices,type Benefits,type Catalog,type Investments,type Persona} from '../lib/market';
import {WalletPanel} from './wallet-panel';
import {DemoViewSwitcher,type DemoView} from './demo-view-switcher';
import {StoreDirectory,StoreDetail} from './store-market';
import {InvestmentHistory,SamplePortfolio} from './investments';
import {CustomerBenefits} from './customer-benefits';
const OperatingPanels=dynamic(()=>import('./operating-panels'),{loading:()=> <p role="status">관리 화면을 불러오는 중…</p>});
type Tab='market'|'investments'|'merchant'|'benefits'|'review'|'operations'|'wallet';
const titles:Record<Tab,string>={market:'가게 목록',investments:'투자 내역',merchant:'가게 관리',benefits:'고객 혜택',review:'자료 검토',operations:'운영 관리',wallet:'내 지갑'};
const href=(tab:Tab,store?:string)=>`/?tab=${tab}${store?`&store=${encodeURIComponent(store)}`:''}`;

export default function Workspace(){
  const wallet=useConnection();const router=useRouter();
  const session=useQuery({queryKey:['session'],queryFn:()=>api<Session>('/api/auth/session'),retry:false});
  const signed=session.data?.authenticated&&wallet.address?.toLowerCase()===session.data.user.address.toLowerCase()&&wallet.chainId===91342;
  return <><a className="skip-link" href="#workspace-content">본문 바로가기</a>{signed&&session.data?.authenticated?<SignedWorkspace key={session.data.user.address} address={session.data.user.address} role={session.data.user.role}/>:<><header className="app-header"><Link className="logo" href="/">UpDish</Link><span className="user-status">GIWA Sepolia · 모의 투자</span></header><main className="app-main login-main" id="workspace-content"><div className="login-heading"><span className="login-mark" aria-hidden="true">U</span><h1>UpDish에 로그인</h1><p>지갑으로 로그인하고 가게의 매출과 투자 조건을 확인하세요.</p></div>{session.isPending||wallet.status==='reconnecting'?<p role="status">로그인 상태를 확인하고 있습니다…</p>:null}{session.error?<p className="error-box" role="alert">{session.error.message}</p>:null}<WalletPanel loginOnly onLogin={()=>router.replace(href('market'))}/><p className="login-note">해커톤 모의 투자 서비스입니다. 실제 투자금을 받거나 현금을 지급하지 않습니다.</p></main></> }</>;
}

function SignedWorkspace({address,role}:{address:string;role:string}){
  const router=useRouter(),params=useSearchParams(),cache=useQueryClient();
  const [mode,setMode]=useState<DemoView>('operator');const [persona,setPersona]=useState('');const [notice,setNotice]=useState('');
  const catalog=useQuery({queryKey:['market',address],queryFn:()=>api<Catalog>('/api/workbench/market'),retry:false});
  const dashboard=useQuery({queryKey:['dashboard',address],queryFn:()=>api<Dashboard>('/api/workbench/dashboard'),retry:false});
  const investments=useQuery({queryKey:['investments',address],queryFn:()=>api<Investments>('/api/workbench/investments'),retry:false});
  const benefits=useQuery({queryKey:['benefits',address],queryFn:()=>api<Benefits>('/api/workbench/benefits'),retry:false});
  const sample=useQuery({queryKey:['persona',address,persona],queryFn:()=>api<Persona>(`/api/workbench/demo-data/personas/${persona}`),enabled:role==='OPERATOR'&&!!persona,retry:false});
  const sampleView=role==='OPERATOR'&&persona?sample.data:undefined;
  const owns=dashboard.data?.offering.owner_address.toLowerCase()===address.toLowerCase();
  const nav:Tab[]=['market','investments'];
  if(sampleView){if(sampleView.availableSections.includes('STORE_MANAGEMENT'))nav.push('merchant');if(sampleView.availableSections.includes('BENEFITS'))nav.push('benefits');if(sampleView.availableSections.includes('REVIEW'))nav.push('review');if(sampleView.availableSections.includes('OPERATIONS'))nav.push('operations');}
  else{if((owns||role==='MERCHANT'||role==='OPERATOR')&&(role!=='OPERATOR'||['operator','merchant'].includes(mode)))nav.push('merchant');if(role!=='REVIEWER')nav.push('benefits');if((role==='REVIEWER'||role==='OPERATOR')&&(role!=='OPERATOR'||mode==='operator'))nav.push('review');if(role==='OPERATOR'&&mode==='operator')nav.push('operations');}
  const requested=params.get('tab') as Tab;const tab=requested==='wallet'?'wallet':nav.includes(requested)?requested:'market';
  const listing=catalog.data?.listings.find(l=>l.store.id===params.get('store'));
  async function refresh(){await Promise.all(['market','investments','benefits','dashboard','offering','statement','performance'].map(k=>cache.invalidateQueries({queryKey:[k]})));}
  const action=useMutation({mutationFn:({path,body}:{path:string;body?:object})=>command(path,body),onSuccess:()=>refresh(),onError:e=>setNotice(e.message)});
  async function subscribe(id:string,units:number){if(persona)throw new Error('계정 예시는 읽기 전용입니다. 실제 지갑 내역으로 돌아간 뒤 청약해 주세요.');await action.mutateAsync({path:`offerings/${id}/subscribe`,body:{units,requestKey:crypto.randomUUID(),understood:true}});}
  function changeMode(v:DemoView){setMode(v);setPersona('');setNotice('');router.push(href('market'));}
  return <><header className="app-header"><div className="header-left"><Link className="logo" href={href('market')}>UpDish</Link><nav className="main-nav" aria-label="주 메뉴">{nav.map(n=><Link key={n} href={href(n)} className={tab===n?'active':''} aria-current={tab===n?'page':undefined}>{titles[n]}</Link>)}</nav></div><div className="header-right">{role==='OPERATOR'?<DemoViewSwitcher view={mode} onChange={changeMode}/>:<span className="user-mode">{role==='MERCHANT'?'가게 담당자':role==='REVIEWER'?'검토자':'투자자'}</span>}<span className="user-status">{short(address)}</span><Link className="wallet-top" href={href('wallet')}>내 지갑</Link></div></header><div className="notice-ticker"><span><b>해커톤 시연</b> 실제 투자금 수취·현금 지급 없음</span><span>GIWA Sepolia · TESTNET FAUCET Dojang</span></div>
    <main className="app-main" id="workspace-content">
      {role==='OPERATOR'?<details className="scenario-tools"><summary>시연 계정 예시 보기{persona?' · 예시 조회 중':''}</summary><div><label htmlFor="persona-select">시연 데이터</label><select id="persona-select" value={persona} onChange={e=>{setPersona(e.target.value);router.push(href('market'));}}><option value="">현재 로그인 지갑 · 실제 모의 원장</option>{personaChoices.map(([id,label])=><option key={id} value={id}>{label} · 가상 예시</option>)}</select><p>예시는 읽기 전용입니다. 실제 로그인 지갑·권한은 바뀌지 않습니다.</p></div></details>:null}
      {persona?<div className="sample-view-banner" role="status"><b>{sampleView?.persona.name??'시연 예시 로딩 중'} · 가상 데이터</b><span>현재 지갑의 보유가 아닙니다. 이 화면에서는 청약·승인·쿠폰 발급을 실행하지 않습니다.</span><button className="secondary small" onClick={()=>{setPersona('');setNotice('');}}>내 지갑 내역으로 돌아가기</button></div>:null}
      {notice?<div className="error-box" role="alert">{notice}<button className="small secondary" onClick={()=>setNotice('')}>닫기</button></div>:null}
      {tab==='market'?<QueryState query={catalog}>{catalog.data?listing?<StoreDetail dashboard={persona?undefined:dashboard.data} onEvidence={!persona&&nav.includes('merchant')?()=>router.push(href('merchant')):undefined} key={`${listing.store.id}-${persona}`} listing={listing} pending={action.isPending||!!persona} onBack={()=>router.push(href('market'))} onSubscribe={subscribe} onPortfolio={()=>router.push(href('investments'))}/>:<StoreDirectory listings={catalog.data.listings} onSelect={id=>router.push(href('market',id))}/>:null}</QueryState>:null}
      {tab==='investments'?(persona?<QueryState query={sample}>{sampleView?<SamplePortfolio view={sampleView}/>:null}</QueryState>:<QueryState query={investments}>{investments.data?<InvestmentHistory data={investments.data} address={address} pending={action.isPending} onCancel={id=>{setNotice('');action.mutate({path:`subscriptions/${id}/cancel`});}} onMarket={()=>router.push(href('market'))}/>:null}</QueryState>):null}
      {tab==='benefits'?<QueryState query={persona?sample:benefits}>{catalog.data&&benefits.data?<CustomerBenefits data={benefits.data} listings={catalog.data.listings} pending={action.isPending} sample={sampleView} onClaim={id=>{setNotice('');action.mutate({path:`benefits/${id}/claim`});}}/>:null}</QueryState>:null}
      {['merchant','review','operations'].includes(tab)?persona?<QueryState query={sample}>{sampleView?<SampleManagement view={sampleView} tab={tab}/>:null}</QueryState>:<><div className="section-context"><span>{titles[tab]}</span><b>{dashboard.data?.offering.store_name??'가게 조회 중'}</b></div><OperatingPanels section={tab==='merchant'||tab==='review'?'evidence':'operator'}/></>:null}
      <div hidden={tab!=='wallet'}><div className="page-heading"><h1>내 지갑과 참여 자격</h1></div><WalletPanel onLogin={()=>router.replace(href('market'))}/></div>
      <footer>UpDish · GIWA Sepolia · 모의 투자<br/>TESTNET FAUCET Dojang은 업비트 실명 인증과 구분됩니다.</footer>
    </main></>;
}
function QueryState({query,children}:{query:{isPending:boolean;error:Error|null;refetch:()=>unknown};children:React.ReactNode}){return query.isPending?<section className="exchange-panel empty-state" role="status">자료를 불러오고 있습니다…</section>:query.error?<section className="exchange-panel empty-state" role="alert"><h2>자료를 가져오지 못했습니다</h2><p>{query.error.message}</p><button onClick={()=>void query.refetch()}>다시 시도</button></section>:<>{children}</>;}
function SampleManagement({view,tab}:{view:Persona;tab:string}){const stores=view.storeManagement.stores;return <section className="exchange-panel detail-body"><h1>{titles[tab as Tab]} · {view.persona.name}</h1>{tab==='merchant'?<>{stores.map(s=><article key={s.id} className="sample-managed-store"><h2>{s.name}</h2><p>{s.district} · {s.category}</p><p>매출 자료 {view.storeManagement.evidence.filter(e=>e.storeId===s.id).length}건 · 정산 {view.storeManagement.settlements.filter(e=>e.storeId===s.id).length}건</p></article>)}</>:<div className="table-wrap"><table><thead><tr><th>자료</th><th>기간</th><th>상태</th></tr></thead><tbody>{(tab==='review'?view.reviewQueue:view.operations.settlements).map(r=><tr key={r.id}><td>{view.market.stores.find(s=>s.id===r.storeId)?.name}</td><td>{r.period}</td><td>{r.status.replace('_SAMPLE','')}</td></tr>)}</tbody></table></div>}<p className="hint">시연 계정의 읽기 전용 예시입니다. 실제 지갑의 업무 처리는 ‘내 지갑 내역으로 돌아가기’에서 진행합니다.</p></section>;}
