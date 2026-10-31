'use client';
import {useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useConnection} from 'wagmi';
import {api,type Session} from '../lib/auth';
import {command,short,type Dashboard} from '../lib/workbench';
import {personaChoices,type Catalog,type Investments,type Persona} from '../lib/market';
import {WalletPanel} from './wallet-panel';
import {DemoViewSwitcher,type DemoView} from './demo-view-switcher';
import {StoreDirectory,StoreDetail} from './store-market';
import {InvestmentHistory,SamplePortfolio} from './investments';
import {TransparencyPanel} from './transparency-panel';
import {Modal} from './modal';
import {AgentDock} from './agent-dock';
import {DemoGuide} from './demo-guide';
const AgentChat=dynamic(()=>import('./agent-chat').then(m=>m.AgentChat),{loading:()=> <p role="status">채팅을 불러오는 중…</p>});
const OperatingPanels=dynamic(()=>import('./operating-panels'),{loading:()=> <p role="status">업무 화면을 불러오는 중…</p>});
type Tab='market'|'investments'|'merchant'|'transparency'|'review'|'operations'|'wallet';
const titles:Record<Tab,string>={market:'가게 탐색',investments:'내 투자',merchant:'가게 관리',transparency:'매출 대조',review:'자료 검토',operations:'정산·분배',wallet:'내 지갑'};
const href=(tab:Tab,store?:string)=>`/?tab=${tab}${store?`&store=${encodeURIComponent(store)}`:''}`;

export default function Workspace(){
  const wallet=useConnection();const router=useRouter();const [login,setLogin]=useState(false),[walletPicker,setWalletPicker]=useState(false);
  const session=useQuery({queryKey:['session'],queryFn:()=>api<Session>('/api/auth/session'),retry:false});
  const signed=session.data?.authenticated&&wallet.address?.toLowerCase()===session.data.user.address.toLowerCase()&&wallet.chainId===91342;
  if(session.isPending||wallet.status==='reconnecting')return <main className="app-main service-entry"><p role="status">로그인 상태를 확인하고 있습니다…</p></main>;
  if(signed&&session.data?.authenticated)return <SignedWorkspace key={session.data.user.address} address={session.data.user.address} role={session.data.user.role}/>;
  return <><a className="skip-link" href="#workspace-content">본문 바로가기</a><header className="app-header"><Link className="logo" href="/">UpDish</Link><span className="integration-label">업비트 연동 제안 · GIWA Sepolia</span></header>
    <main className="app-main service-entry" id="workspace-content"><div className="module-breadcrumb">서비스 더보기 <span> / </span> UpDish</div><div className="page-heading"><div><h1>매출 연동 투자</h1><p>가게의 확장 계획에 참여하고, 매출 근거와 분배 내역을 확인하세요.</p></div><span className="badge">해커톤 DEMO</span></div>
      <section className="exchange-panel service-product"><div><span className="module-name">UpDish</span><h2>음식점의 다음 시작에 참여하세요</h2><p>가게 탐색부터 청약, 보유, 지갑 분배 확인까지.</p></div><button onClick={()=>setLogin(true)}>UpDish 열기</button></section>
      <section className="service-process" aria-label="이용 순서"><div><b>01</b><span>가게와 확장 계획 확인</span></div><div><b>02</b><span>계약 조건 확인·모의 청약</span></div><div><b>03</b><span>매출 대조·분배 수령 확인</span></div></section>
      <p className="entry-disclaimer">업비트 안의 서비스 확장을 제안하는 독립 DEMO입니다. 실제 업비트 계정과 연결되거나 투자금·현금을 수취하지 않습니다. DEMO 토큰은 현금 가치가 없는 테스트 자산입니다.</p>
      <div className="entry-links"><a href="https://www.upbit.com/staking" target="_blank" rel="noreferrer">업비트 스테이킹</a><a href="https://www.upbit.com/recurring_buy" target="_blank" rel="noreferrer">업비트 코인모으기</a></div>
    </main>{login?<Modal title="UpDish에 로그인" suspended={walletPicker} description="테스트 지갑을 연결해 가게 탐색을 시작합니다." onClose={()=>setLogin(false)}>{session.error?<p role="alert" className="error-box">{session.error.message}</p>:null}<WalletPanel loginOnly onWalletSelectionChange={setWalletPicker} onLogin={()=>{setLogin(false);router.replace(href('market'));}}/></Modal>:null}</>;
}

