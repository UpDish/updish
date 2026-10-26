async(page)=>{
  const origin='https://updish-hackathon-20261025-betaplayers-projects.vercel.app';if(new URL(page.url()).origin!==origin)throw Error('Canonical release only');
  const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));function check(v,m){if(!v)throw Error(m);checks.push(m);}
  await page.getByRole('heading',{name:'UpDish에 로그인',exact:true}).waitFor();await page.getByRole('button',{name:'지갑 선택하고 연결',exact:true}).waitFor();
  check(await page.getByRole('navigation',{name:'주 메뉴'}).count()===0,'Production starts at wallet login, with private role menus hidden');
  await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'docs/evidence/ux-journey/production-login-desktop.png'});
  for(const path of ['market','investments','benefits'])check((await page.request.get(origin+'/api/workbench/'+path)).status()===401,`Anonymous ${path} stays session protected`);
  const catalog=await page.request.get(origin+'/samples/catalog.json');check(catalog.status()===200&&(await catalog.json()).scenarios.length===9,'Existing nine CSV samples remain available after the navigation release');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/evidence/ux-journey/production-login-mobile.png'});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Production mobile login fits viewport');
  check(errors.length===0,'Production login has no browser runtime errors');
  return {checkedAt:new Date().toISOString(),origin,scope:'Read-only guest browser checks on actual Vercel release. Signed public HTTP verification is recorded separately; no user wallet signature/transaction or model call.',checks,errors};
}
