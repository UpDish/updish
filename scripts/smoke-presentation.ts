import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createPublicClient,createWalletClient,http,erc20Abi,type Address,type Hex} from 'viem';
import {giwaSepolia,dojang} from '../packages/chain-config/giwa';

// Intentionally fixed loopback endpoints: this rehearsal must never sign GIWA transactions.
const origin='http://127.0.0.1:3001',apiBase='http://127.0.0.1:8081',rpcUrl='http://127.0.0.1:8545';
const wallet=createWalletClient({chain:giwaSepolia,transport:http(rpcUrl)});
const chain=createPublicClient({chain:giwaSepolia,transport:http(rpcUrl)});
async function rpc(method:string,params:unknown[]=[]){const r=await fetch(rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const b=await r.json();if(b.error)throw Error(b.error.message);return b.result;}
assert.match(await rpc('web3_clientVersion'),/anvil/i,'LOCAL ANVIL ONLY');assert.equal(await chain.getChainId(),91342);
const [operator,investor,reviewer,outsider]=await wallet.getAddresses();
const checks:string[]=[],receipts:{kind:string;hash:Hex;status:string}[]=[];
const mock=JSON.parse(await readFile('contracts/out/LocalDojang.sol/LocalDojang.json','utf8'));
await rpc('anvil_setCode',[dojang.scroll,mock.deployedBytecode.object]);await rpc('anvil_setCode',[dojang.eas,'0x60006000f3']);
for(const address of [operator,investor]){const hash=await wallet.writeContract({account:operator,address:dojang.scroll,abi:mock.abi,functionName:'setVerified',args:[address,dojang.faucetAttester,true]});await chain.waitForTransactionReceipt({hash});}
await rpc('anvil_mine',['0x40']);
class Session{
  cookie='';constructor(readonly address:Address){}
  async request(path:string,body?:object){const headers:Record<string,string>={Cookie:this.cookie};if(body){const c=await this.request('/auth/csrf');headers.Cookie=this.cookie;headers.Origin=origin;headers['Content-Type']='application/json';headers[c.body.headerName]=c.body.token;}
    const r=await fetch(apiBase+'/api/v1'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45_000)});for(const c of r.headers.getSetCookie())if(c.startsWith('UPDISH_SESSION='))this.cookie=c.split(';')[0];return {status:r.status,body:await r.json()};}
  async login(){const c=await this.request('/auth/challenge',{address:this.address});assert.equal(c.status,200,JSON.stringify(c.body));const signature=await wallet.signMessage({account:this.address,message:c.body.message});const v=await this.request('/auth/verify',{...c.body,signature});assert.equal(v.status,200,JSON.stringify(v.body));return v.body;}
  async post(path:string,body:object={}){const r=await this.request('/workbench/'+path,body);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;}
  async get(path:string){const r=await this.request('/workbench/'+path);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;}
}
const op=new Session(operator),user=new Session(investor),review=new Session(reviewer),other=new Session(outsider);
assert.equal((await op.login()).user.role,'OPERATOR');await user.login();await other.login();await op.post('members',{address:reviewer,role:'REVIEWER',ownStore:false});assert.equal((await review.login()).user.role,'REVIEWER');
const o=await op.post('reset');assert.equal(o.target_units,10000);assert.equal(o.unit_price,'10000');assert.equal(o.rate_bps,1000);assert.equal(o.scenario_code,'presentation-v03');
const key=crypto.randomUUID();const subscription=await user.post(`offerings/${o.id}/subscribe`,{units:100,requestKey:key,understood:true});assert.equal((await user.post(`offerings/${o.id}/subscribe`,{units:100,requestKey:key,understood:true})).id,subscription.id);
assert.equal((await user.get('dashboard')).holdings.length,0);await op.post(`offerings/${o.id}/subscribe`,{units:9900,requestKey:crypto.randomUUID(),understood:true});await op.post(`offerings/${o.id}/allocate`);assert.equal((await user.get('dashboard')).holdings[0].units,100);
checks.push('100M goal / 10,000 units; idempotent 1M subscription -> 100 real local-wallet units = 1%; no holdings before allocation');
async function approved(filename:string){const csv=await readFile('fixtures/presentation-v03/'+filename,'utf8');const e=await op.post('evidence',{offeringId:o.id,period:'2026-10',filename,csv});assert.equal((await op.request(`/workbench/evidence/${e.id}/close`,{reason:'self'})).status,409);assert.equal((await other.request(`/workbench/evidence/${e.id}`)).status,403);await review.post(`evidence/${e.id}/close`,{reason:'별도 지갑 검토'});const s=await review.post('settlements',{evidenceId:e.id,reason:'발표 정산 산정'});assert.equal((await review.request(`/workbench/settlements/${s.id}/approve`,{reason:'self'})).status,409);await op.post(`settlements/${s.id}/approve`,{reason:'별도 지갑 승인'});return s;}
const s=await approved('normal.csv');assert.equal(s.pool_won,'3000000');const statement=await user.get(`settlements/${s.id}/statement`);assert.equal(statement.netSalesWon,'30000000');assert.equal(statement.amountWon,'30000');assert.equal((await other.request(`/workbench/settlements/${s.id}/statement`)).status,403);
checks.push('CSV reconciliation 30M approved sales x 10% = 3M pool; 1% holder owes 30,000; separate review/approval and private statement');
async function build(name:string){return JSON.parse(await readFile(`contracts/out/${name}.sol/${name}.json`,'utf8'));}
async function deploy(name:string,args:unknown[]){const b=await build(name);const hash=await wallet.deployContract({account:operator,abi:b.abi,bytecode:b.bytecode.object,args});const r=await chain.waitForTransactionReceipt({hash});assert.equal(r.status,'success');await rpc('anvil_mine',['0x40']);return r.contractAddress!;}
const units=await deploy('UpDishDemoUnits',[operator,dojang.scroll,dojang.faucetAttester,BigInt(o.token_id),10000n]);const registry=await deploy('SettlementRegistry',[operator]);
const cash=await deploy('UpDishDemoCash',[operator]);const vault=await deploy('UpDishDistribution',[operator,cash,units,registry,('0x'+o.run_id.replaceAll('-','').padStart(64,'0')) as Hex,BigInt(o.token_id),10000n]);
await op.post('contracts',{unitsAddress:units,registryAddress:registry});await op.post('distribution/contracts',{cashAddress:cash,vaultAddress:vault});checks.push('Four compiled contracts deployed; Core verifies runtime, owner, chain, run, asset, units, registry and cap');
async function execute(job:any){const ready=await op.post(`jobs/${job.id}/prepare`);const hash=await wallet.sendTransaction({account:operator,to:ready.target as Address,data:ready.calldata as Hex,value:0n});assert.equal((await chain.waitForTransactionReceipt({hash})).status,'success');await rpc('anvil_mine',['0x40']);const result=await op.post(`jobs/${job.id}/transaction`,{hash});assert.equal(result.status,'SAFE',JSON.stringify(result));receipts.push({kind:job.kind,hash,status:result.status});return result;}
for(const job of (await op.get('dashboard')).all_jobs)await execute(job);
assert.equal((await user.get('dashboard')).holdings[0].chain_units,100);const ub=await build('UpDishDemoUnits');assert.equal(await chain.readContract({address:units,abi:ub.abi,functionName:'balanceOf',args:[investor,BigInt(o.token_id)]}),100n);
checks.push('Dojang-gated units mint and settlement registry: receipt + safe state match Core ledger');
assert.equal((await user.request(`/workbench/settlements/${s.id}/fund-distribution`,{})).status,403);
const funding=await op.post(`settlements/${s.id}/fund-distribution`);assert.equal((await op.post(`settlements/${s.id}/fund-distribution`)).id,funding.id);
const approval=await wallet.writeContract({account:operator,address:cash,abi:erc20Abi,functionName:'approve',args:[vault,3000000n]});await chain.waitForTransactionReceipt({hash:approval});await execute(funding);assert.equal(await chain.readContract({address:cash,abi:erc20Abi,functionName:'balanceOf',args:[vault]}),3000000n);
const mine=await user.get(`settlements/${s.id}`);const line=mine.lines[0];const payout=await op.post(`lines/${line.id}/distribute`);assert.equal((await op.post(`lines/${line.id}/distribute`)).id,payout.id);await execute(payout);
assert.equal(await chain.readContract({address:cash,abi:erc20Abi,functionName:'balanceOf',args:[investor]}),30000n);assert.equal((await op.post(`lines/${line.id}/distribute`)).id,payout.id);
let own=(await user.get('distributions')).payments.filter((p:any)=>p.offering_id===o.id);assert.equal(own.length,1);assert.equal(own[0].amount_units,'30000');assert.equal(own[0].status,'SAFE');assert.equal((await other.get('distributions')).payments.length,0);
const all=(await op.get('dashboard')).all_lines.filter((l:any)=>l.settlement_id===s.id);for(const l of all)if(l.id!==line.id)await execute(await op.post(`lines/${l.id}/distribute`));
assert.equal(await chain.readContract({address:cash,abi:erc20Abi,functionName:'balanceOf',args:[vault]}),0n);checks.push('Exact 3M DEMO approval/funding -> actual ERC20 transfers; investor balance +30,000 DEMO; idempotency and own-receipt privacy; pool fully distributed');
const correction=await approved('correction.csv');assert.equal(correction.pool_won,'2900000');const record=(await op.get('dashboard')).all_jobs.find((j:any)=>j.kind==='SETTLEMENT'&&j.reference_id===correction.id);await execute(record);await execute(await op.post(`settlements/${correction.id}/fund-distribution`));
const corrected=(await user.get(`settlements/${correction.id}`)).lines[0];assert.equal(corrected.amount_won,'29000');assert.equal((await op.request(`/workbench/lines/${corrected.id}/distribute`,{})).status,409);
own=(await user.get('distributions')).payments.filter((p:any)=>p.offering_id===o.id);assert.equal(own.length,1);assert.equal(own[0].amount_units,'30000');assert.equal(await chain.readContract({address:cash,abi:erc20Abi,functionName:'balanceOf',args:[investor]}),30000n);
checks.push('Downward sales correction 30M -> 29M; zero additional deposit; prior 30,000 receipt preserved, no duplicate payment/clawback');
assert.equal((await op.post(`settlements/${correction.id}/digest`,{tamper:false})).matches,true);assert.equal((await op.post(`settlements/${correction.id}/digest`,{tamper:true})).matches,false);checks.push('Approved digest matches; altered candidate fails verification');
const report={checkedAt:new Date().toISOString(),scope:'LOCAL_ANVIL_ONLY: dedicated PostgreSQL, real HTTP Core, mock Dojang, compiled contracts. No GIWA transactions or user-wallet signatures.',scenario:'presentation-v03',offeringId:o.id,contracts:{units,registry,cash,vault},checks,receipts,liveGiwaTransactions:0};
await mkdir('docs/evidence/presentation-v03',{recursive:true});await writeFile('docs/evidence/presentation-v03/local-e2e.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
