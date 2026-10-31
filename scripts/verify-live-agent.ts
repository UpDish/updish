import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {createWalletClient,http,type Address} from 'viem';
import {giwaSepolia} from '../packages/chain-config/giwa';
const origin=process.env.WEB_ORIGIN??'http://127.0.0.1:3001';
const localPrivate=process.env.VERIFY_LOCAL_PRIVATE==='1';
const ephemeral=privateKeyToAccount(generatePrivateKey());
let address:Address=ephemeral.address;let sign=(message:string)=>ephemeral.signMessage({message});
if(localPrivate){
  assert.equal(origin,'http://127.0.0.1:3001');const r=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'web3_clientVersion',params:[]})});assert.match((await r.json()).result,/anvil/i);
  const wallet=createWalletClient({chain:giwaSepolia,transport:http('http://127.0.0.1:8545')});address=(await wallet.getAddresses())[1];sign=message=>wallet.signMessage({account:address,message});
}
let cookie='';
async function request(path:string,body?:object):Promise<{status:number;body:any}>{
  const headers:Record<string,string>={Cookie:cookie};if(body){const c=await request('/api/auth/csrf');headers.Cookie=cookie;headers.Origin=origin;headers['Content-Type']='application/json';headers[c.body.headerName]=c.body.token;}
  const r=await fetch(origin+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(65000)});for(const c of r.headers.getSetCookie())if(c.startsWith('UPDISH_SESSION='))cookie=c.split(';')[0];return {status:r.status,body:await r.json()};
}
const challenge=await request('/api/auth/challenge',{address});assert.equal(challenge.status,200);assert.equal((await request('/api/auth/verify',{...challenge.body,signature:await sign(challenge.body.message)})).status,200);
const status=await request('/api/workbench/agent/status');assert.equal(status.status,200);assert.equal(status.body.modelCalls,'CONFIGURED');
let path='/api/workbench/agent/chat',body:object={storeId:'store-mangwon',question:'은행 입금 자료가 없는 이 가게의 매출을 승인된 매출로 볼 수 있나요? 짧게 설명해 주세요.'};let expectedVersion:string|undefined;let allowed:string[]=[];
if(localPrivate){const portfolio=await request('/api/workbench/investments');const s=portfolio.body.settlements.find((s:any)=>s.status==='APPROVED');assert.ok(s);path=`/api/workbench/settlements/${s.id}/explain`;body={question:'원화 의무액, DEMO 수령량과 추가 분배 가능 수량, 원금 별도 상환 여부를 짧게 설명해 주세요.'};const statement=await request(`/api/workbench/settlements/${s.id}/statement`);expectedVersion=statement.body.dataVersion;allowed=[s.id,statement.body.evidenceId];}
else{const t=await request('/api/workbench/transparency/store-mangwon');assert.equal(t.status,200);allowed=['updish-demo-guide-v1','store-mangwon',...t.body.approved.slice(0,3).map((s:any)=>s.id),...t.body.samples.map((s:any)=>s.id)];}
const result=await request(path,body);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.mode,'SIMULATION');assert.ok(result.body.sourceIds.length>0);assert.ok(result.body.sourceIds.every((s:string)=>allowed.includes(s)));assert.ok(result.body.explanation.length>0);if(expectedVersion)assert.equal(result.body.dataVersion,expectedVersion);
if(!localPrivate)assert.ok(result.body.explanation.startsWith('현재 승인된 매출 원장은 없습니다.'),'Synthetic store sources must not be presented as an approved ledger');
assert.equal((await request('/api/auth/logout',{})).status,200);
const report={checkedAt:new Date().toISOString(),origin,scope:localPrivate?'Real model, own approved statement in isolated Anvil/PostgreSQL rehearsal; no GIWA transaction.':'Real deployed Vercel BFF -> EC2 Core -> FastAPI -> OpenAI, public synthetic store evidence, disposable unfunded SIWE account, no transaction.',status:'PASS',transactionsSent:0,answer:result.body};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
