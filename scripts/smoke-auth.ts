import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { parseSiweMessage } from 'viem/siwe';

// Disposable, unfunded test signer. Never reads a user key or submits a transaction.
const account = privateKeyToAccount(generatePrivateKey());
const origin = process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3000';
const directCore = process.env.API_BASE_URL;
let cookie = '';
async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set('Cookie', cookie);
  const url=directCore ? directCore+path.replace(/^\/api\//,'/api/v1/') : origin+path;
  const response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(45_000) });
  for (const value of response.headers.getSetCookie()) {
    if (value.startsWith('UPDISH_SESSION=')) cookie = value.split(';')[0];
  }
  return { status: response.status, body: await response.json(), headers: response.headers };
}
async function csrf() { return (await request('/api/auth/csrf')).body.token as string; }
async function post(path: string, body: unknown, token?: string, requestOrigin = origin) {
  return request(path, { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json',
    ...(token ? { 'X-CSRF-TOKEN': token } : {}) }, body: JSON.stringify(body) });
}
const checks: string[] = [];
assert.equal((await request('/api/me/dojang')).status, 401); checks.push('protected Dojang requires session');
assert.equal((await request('/api/workbench/demo-data')).status,401); checks.push('UX fixture accounts require an authenticated operator');
assert.equal((await post('/api/auth/challenge', { address: account.address })).status, 403); checks.push('CSRF required');
let token = await csrf();
assert.equal((await post('/api/auth/challenge', { address: account.address }, token, 'https://evil.example')).status, 403);
checks.push(directCore?'Core rejects foreign Origin':'BFF rejects foreign Origin');
const c = await post('/api/auth/challenge', { address: account.address }, token);
assert.equal(c.status, 200);
const parsed = parseSiweMessage(c.body.message);
assert.equal(parsed.domain, new URL(origin).host); assert.equal(parsed.chainId, 91342); assert.equal(parsed.uri, origin);
assert.equal(parsed.scheme, new URL(origin).protocol.slice(0, -1));
assert.equal(parsed.address?.toLowerCase(), account.address.toLowerCase());
checks.push('EIP-4361 canonical domain, URI, chain, address');
const payload = { ...c.body, signature: await account.signMessage({ message: c.body.message }) };
const other = privateKeyToAccount(generatePrivateKey());
assert.equal((await post('/api/auth/verify', { ...payload, signature: await other.signMessage({ message: c.body.message }) }, token)).status, 401);
checks.push('wrong signer rejected');
const oldCookie = cookie;
const verified = await post('/api/auth/verify', payload, token);
assert.equal(verified.status, 200); assert.equal(verified.body.user.role, 'INVESTOR');
assert.equal(verified.body.user.address, account.address.toLowerCase()); assert.notEqual(cookie, oldCookie);
assert.match(verified.headers.get('set-cookie') ?? '', /HttpOnly/i);
assert.match(verified.headers.get('set-cookie') ?? '', /SameSite=Lax/i);
if(origin.startsWith('https://')) assert.match(verified.headers.get('set-cookie')??'', /; Secure/i);
checks.push('viem signature accepted by Java; session ID rotated; HttpOnly SameSite cookie; server role');
assert.equal((await request('/api/auth/session')).body.authenticated, true); checks.push('login persists across HTTP requests');
token = await csrf();
assert.equal((await post('/api/auth/verify', payload, token)).status, 401); checks.push('nonce replay rejected');
const dojang = await request('/api/me/dojang');
assert.equal(dojang.status, 200); assert.equal(dojang.body.address, account.address.toLowerCase());
assert.equal(dojang.body.verified, false); assert.equal(dojang.body.attester, 'TESTNET FAUCET');
checks.push('authenticated wallet -> Spring -> live GIWA safe block -> Dojang negative result');
const dashboard=await request('/api/workbench/dashboard');
assert.equal(dashboard.status,200);assert.equal(dashboard.body.user.address,account.address.toLowerCase());
assert.equal(dashboard.body.user.role,'INVESTOR');assert.equal(dashboard.body.all_lines,undefined);
checks.push('authenticated dashboard returns own wallet scope without operator statements');
assert.equal((await request('/api/workbench/demo-data')).status,403);
assert.equal((await request('/api/workbench/demo-data/personas/operator')).status,403);
checks.push('regular signed account cannot read fixture personas or select operator preview');
const market=await request('/api/workbench/market');assert.equal(market.status,200);assert.equal(market.body.listings.length,8);assert.ok(market.body.listings.every((l:any)=>!l.persona&&!l.claims));checks.push('ordinary signed wallet reads eight store listings without fixture account data');
const investments=await request('/api/workbench/investments');assert.equal(investments.status,200);assert.equal(investments.body.subscriptions.length,0);assert.equal(investments.body.holdings.length,0);assert.equal(investments.body.settlements.length,0);checks.push('new wallet has its own empty cross-store investment history');
const benefits=await request('/api/workbench/benefits');assert.equal(benefits.status,200);assert.equal(benefits.body.benefits.length,8);assert.ok(benefits.body.benefits.every((b:any)=>b.claim===null));checks.push('benefits expose eligibility without another wallet coupon');
// Direct Core has a separate public route; the deployed BFF uses /api/offering.
if(!directCore) {const offering=await request('/api/offering');assert.equal(offering.status,200);assert.equal(offering.body.mode,'SIMULATION');checks.push('public offering is backed by live Core business data');}
assert.equal((await post('/api/auth/logout', {}, token)).status, 200);
assert.equal((await request('/api/auth/session')).body.authenticated, false);
assert.equal((await request('/api/me/dojang')).status, 401); checks.push('logout invalidates session');
for(const path of ['market','investments','benefits'])assert.equal((await request('/api/workbench/'+path)).status,401);checks.push('market, investments and benefits require login after logout');
const report = { checkedAt: new Date().toISOString(), scope: directCore?'Direct Core HTTPS SIWE with ephemeral unfunded EOA; PostgreSQL and live GIWA read. Web BFF not included.':(origin.startsWith('https://')?'Deployed Vercel BFF -> EC2 Core -> PostgreSQL -> live GIWA; ephemeral unfunded EOA. No user-wallet transaction.':'Local full-stack SIWE with ephemeral unfunded EOA; live GIWA read. No user-wallet transaction.'),origin,
  checks, dojang: { address: dojang.body.address, verified: dojang.body.verified, blockNumber: dojang.body.blockNumber, blockTag: dojang.body.blockTag },
  userWalletIssueRevoke: 'PENDING_USER_SIGNATURE', transactionsSent: 0 };
const output = process.argv[2];
if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
