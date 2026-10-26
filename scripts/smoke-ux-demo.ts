import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createWalletClient,http,type Address} from 'viem';
import {giwaSepolia} from '../packages/chain-config/giwa';
import type {components} from '../apps/web/lib/api.generated';
const origin='http://127.0.0.1:3001';
const rpc=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'web3_clientVersion',params:[]})});
assert.match((await rpc.json()).result,/anvil/i,'Only the isolated local rehearsal is permitted');
const wallet=createWalletClient({chain:giwaSepolia,transport:http('http://127.0.0.1:8545')});
const [operator,investor]=await wallet.getAddresses();
class Session {
  cookie='';constructor(readonly address:Address){}
  async request(path:string,body?:object):Promise<{status:number;body:any}>{
    const headers:Record<string,string>={Cookie:this.cookie};
    if(body){const c=await this.request('/api/auth/csrf');headers.Cookie=this.cookie;headers.Origin=origin;headers['Content-Type']='application/json';headers[c.body.headerName]=c.body.token;}
    const r=await fetch(origin+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
    for(const cookie of r.headers.getSetCookie())if(cookie.startsWith('UPDISH_SESSION='))this.cookie=cookie.split(';')[0];
    return {status:r.status,body:await r.json()};
  }
  async login(){const c=await this.request('/api/auth/challenge',{address:this.address});assert.equal(c.status,200);const signature=await wallet.signMessage({account:this.address,message:c.body.message});const result=await this.request('/api/auth/verify',{...c.body,signature});assert.equal(result.status,200);return result.body;}
  async get<T>(path:string){const r=await this.request(path);assert.equal(r.status,200,JSON.stringify(r.body));return r.body as T;}
}
const checks:string[]=[];const endpoint='/api/workbench/demo-data';
assert.equal((await fetch(origin+endpoint)).status,401);checks.push('Anonymous request cannot access the fixture account data');
const op=new Session(operator),user=new Session(investor);
assert.equal((await op.login()).user.role,'OPERATOR');await user.login();
assert.equal((await user.request(endpoint)).status,403);assert.equal((await user.request(endpoint+'/personas/operator')).status,403);checks.push('Regular signed user cannot select synthetic operator/personas');
const before=await op.get<any>('/api/workbench/dashboard');
const data=await op.get<components['schemas']['UxDemoDataset']>(endpoint);
assert.equal(data.source,'SYNTHETIC_UX_FIXTURE');assert.equal(data.mode,'SIMULATION');assert.equal(data.stores.length,8);assert.equal(data.offerings.length,8);assert.equal(data.revenues.length,48);assert.equal(data.benefits.length,8);checks.push('Operator reads the seeded PostgreSQL snapshot with eight stores and 48 monthly sales records');
const views:Record<string,components['schemas']['UxPersonaView']>={};
for(const p of data.personas.filter(p=>p.selectable&&p.id!=='customer-only')){
  const v=await op.get<components['schemas']['UxPersonaView']>(endpoint+'/personas/'+p.id);views[p.id]=v;
  assert.deepEqual(v.availableSections.slice(0,2),['MARKET','INVESTMENTS']);assert.equal(v.market.stores.length,8);
  for(const key of ['subscriptions','holdings','lines','payments'] as const)assert.ok(v.portfolio[key].every(row=>row.personaId===p.id));
  assert.equal('customerBenefits' in v,false);assert.ok(!v.persona.roles.includes('CUSTOMER'));assert.ok(v.availableSections.includes('TRANSPARENCY'));
  assert.ok(v.storeManagement.stores.every(s=>s.ownerPersonaId===p.id));
}checks.push('All six active personas receive scoped portfolio and store-management data');
assert.equal(views['investor-new'].portfolio.holdings.length,0);assert.equal(views['investor-active'].portfolio.holdings.length,4);assert.equal((await op.request(endpoint+'/personas/customer-only')).status,404);checks.push('New investor empty state and existing multi-store portfolio are distinct');
assert.equal(views['merchant-seongsu'].storeManagement.stores.length,1);assert.equal(views['merchant-group'].storeManagement.stores.length,7);checks.push('Single-store and multi-store merchants retain separate ownership scopes');
assert.ok(views['investor-active'].portfolio.lines.some(l=>BigInt(l.overpaidWon)>0n));assert.ok(views['investor-active'].portfolio.lines.some(l=>BigInt(l.unpaidWon)>0n));checks.push('Correction overpayment and partially unpaid/matured claims remain visible');
assert.equal(views['reviewer'].reviewQueue.length,5);assert.equal(views['reviewer'].operations.settlements.length,0);assert.equal(views['operator'].operations.settlements.length,7);checks.push('Reviewer and operator example sections have different datasets');
assert.equal((await op.request(endpoint+'/personas/background')).status,404);assert.equal((await op.request(endpoint+'/personas/unknown')).status,404);checks.push('Background participant and unknown IDs cannot be selected as login personas');
const after=await op.get<any>('/api/workbench/dashboard');assert.equal(after.offering.id,before.offering.id);
for(const key of ['all_subscriptions','all_holdings','all_settlements','all_jobs','events'])assert.deepEqual(after[key],before[key]);
assert.equal((await op.get<any>('/api/auth/session')).user.role,'OPERATOR');checks.push('Preview reads do not change active offering, real ledger, jobs or actual account role');
assert.ok(data.holdings.every(h=>h.chainUnits===0&&h.chainStatus==='NOT_SUBMITTED'));checks.push('Synthetic holdings do not claim real GIWA balances or transactions');
const report={checkedAt:new Date().toISOString(),scope:'LOCAL_ANVIL_ONLY: signed SIWE -> Web BFF -> Core -> dedicated PostgreSQL fixture table. No wallet transaction, cloud data modification, model call or UX/tab changes.',datasetId:data.datasetId,sourceSha256:data.sourceSha256,checks,counts:{stores:data.stores.length,offerings:data.offerings.length,personas:data.personas.filter(p=>p.selectable&&p.id!=='customer-only').length,subscriptions:data.subscriptions.length,holdings:data.holdings.length,revenues:data.revenues.length,settlements:data.settlements.length,benefits:data.benefits.length,claims:data.claims.length},transactionsSent:0};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
