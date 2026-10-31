async(page)=>{
  const origin='http://127.0.0.1:3001',checks=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  function check(value,message){if(!value)throw Error(message);checks.push(message);}
  const response=await page.request.post('http://127.0.0.1:8545',{data:{jsonrpc:'2.0',id:1,method:'web3_clientVersion',params:[]}});
  check(/anvil/i.test((await response.json()).result),'Isolated LOCAL ANVIL only; no real wallet provider');
  await page.addInitScript(()=>{
    if(location.origin!=='http://127.0.0.1:3001')return;
    let index=1;sessionStorage.setItem('updish-rehearsal-index','1');const listeners=new Map();
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
    const dialog=page.getByRole('dialog',{name:'UpDish에 로그인',exact:true});
    if(!await dialog.isVisible())await page.getByRole('button',{name:'UpDish 열기',exact:true}).click();await dialog.waitFor();
    const connect=dialog.getByRole('button',{name:'지갑 선택하고 연결',exact:true});
    if(await connect.count()){await connect.click();const pick=page.getByRole('button',{name:'MetaMask',exact:true});await Promise.race([pick.waitFor(),dialog.getByRole('button',{name:'서명하고 로그인',exact:true}).waitFor(),page.getByRole('heading',{name:'가게 탐색',exact:true}).waitFor()]);if(await pick.isVisible())await pick.click();}
    if(await page.getByRole('heading',{name:'가게 탐색',exact:true}).count())return;await dialog.getByRole('button',{name:'서명하고 로그인',exact:true}).click();await page.getByRole('heading',{name:'가게 탐색',exact:true}).waitFor();
  }
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('h1')).some(e=>e.textContent==='가게 탐색')||Array.from(document.querySelectorAll('button')).some(e=>e.textContent==='UpDish 열기'));
  if(await page.getByRole('button',{name:'UpDish 열기',exact:true}).count())await login();
  async function capture(name){await page.evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`output/playwright/upbit-ui/${name}.png`});}
  async function fits(label){check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label);}
  const nav=page.getByRole('navigation',{name:'주 메뉴'});
  await page.locator('.project-table tbody tr').first().waitFor();
  check(await page.locator('.project-table tbody tr').count()===8,'All eight synthetic stores are available after SIWE');
  check((await nav.getByRole('link').allTextContents()).join('|')==='가게 탐색|내 투자','Investor navigation still has exactly two tabs');
  check(await page.locator('.project-table tbody tr').first().evaluate(e=>e.getBoundingClientRect().height)<=68,'Desktop list uses compact exchange rows');
  await fits('1440px directory fits without horizontal overflow');await capture('01-directory-desktop');
  await page.getByLabel('가게 정렬',{exact:true}).selectOption('name');
  const names=await page.locator('.project-table .store-name b').allTextContents();
  check(names.join('|')===[...names].sort((a,b)=>a.localeCompare(b,'ko')).join('|'),'Name sorting actually changes the list order');
  await page.getByLabel('가게 정렬',{exact:true}).selectOption('default');
  await page.getByRole('button',{name:'모집 중',exact:true}).click();
  check(await page.locator('.project-table tbody tr').count()===3,'Open-only filter shows three real mock-ledger projects');
  await page.getByRole('searchbox',{name:'가게·프로젝트 검색',exact:true}).fill('연남');
  check(await page.locator('.project-table tbody tr').count()===1,'Search combines with the status filter');
  await page.getByRole('searchbox',{name:'가게·프로젝트 검색',exact:true}).fill('없는가게');
  await page.getByRole('heading',{name:'조건에 맞는 가게가 없습니다',exact:true}).waitFor();
  await page.getByRole('button',{name:'검색 초기화',exact:true}).click();
  await page.getByRole('button',{name:/성수 모퉁이/}).first().click();
  await page.getByRole('heading',{name:'성수 모퉁이 식당',exact:true}).waitFor();
  check(await page.getByRole('button',{name:'매출·대조',exact:true}).getAttribute('aria-pressed')==='true','Detail opens with the sales chart, not a wall of prose');
  await page.getByRole('button',{name:'본점 참고',exact:true}).click();
  await page.locator('.performance-plot .recharts-surface').waitFor();
  check(await page.getByText('본점의 참고 매출 · 가상 CSV',{exact:true}).count()===1,'Reference sales stay explicitly separate from approved second-store sales');
  check(await page.getByRole('navigation',{name:'가게 선택',exact:true}).getByRole('button').count()===8,'Desktop detail retains the eight-store market list');
  await fits('1440px chart workspace fits');await capture('02-detail-desktop');
  const watch=page.getByRole('navigation',{name:'가게 선택',exact:true});
  await page.getByRole('searchbox',{name:'다른 가게 검색',exact:true}).fill('연남');
  await watch.getByRole('button',{name:/연남 온기/}).click();await page.getByRole('heading',{name:'연남 온기 파스타',exact:true}).waitFor();
  check(await page.getByRole('searchbox',{name:'다른 가게 검색',exact:true}).inputValue()==='연남','Selecting another store preserves the market search');
  await page.getByRole('searchbox',{name:'다른 가게 검색',exact:true}).fill('');
  await watch.getByRole('button',{name:/성수 모퉁이/}).click();await page.getByRole('heading',{name:'성수 모퉁이 식당',exact:true}).waitFor();
  check(await watch.getByRole('button',{name:/성수 모퉁이/}).getAttribute('aria-pressed')==='true','Market selection changes the actual project and marks the selected row');
  await page.getByRole('button',{name:'확장 계획',exact:true}).click();await page.getByRole('heading',{name:'어디에 쓰이는 자금인가요?',exact:true}).waitFor();
  await page.getByRole('button',{name:'계약 조건',exact:true}).click();await page.getByRole('heading',{name:'계약 주요 조건',exact:true}).waitFor();
  await page.getByRole('button',{name:'투자 위험',exact:true}).click();await page.getByRole('heading',{name:'참여 전 확인하세요',exact:true}).waitFor();
  await page.getByRole('button',{name:'매출·대조',exact:true}).click();
  await page.getByRole('button',{name:'청약하기',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'청약 금액 입력',exact:true});await dialog.waitFor();
  await dialog.getByLabel('모의 청약 금액 · 원').fill('1000000');await capture('03-order-desktop');
  await dialog.getByRole('button',{name:'조건 확인',exact:true}).click();dialog=page.getByRole('dialog',{name:'청약 조건 확인',exact:true});await dialog.waitFor();
  check(await dialog.getByRole('button',{name:'모의 청약 신청',exact:true}).isDisabled(),'Risk agreement still gates order submission');
  await page.keyboard.press('Tab');check(await dialog.evaluate(e=>e.contains(document.activeElement)),'Native task dialog retains keyboard focus');
  await page.keyboard.press('Escape');check(await page.getByRole('button',{name:'청약하기',exact:true}).evaluate(e=>e===document.activeElement),'Escape returns focus to the order trigger');
  await page.getByRole('button',{name:'Agent',exact:true}).click();const dock=page.getByRole('dialog',{name:'UpDish Agent',exact:true});await dock.waitFor();
  check(await dock.getAttribute('aria-modal')==='false','Desktop Agent remains a non-modal sidebar');
  await page.getByRole('button',{name:'확장 계획',exact:true}).click();await fits('Desktop remains usable with the Agent sidebar');await capture('04-agent-desktop');
  await dock.getByRole('button',{name:'Agent 사이드바 닫기',exact:true}).click();
  await nav.getByRole('link',{name:'내 투자',exact:true}).click();await page.getByRole('heading',{name:'내 투자',exact:true}).waitFor();
  await capture('05-investments-desktop');
  for(const width of [768,390,360]){
    await page.setViewportSize({width,height:width===768?1024:844});
    await nav.getByRole('link',{name:'가게 탐색',exact:true}).click();await page.getByRole('heading',{name:'가게 탐색',exact:true}).waitFor();
    if(width<=600)check(await page.locator('.project-table .store-name').first().evaluate(e=>e.getBoundingClientRect().height)>=44,`${width}px store selection has a 44px touch target`);
    await fits(`${width}px directory fits`);await capture(`06-directory-${width}`);
    await page.getByRole('button',{name:/성수 모퉁이/}).first().click();await page.getByRole('heading',{name:'성수 모퉁이 식당',exact:true}).waitFor();
    await fits(`${width}px detail fits`);check(await page.locator('.mobile-invest-bar').isVisible(),`${width}px has a fixed investment action`);
    await capture(`07-detail-${width}`);await page.getByRole('button',{name:'청약하기',exact:true}).click();
    await page.getByRole('dialog',{name:'청약 금액 입력',exact:true}).waitFor();await fits(`${width}px order dialog fits`);await capture(`08-order-${width}`);await page.keyboard.press('Escape');
  }
  await page.getByRole('button',{name:'Agent',exact:true}).click();await dock.waitFor();
  check(await dock.getAttribute('aria-modal')==='true','Mobile Agent retains modal focus and navigation');await capture('09-agent-mobile');
  await dock.getByRole('button',{name:'Agent 사이드바 닫기',exact:true}).click();
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>window.updishRehearsalSwitch(0));
  await page.getByRole('button',{name:'UpDish 열기',exact:true}).waitFor();await login();
  await page.locator('.account-menu>summary').click();await page.getByRole('link',{name:'가게 콘솔',exact:true}).click();
  const consoleNav=page.getByRole('navigation',{name:'업무 콘솔 메뉴',exact:true});await consoleNav.waitFor();
  await page.getByRole('button',{name:'매출 CSV 제출',exact:true}).waitFor();check(await consoleNav.isVisible(),'Merchant console remains separate from investor navigation');
  await consoleNav.getByRole('link',{name:'정산·분배',exact:true}).click();await page.getByRole('button',{name:'시연 준비',exact:true}).waitFor();
  await fits('1440px operations console fits');await capture('10-console-desktop');
  await page.setViewportSize({width:390,height:844});await fits('390px operations console fits');await capture('11-console-mobile');
  check(await page.locator('.console-label').evaluate(e=>e.getBoundingClientRect().left-document.querySelector('.logo').getBoundingClientRect().right)>=8,'Mobile console label is spaced away from the logo');
  check(errors.length===0,'No browser runtime errors');
  return {checkedAt:new Date().toISOString(),scope:'Local Web -> real Core/PostgreSQL, isolated Anvil SIWE only. No user-wallet signature, order submission, or GIWA transaction.',checks,errors};
}
