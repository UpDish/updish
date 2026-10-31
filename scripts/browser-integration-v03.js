async(page)=>{
  const origin='http://127.0.0.1:3001',checks=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  function check(value,message){if(!value)throw Error(message);checks.push(message);}
  const response=await page.request.post('http://127.0.0.1:8545',{data:{jsonrpc:'2.0',id:1,method:'web3_clientVersion',params:[]}});
  check(/anvil/i.test((await response.json()).result),'Isolated LOCAL ANVIL only; no real wallet provider');
  await page.addInitScript(()=>{
    if(location.origin!=='http://127.0.0.1:3001')return;
    let index=Number(sessionStorage.getItem('updish-rehearsal-index')??1);const listeners=new Map();
    async function rpc(method,params=[]){const r=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const b=await r.json();if(b.error)throw Error(b.error.message);return b.result;}
    window.updishRehearsalSwitch=async next=>{index=next;sessionStorage.setItem('updish-rehearsal-index',String(next));const a=await rpc('eth_accounts');for(const f of listeners.get('accountsChanged')??[])f([a[index]]);};
    window.ethereum={isMetaMask:true,async request({method,params=[]}){
      if(['eth_accounts','eth_requestAccounts'].includes(method))return [(await rpc('eth_accounts'))[index]];
      if(['wallet_requestPermissions','wallet_getPermissions'].includes(method))return [{parentCapability:'eth_accounts',caveats:[{type:'restrictReturnedAccounts',value:[(await rpc('eth_accounts'))[index]]}]}];
      if(method==='wallet_switchEthereumChain')return null;
      const result=await rpc(method,params);if(method==='eth_sendTransaction')await rpc('anvil_mine',['0x40']);return result;
    },on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);return this;},removeListener(event,fn){listeners.get(event)?.delete(fn);return this;}};
  });
  page.setDefaultTimeout(15000);await page.goto(origin);await page.setViewportSize({width:1440,height:900});
  async function login(){
    await page.getByRole('button',{name:'UpDish 열기',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'UpDish에 로그인',exact:true});await dialog.waitFor();
    const connect=dialog.getByRole('button',{name:'지갑 선택하고 연결',exact:true});
    if(await connect.count()){await connect.click();const pick=page.getByRole('button',{name:'MetaMask',exact:true});await Promise.race([pick.waitFor(),dialog.getByRole('button',{name:'서명하고 로그인',exact:true}).waitFor(),page.getByRole('heading',{name:'가게 탐색',exact:true}).waitFor()]);if(await pick.isVisible())await pick.click();}
    if(await page.getByRole('heading',{name:'가게 탐색',exact:true}).count())return;await dialog.getByRole('button',{name:'서명하고 로그인',exact:true}).click();await page.getByRole('heading',{name:'가게 탐색',exact:true}).waitFor();
  }
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('h1')).some(e=>e.textContent==='가게 탐색')||Array.from(document.querySelectorAll('button')).some(e=>e.textContent==='UpDish 열기'));
  if(await page.getByRole('button',{name:'UpDish 열기',exact:true}).count())await login();
  async function capture(path){if(!await page.locator('dialog:modal').count())await page.evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path});}
  const nav=page.getByRole('navigation',{name:'주 메뉴'});
  check((await nav.getByRole('link').allTextContents()).join('|')==='가게 탐색|내 투자','Investor navigation has exactly two tabs');
  check(await page.getByRole('link',{name:'가게 콘솔',exact:true}).count()===0,'Investor has no merchant/operator navigation');
  await capture('output/playwright/integration-v03/market-desktop.png');
  await page.getByRole('button',{name:/성수 모퉁이/}).first().click();await page.getByRole('heading',{name:'성수 모퉁이 2호점 확장',exact:true}).waitFor();
  check(await page.getByText('1억', {exact:false}).count()>0||await page.getByText('100,000,000원',{exact:true}).count()>0,'Presentation fundraising goal is visible');
  await capture('output/playwright/integration-v03/project-desktop.png');
  await page.getByRole('button',{name:'매출·대조',exact:true}).click();await page.getByRole('button',{name:'본점 참고',exact:true}).click();await page.getByRole('heading',{name:'본점의 참고 매출',exact:true}).waitFor();
  await capture('output/playwright/integration-v03/revenue-desktop.png');checks.push('First-store reference sales are separated from approved second-store revenue');
  await nav.getByRole('link',{name:'내 투자',exact:true}).click();await page.getByRole('button',{name:'분배 내역',exact:true}).click();await page.getByRole('heading',{name:'테스트 자산 수령 내역',exact:true}).waitFor();
  await page.getByText('수령 확인',{exact:true}).first().waitFor();check(await page.getByText('30,000 DEMO',{exact:true}).count()>0,'Real local onchain receipt is displayed as DEMO');
  await page.locator('.receipt-chart .recharts-surface').waitFor();await capture('output/playwright/integration-v03/receipts-desktop.png');
  await page.getByRole('button',{name:'Agent',exact:true}).click();const dock=page.getByRole('dialog',{name:'UpDish Agent',exact:true});await dock.waitFor();
  await dock.locator('#agent-question').waitFor();await page.waitForFunction(()=>!document.querySelector('#agent-question').disabled);check(await dock.getAttribute('aria-modal')==='false','Desktop Agent is a non-modal IDE sidebar');await nav.getByRole('link',{name:'가게 탐색',exact:true}).click();check(await dock.isVisible(),'Main page remains usable with Agent open');
  await capture('output/playwright/integration-v03/agent-desktop.png');
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('#agent-dock')?.getAttribute('aria-modal')==='true');await capture('output/playwright/integration-v03/agent-mobile.png');
  await dock.getByRole('button',{name:'Agent 사이드바 닫기',exact:true}).click();check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px market fits viewport');await capture('output/playwright/integration-v03/market-mobile.png');
  await page.getByRole('button',{name:/성수 모퉁이/}).first().click();await capture('output/playwright/integration-v03/project-mobile.png');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px project detail fits viewport');
  await nav.getByRole('link',{name:'내 투자',exact:true}).click();await page.getByRole('button',{name:'분배 내역',exact:true}).click();await page.getByRole('heading',{name:'테스트 자산 수령 내역',exact:true}).waitFor();await capture('output/playwright/integration-v03/receipts-mobile.png');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px receipts fit viewport');
  check(errors.length===0,'No browser runtime errors');
  return {checkedAt:new Date().toISOString(),scope:'Local production Next BFF -> Core -> PostgreSQL/Anvil. Test-only injected provider; no user wallet or live GIWA transactions.',checks,errors};
}
