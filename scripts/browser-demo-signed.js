async(page)=>{
const checks=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));function assert(v,m){if(!v)throw new Error(m);checks.push(m);}
  await page.addInitScript(()=>{
    if(location.origin!=='http://127.0.0.1:3001')return;
    let index=0;const listeners=new Map();
    async function rpc(method,params=[]) {const r=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const b=await r.json();if(b.error){const e=new Error(b.error.message);e.code=b.error.code;throw e;}return b.result;}
    window.updishRehearsalSwitch=async next=>{index=next;const accounts=await rpc('eth_accounts');for(const listener of listeners.get('accountsChanged')??[])listener([accounts[index]]);};
    window.ethereum={isMetaMask:true,isUpDishLocalRehearsal:true,async request({method,params=[]}){if(['eth_accounts','eth_requestAccounts'].includes(method))return [(await rpc('eth_accounts'))[index]];if(['wallet_requestPermissions','wallet_getPermissions'].includes(method))return [{parentCapability:'eth_accounts',caveats:[{type:'restrictReturnedAccounts',value:[(await rpc('eth_accounts'))[index]]}]}];return rpc(method,params);},on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);return this;},removeListener(event,fn){listeners.get(event)?.delete(fn);return this;}};
  });

  const origin='http://127.0.0.1:3001';
  await page.goto(origin);await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'지갑 로그인',exact:true}).click();await page.getByRole('button',{name:'지갑 선택하고 연결',exact:true}).click();await page.getByRole('button',{name:'MetaMask',exact:true}).click();await page.getByRole('button',{name:'서명하고 로그인',exact:true}).click();await page.getByText('로그인 완료 · 운영자',{exact:true}).waitFor();checks.push('Local operator signs SIWE through standard wallet modal');
  async function switchTo(index,role){await page.evaluate(i=>window.updishRehearsalSwitch(i),index);await page.getByRole('button',{name:/^(내 지갑|지갑 로그인)$/}).click();await page.getByRole('button',{name:'서명하고 로그인',exact:true}).click();await page.getByText(`로그인 완료 · ${role}`,{exact:true}).waitFor();}
  await page.getByRole('button',{name:'매출관리',exact:true}).click();await page.getByRole('heading',{name:'흐름 점검용 샘플 CSV',exact:true}).waitFor();
  const catalog=await(await page.request.get(origin+'/samples/catalog.json')).json();const evidence={};
  for(const s of catalog.scenarios){
    if(s.workflow)await page.locator('.demo-samples').getByRole('button',{name:s.label,exact:true}).click();
    else{await page.getByLabel('월별 매출 샘플',{exact:true}).selectOption(s.id);await page.getByRole('button',{name:'선택 월 CSV 불러오기',exact:true}).click();}
    await page.getByLabel('제출할 내용 · '+s.filename,{exact:true}).waitFor();assert(await page.locator('#period').inputValue()===s.period,`${s.id}: sample loads its own month`);
    const [response]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/workbench/evidence')&&r.request().method()==='POST'),page.getByRole('button',{name:'CSV 제출 · 서버 대조',exact:true}).click()]);
    assert(response.status()===200,`${s.id}: browser CSV -> BFF -> Core -> DB`);const e=await response.json();evidence[s.id]=e;
    assert(e.report.netWon===s.expectedNetWon&&e.report.ready===s.ready,`${s.id}: real reconciliation matches catalog expectation`);
    if(!s.ready)assert(e.status==='BLOCKED',`${s.id}: missing bank blocks review/settlement`);
  }
  await page.getByLabel('월별 매출 샘플',{exact:true}).selectOption('history-2026-05');await page.getByText(/선택한 월은 계약 시작 전의 참고 매출/).waitFor();checks.push('Pre-contract history is identified as reference sales');
  await page.screenshot({path:'output/playwright/demo-merchant-desktop.png'});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Merchant scenario cards fit 390px');await page.locator('.demo-samples').scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/demo-merchant-mobile.png'});await page.setViewportSize({width:1440,height:900});
  await switchTo(2,'검토자');await page.getByRole('button',{name:'매출관리',exact:true}).click();assert(await page.locator('.demo-samples').count()===0,'Reviewer still has no source submission controls');await page.locator('#review-reason').fill('더미 CSV 흐름 점검');
  const may=page.locator('.evidence-report').filter({hasText:'history-2026-05.csv'});await may.getByRole('button',{name:'대조 검토 · 마감',exact:true}).click();await may.getByRole('button',{name:'이 근거로 정산 산정',exact:true}).waitFor();
  const [blocked]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/workbench/settlements')&&r.request().method()==='POST'),may.getByRole('button',{name:'이 근거로 정산 산정',exact:true}).click()]);assert(blocked.status()===409,'Pre-contract sample is reconciled but actual settlement remains blocked');
  const correction=page.locator('.evidence-report').filter({hasText:'correction.csv'});await correction.getByRole('button',{name:'대조 검토 · 마감',exact:true}).click();await correction.getByRole('button',{name:'이 근거로 정산 산정',exact:true}).waitFor();
  const [calculated]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/workbench/settlements')&&r.request().method()==='POST'),correction.getByRole('button',{name:'이 근거로 정산 산정',exact:true}).click()]);assert(calculated.status()===200,'Different reviewer closes and calculates corrected October CSV');const revised=await calculated.json();
  await switchTo(0,'운영자');await page.getByRole('button',{name:'검토·운영',exact:true}).click();const item=page.locator('.evidence-report').filter({hasText:'2026-10 · v2'});const [approved]=await Promise.all([page.waitForResponse(r=>r.url().endsWith(`/settlements/${revised.id}/approve`)),item.getByRole('button',{name:'다른 지갑으로 검토 · 승인',exact:true}).click()]);assert(approved.status()===200,'Separate operator approves real corrected settlement');
  await page.getByRole('button',{name:'청약',exact:true}).click();await page.getByRole('cell',{name:'29,000,000원',exact:true}).waitFor();assert(await page.getByRole('button',{name:'승인 기록',exact:true}).getAttribute('aria-pressed')==='true','Existing approved records take priority over sample defaults');assert(await page.locator('.performance-table tbody tr').count()===1,'Approved chart contains only October v2, no seeded history approvals');
  await switchTo(1,'투자자');await page.getByRole('button',{name:'청약',exact:true}).click();await page.getByRole('button',{name:'내 정산액',exact:true}).click();await page.getByRole('cell',{name:'24,167원',exact:true}).waitFor();checks.push('Investor private approved chart remains 24,167 won');await page.getByRole('button',{name:'샘플 CSV',exact:true}).click();assert(await page.getByRole('button',{name:'내 정산액',exact:true}).count()===0,'Samples cannot impersonate a private investor settlement');
  assert(errors.length===0,'No page runtime errors');return {checkedAt:new Date().toISOString(),scope:'LOCAL_ANVIL_ONLY with dedicated DB; real browser -> BFF -> Core CSV submission, role separation and settlement. No user-wallet or live GIWA transactions.',checks,errors};

}