function SignedWorkspace({address,role}:{address:string;role:string}){
  const router=useRouter(),params=useSearchParams(),cache=useQueryClient();
  const accountMenu=useRef<HTMLDetailsElement>(null);
  const [agent,setAgent]=useState<{open:boolean;started?:boolean;id?:string;storeId?:string}>({open:false});
  const [guide,setGuide]=useState(false),[personasOpen,setPersonasOpen]=useState(false);
  const [mode,setMode]=useState<DemoView>('investor'),[persona,setPersona]=useState(''),[notice,setNotice]=useState('');
  const [directory,setDirectory]=useState({search:'',filter:'all'});
  const catalog=useQuery({queryKey:['market',address],queryFn:()=>api<Catalog>('/api/workbench/market'),retry:false});
  const dashboard=useQuery({queryKey:['dashboard',address],queryFn:()=>api<Dashboard>('/api/workbench/dashboard'),retry:false});
  const investments=useQuery({queryKey:['investments',address],queryFn:()=>api<Investments>('/api/workbench/investments'),retry:false});
  const sample=useQuery({queryKey:['persona',address,persona],queryFn:()=>api<Persona>(`/api/workbench/demo-data/personas/${persona}`),enabled:role==='OPERATOR'&&!!persona,retry:false});
  const sampleView=role==='OPERATOR'&&persona?sample.data:undefined;
  const owns=dashboard.data?.offering.owner_address.toLowerCase()===address.toLowerCase();
  const allowed:Tab[]=['market','investments','transparency','wallet'];
  if(sampleView){if(sampleView.availableSections.includes('STORE_MANAGEMENT'))allowed.push('merchant');if(sampleView.availableSections.includes('REVIEW'))allowed.push('review');if(sampleView.availableSections.includes('OPERATIONS'))allowed.push('operations');}
  else{if(owns||['MERCHANT','OPERATOR'].includes(role))allowed.push('merchant');if(['REVIEWER','OPERATOR'].includes(role))allowed.push('review','operations');}
  const requested=params.get('tab') as Tab;const tab=allowed.includes(requested)?requested:'market';
  const consoleView=['merchant','review','operations'].includes(tab);
  const listing=catalog.data?.listings.find(l=>l.store.id===params.get('store'));
  async function refresh(){await Promise.all(['market','investments','distributions','transparency','dashboard','offering','statement','performance'].map(k=>cache.invalidateQueries({queryKey:[k]})));}
  const action=useMutation({mutationFn:({path,body}:{path:string;body?:object})=>command(path,body),onSuccess:()=>refresh(),onError:e=>setNotice(e.message)});
  async function subscribe(id:string,units:number,requestKey:string){if(persona)throw new Error('과거 계정 예시는 읽기 전용입니다. 내 지갑으로 돌아와 청약해 주세요.');await action.mutateAsync({path:`offerings/${id}/subscribe`,body:{units,requestKey,understood:true}});}
  function openAgent(id?:string,storeId?:string){setAgent(a=>({...a,started:true,open:true,id,storeId:storeId??params.get('store')??a.storeId??'store-seongsu'}));}
  function closeMenu(){if(accountMenu.current)accountMenu.current.open=false;}
  function changeMode(v:DemoView){closeMenu();setMode(v);setPersona('');setNotice('');router.push(href(v==='merchant'?'merchant':v==='operator'?'operations':'market'));}
  return <><a className="skip-link" href="#workspace-content">본문 바로가기</a><header className="app-header presentation-header"><div className="header-left"><Link className="logo" href={href('market')}>UpDish</Link>{consoleView?<span className="console-label">업무 콘솔</span>:<nav className="main-nav" aria-label="주 메뉴">{(['market','investments'] as const).map(n=><Link key={n} href={href(n)} className={tab===n?'active':''} aria-current={tab===n?'page':undefined}>{titles[n]}</Link>)}</nav>}</div>
      <div className="header-right"><button className="agent-toggle" aria-expanded={agent.open} aria-controls="agent-dock" onClick={()=>agent.open?setAgent(a=>({...a,open:false})):openAgent()}>Agent</button><details ref={accountMenu} className="account-menu" onClick={e=>{if((e.target as Element).closest('a'))closeMenu();}} onKeyDown={e=>{if(e.key==='Escape'){closeMenu();accountMenu.current?.querySelector('summary')?.focus();}}}><summary>{short(address)}</summary><div className="account-options"><Link href={href('wallet')}>내 지갑·참여 자격</Link>{allowed.includes('merchant')?<Link href={href('merchant')}>가게 콘솔</Link>:null}{allowed.includes('review')?<Link href={href('review')}>검토·정산 콘솔</Link>:null}{role==='OPERATOR'?<><hr/><span>발표자 도구</span><DemoViewSwitcher view={mode} onChange={changeMode}/><button className="inline-button" onClick={()=>{closeMenu();setGuide(true);}}>시연 순서</button><button className="inline-button" onClick={()=>{closeMenu();setPersonasOpen(true);}}>과거 계정 예시</button></>:null}</div></details></div></header>
    <div className="module-status"><span>매출 연동 투자 <span className="muted">/ {consoleView?'업무 처리':'UpDish'}</span></span><span>모의 투자 · GIWA Sepolia</span></div>
    {consoleView?<nav className="console-nav" aria-label="업무 콘솔 메뉴"><Link href={href('market')}>투자 화면으로</Link>{(['merchant','review','operations'] as Tab[]).filter(n=>allowed.includes(n)).map(n=><Link key={n} href={href(n)} aria-current={tab===n?'page':undefined} className={tab===n?'active':''}>{titles[n]}</Link>)}</nav>:null}
    <main className={`app-main ${agent.open?'agent-open':''}`} id="workspace-content">
      {personasOpen&&role==='OPERATOR'?<Modal title="과거 시연 계정 예시" onClose={()=>setPersonasOpen(false)}><label htmlFor="persona-select">읽기 전용 자료</label><select id="persona-select" value={persona} onChange={e=>{setPersona(e.target.value);setPersonasOpen(false);router.push(href('investments'));}}><option value="">현재 로그인 지갑</option>{personaChoices.map(([id,label])=><option key={id} value={id}>{label} · 과거 가상 시나리오</option>)}</select><p className="hint">발표 v0.3 원장과 구분되는 과거 예시입니다. 실제 지갑·권한을 변경하지 않습니다.</p></Modal>:null}
      {guide?<DemoGuide onClose={()=>setGuide(false)} onGo={target=>{setGuide(false);if(target==='agent')openAgent();else router.push(href(target as Tab));}} sections={[...allowed,'agent']}/>:null}
      {persona?<div className="sample-view-banner" role="status"><b>{sampleView?.persona.name??'로딩 중'} · 과거 가상 예시</b><span>읽기 전용 · 발표용 현재 계약과 별도 자료입니다.</span><button className="secondary small" onClick={()=>setPersona('')}>내 지갑으로 돌아가기</button></div>:null}
      {notice?<div className="error-box" role="alert">{notice}<button className="small secondary" onClick={()=>setNotice('')}>닫기</button></div>:null}
      {tab==='market'?<QueryState query={catalog}>{catalog.data?listing?<StoreDetail key={listing.store.id} listing={listing} dashboard={persona?undefined:dashboard.data} pending={action.isPending||!!persona} onBack={()=>router.push(href('market'))} onSubscribe={subscribe} onPortfolio={()=>router.push(href('investments'))} onTransparency={()=>router.push(href('transparency',listing.store.id))} onAgent={()=>openAgent(undefined,listing.store.id)} onEvidence={!persona&&allowed.includes('merchant')?()=>router.push(href('merchant')):undefined}/>:<StoreDirectory listings={catalog.data.listings} search={directory.search} filter={directory.filter} onSearch={search=>setDirectory(d=>({...d,search}))} onFilter={filter=>setDirectory(d=>({...d,filter}))} onSelect={id=>router.push(href('market',id))}/>:null}</QueryState>:null}
      {tab==='investments'?(persona?<QueryState query={sample}>{sampleView?<SamplePortfolio view={sampleView}/>:null}</QueryState>:<QueryState query={investments}>{investments.data?<InvestmentHistory data={investments.data} address={address} pending={action.isPending} onCancel={async id=>{await action.mutateAsync({path:`subscriptions/${id}/cancel`});}} onMarket={()=>router.push(href('market'))} onAgent={id=>openAgent(id)}/>:null}</QueryState>):null}
      {tab==='transparency'&&catalog.data?<><button className="back-button" onClick={()=>router.push(href('market',params.get('store')??'store-seongsu'))}>프로젝트 상세로</button><TransparencyPanel listings={catalog.data.listings} storeId={params.get('store')??'store-seongsu'} onStore={id=>router.push(href('transparency',id))} onAgent={()=>openAgent(undefined,params.get('store')??'store-seongsu')}/></>:null}
      {consoleView?(persona?<QueryState query={sample}>{sampleView?<SampleManagement view={sampleView} tab={tab}/>:null}</QueryState>:<OperatingPanels key={tab} section={tab==='operations'?'operator':'evidence'} purpose={tab==='review'?'review':'merchant'} initialView={role==='REVIEWER'?'settlements':'subscriptions'}/>):null}
      {tab==='wallet'?<><button className="back-button" onClick={()=>router.push(href('market'))}>가게 탐색으로</button><div className="page-heading"><h1>내 지갑과 참여 자격</h1></div><WalletPanel onLogin={()=>router.replace(href('market'))}/></>:null}
      <footer>가상의 매장·모의 청약을 사용하는 해커톤 DEMO · 현금 수취·지급 없음<br/>DEMO 토큰은 환금 불가 테스트 자산이며 TESTNET FAUCET Dojang은 업비트 실명 인증과 구분됩니다.</footer>
    </main><AgentDock open={agent.open} onClose={()=>setAgent(a=>({...a,open:false}))}>{agent.started?<QueryState query={investments}>{investments.data?<AgentChat key={`${address}-${persona}-${agent.id??''}`} address={address} investments={persona?{subscriptions:[],holdings:[],settlements:[],mode:'SIMULATION'}:investments.data} initialId={agent.id} preview={!!persona} storeId={agent.storeId??'store-seongsu'} storeName={catalog.data?.listings.find(l=>l.store.id===(agent.storeId??'store-seongsu'))?.store.name??'성수 모퉁이'}/>:null}</QueryState>:null}</AgentDock></>;
}
function QueryState({query,children}:{query:{isPending:boolean;error:Error|null;refetch:()=>unknown};children:React.ReactNode}){return query.isPending?<section className="exchange-panel empty-state" role="status">자료를 불러오는 중…</section>:query.error?<section className="exchange-panel empty-state" role="alert"><h2>자료를 가져오지 못했습니다</h2><p>{query.error.message}</p><button onClick={()=>void query.refetch()}>다시 시도</button></section>:<>{children}</>;}
function SampleManagement({view,tab}:{view:Persona;tab:string}){return <section className="exchange-panel detail-body"><h1>{titles[tab as Tab]} · {view.persona.name}</h1><p>과거 시연 자료입니다. 실제 처리는 내 지갑 화면에서 진행합니다.</p><div className="table-wrap"><table><thead><tr><th>가게</th><th>기간</th><th>상태</th></tr></thead><tbody>{(tab==='review'?view.reviewQueue:view.storeManagement.settlements).map(r=><tr key={r.id}><td>{view.market.stores.find(s=>s.id===r.storeId)?.name}</td><td>{r.period}</td><td>{r.status.replace('_SAMPLE','')}</td></tr>)}</tbody></table></div></section>;}
