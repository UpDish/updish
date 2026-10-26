import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createPublicClient,createWalletClient,http,type Address,type Hex,type Abi} from 'viem';
import {giwaSepolia,dojang} from '../packages/chain-config/giwa';
const origin='http://127.0.0.1:3001';
const apiBase='http://127.0.0.1:8081';
const wallet=createWalletClient({chain:giwaSepolia,transport:http('http://127.0.0.1:8545')});
const publicClient=createPublicClient({chain:giwaSepolia,transport:http('http://127.0.0.1:8545')});
const [operator,investor,reviewer,outsider]=await wallet.getAddresses();
async function rpc(method:string,params:unknown[]) {const response=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const body=await response.json();if(body.error) throw new Error(body.error.message);return body.result;}
assert.match(await rpc('web3_clientVersion',[]),/anvil/i,'Business smoke must use local Anvil, never the live GIWA RPC');
const mock=JSON.parse(await readFile('contracts/out/LocalDojang.sol/LocalDojang.json','utf8'));
await rpc('anvil_setCode',[dojang.scroll,mock.deployedBytecode.object]);await rpc('anvil_setCode',[dojang.eas,'0x60006000f3']);
const issue=await wallet.writeContract({account:operator,address:dojang.scroll,abi:mock.abi,functionName:'setVerified',args:[investor,dojang.faucetAttester,true]});await publicClient.waitForTransactionReceipt({hash:issue});await rpc('anvil_mine',['0x40']);
class Session {
  cookie='';constructor(readonly address:Address){}
  async request(path:string,body?:object) {
    const headers:Record<string,string>={Cookie:this.cookie};if(body){headers.Origin=origin;headers['Content-Type']='application/json';const c=await this.request('/api/auth/csrf');headers.Cookie=this.cookie;headers[c.body.headerName]=c.body.token;}
    const r=await fetch(apiBase+path.replace(/^\/api\//,'/api/v1/'),{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45_000)});for(const c of r.headers.getSetCookie()) if(c.startsWith('UPDISH_SESSION='))this.cookie=c.split(';')[0];return {status:r.status,body:await r.json()};
  }
  async login() {const c=await this.request('/api/auth/challenge',{address:this.address});assert.equal(c.status,200);const signature=await wallet.signMessage({account:this.address,message:c.body.message});const verified=await this.request('/api/auth/verify',{...c.body,signature});assert.equal(verified.status,200);return verified.body;}
  async post(path:string,body:object={}) {const r=await this.request('/api/workbench/'+path,body);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;}
  async get(path:string) {const r=await this.request('/api/workbench/'+path);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;}
}
const op=new Session(operator),user=new Session(investor),review=new Session(reviewer),other=new Session(outsider);
assert.equal((await op.login()).user.role,'OPERATOR');await user.login();await other.login();
await op.post('members',{address:reviewer,role:'REVIEWER',ownStore:false});assert.equal((await review.login()).user.role,'REVIEWER');
const checks:string[]=[];
const concurrentAddresses=(await wallet.getAddresses()).filter(address=>address!==operator&&address!==reviewer);
for(const address of concurrentAddresses) {const hash=await wallet.writeContract({account:operator,address:dojang.scroll,abi:mock.abi,functionName:'setVerified',args:[address,dojang.faucetAttester,true]});await publicClient.waitForTransactionReceipt({hash});}
await rpc('anvil_mine',['0x40']);
const concurrentOffering=await op.post('reset');await op.post('background');
const concurrentSessions=concurrentAddresses.map(address=>new Session(address));await Promise.all(concurrentSessions.map(session=>session.login()));
const concurrentResults=await Promise.all(concurrentSessions.map(session=>session.request(`/api/workbench/offerings/${concurrentOffering.id}/subscribe`,{units:30,requestKey:crypto.randomUUID(),understood:true})));
assert.equal(concurrentResults.filter(result=>result.status===200).length,4);assert.ok(concurrentResults.every(result=>[200,409].includes(result.status)));
await op.post(`offerings/${concurrentOffering.id}/allocate`);const concurrentDashboard=await op.get('dashboard');assert.equal(concurrentDashboard.all_holdings.reduce((total:number,holding:any)=>total+holding.units,0),3600);assert.equal(concurrentDashboard.all_subscriptions.reduce((total:number,subscription:any)=>total+subscription.refunded_units,0),20);
checks.push(`${concurrentSessions.length} simultaneous subscriptions: 4 accepted, cap 3,600, 20 units refunded after partial allocation`);
const o=await op.post('reset');
const normal=await readFile('fixtures/normal.csv','utf8');const evidence=await op.post('evidence',{offeringId:o.id,period:'2026-10',filename:'normal.csv',csv:normal});assert.equal(evidence.report.netWon,'30000000');assert.equal(evidence.report.issues.length,2);checks.push('CSV duplicate and partial-refund reconciliation -> net 30,000,000');
assert.equal((await op.request(`/api/workbench/evidence/${evidence.id}/close`,{reason:'self approval'})).status,409);assert.equal((await user.request(`/api/workbench/evidence/${evidence.id}`)).status,403);await review.post(`evidence/${evidence.id}/close`,{reason:'別 지갑 검토'});checks.push('separate submitter/reviewer and evidence privacy');
await op.post('background');const requestKey=crypto.randomUUID();const subscription=await user.post(`offerings/${o.id}/subscribe`,{units:120,requestKey,understood:true});const duplicate=await user.post(`offerings/${o.id}/subscribe`,{units:120,requestKey,understood:true});assert.equal(subscription.id,duplicate.id);assert.equal((await user.get('dashboard')).holdings.length,0);
assert.equal((await other.request(`/api/workbench/offerings/${o.id}/subscribe`,{units:1,requestKey:crypto.randomUUID(),understood:true})).status,409);await op.post(`offerings/${o.id}/allocate`);const allotted=await user.get('dashboard');assert.equal(allotted.holdings[0].units,100);assert.equal(allotted.subscriptions[0].refunded_units,20);checks.push('idempotent subscription; no holding before allocation; 120 requested -> 100 allocated + 20 simulated refund');
const s=await review.post('settlements',{evidenceId:evidence.id,reason:'월 정산 산정'});assert.equal(s.pool_won,'900000');assert.equal((await review.request(`/api/workbench/settlements/${s.id}/approve`,{reason:'self'})).status,409);await op.post(`settlements/${s.id}/approve`,{reason:'별도 승인'});
const mine=await user.get(`settlements/${s.id}`);assert.equal(mine.lines[0].amount_won,'25000');assert.equal((await other.request(`/api/workbench/settlements/${s.id}`)).status,403);checks.push('900,000 pool / 25,000 per 100 units; approval separation; private statement');
const statement=await user.get(`settlements/${s.id}/statement`);assert.equal(statement.netSalesWon,'30000000');assert.equal(statement.unpaidWon,'25000');assert.equal(statement.evidenceStatus,'CLOSED');assert.equal((await other.request(`/api/workbench/settlements/${s.id}/statement`)).status,403);checks.push('model-independent personal calculation evidence and statement privacy');
const unitsBuild=JSON.parse(await readFile('contracts/out/UpDishDemoUnits.sol/UpDishDemoUnits.json','utf8'));const registryBuild=JSON.parse(await readFile('contracts/out/SettlementRegistry.sol/SettlementRegistry.json','utf8'));
async function deploy(build:any,args:unknown[]) {const hash=await wallet.deployContract({account:operator,abi:build.abi,bytecode:build.bytecode.object,args});const receipt=await publicClient.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');await rpc('anvil_mine',['0x40']);return receipt.contractAddress!;}
const units=await deploy(unitsBuild,[operator,dojang.scroll,dojang.faucetAttester,BigInt(o.token_id),3600n]);const registry=await deploy(registryBuild,[operator]);await op.post('contracts',{unitsAddress:units,registryAddress:registry});checks.push('compiled contract deployment and Java runtime/immutable/owner/attester validation');
let dash=await op.get('dashboard');const receipts=[];
for(const job of dash.all_jobs) {const ready=await op.post(`jobs/${job.id}/prepare`);const hash=await wallet.sendTransaction({account:operator,to:ready.target as Address,data:ready.calldata as Hex});await publicClient.waitForTransactionReceipt({hash});await rpc('anvil_mine',['0x40']);const result=await op.post(`jobs/${job.id}/transaction`,{hash});assert.equal(result.status,'SAFE',JSON.stringify(result));receipts.push({kind:job.kind,hash,status:result.status});}
dash=await user.get('dashboard');assert.equal(dash.holdings[0].chain_units,100);const balance=await publicClient.readContract({address:units,abi:unitsBuild.abi as Abi,functionName:'balanceOf',args:[investor,BigInt(o.token_id)]});assert.equal(balance,100n);checks.push('wallet transaction -> receipt -> safe state -> DB/onchain balance 100; settlement record');
assert.equal((await op.post(`settlements/${s.id}/digest`,{tamper:false})).matches,true);assert.equal((await op.post(`settlements/${s.id}/digest`,{tamper:true})).matches,false);checks.push('canonical salted digest and altered candidate mismatch');
const line=mine.lines[0];const paymentKey=crypto.randomUUID();const payment=await op.post(`lines/${line.id}/pay`,{amountWon:25000,outcome:'SUCCESS',requestKey:paymentKey});assert.equal((await op.post(`lines/${line.id}/pay`,{amountWon:25000,outcome:'SUCCESS',requestKey:paymentKey})).id,payment.id);assert.equal((await op.request(`/api/workbench/lines/${line.id}/pay`,{amountWon:1,outcome:'SUCCESS',requestKey:crypto.randomUUID()})).status,409);checks.push('payment idempotency and unpaid-balance bound');
assert.equal((await user.request(`/api/workbench/settlements/${s.id}/explain`,{question:'내 금액 근거'})).status,503);checks.push('unconfigured model is unavailable, never a fake answer');
await wallet.writeContract({account:operator,address:dojang.scroll,abi:mock.abi,functionName:'setVerified',args:[investor,dojang.faucetAttester,false]});assert.equal(await publicClient.readContract({address:units,abi:unitsBuild.abi,functionName:'balanceOf',args:[investor,BigInt(o.token_id)]}),100n);checks.push('revocation preserves previously minted holdings');
const report={checkedAt:new Date().toISOString(),scope:'LOCAL_ANVIL_ONLY: direct Core HTTP, dedicated database, test wallets, mock Dojang, real UpDish contracts and database. No GIWA transactions.',checks,receipts,userWalletTransactions:0};await writeFile('docs/evidence/business-local-e2e.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
