async (page) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const dir='output/playwright/';const checks=[];
  function assert(condition,message){if(!condition)throw new Error(message);checks.push(message);}
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('heading',{name:'성수 모퉁이 식당',exact:true}).waitFor();
  await page.setViewportSize({width:1440,height:900});await page.screenshot({path:dir+'market-desktop.png'});
  const search=page.getByRole('searchbox',{name:'상품 검색'});
  await search.fill('없는 상품');assert(await page.getByText('조건에 맞는 상품이 없습니다.',{exact:true}).isVisible(),'Search empty state');
  await search.fill('');await page.getByRole('button',{name:'모집 종료',exact:true}).click();assert(await page.getByText('조건에 맞는 상품이 없습니다.',{exact:true}).isVisible(),'Closed status filter');
  await page.getByRole('button',{name:'전체',exact:true}).click();assert(await page.getByRole('button',{name:'성수 모퉁이 식당 상품 정보 보기'}).isVisible(),'Restore current product');
  await page.getByRole('button',{name:'200단위',exact:true}).click();assert(await page.locator('#units').inputValue()==='200','Quantity preset retains 200 units');
  await page.getByRole('tab',{name:'수령액 계산',exact:true}).click();assert(await page.getByText('50,000원',{exact:true}).isVisible(),'200 units -> 50,000 won hypothetical monthly amount');
  await page.getByRole('button',{name:'2,400만원',exact:true}).click();assert(await page.getByText('40,000원',{exact:true}).isVisible(),'24m scenario -> 40,000 won');
  await page.locator('#units').fill('0');assert(await page.locator('#units').getAttribute('aria-invalid')==='true','Invalid zero quantity');
  await page.locator('#units').fill('100');await page.getByRole('button',{name:'3,000만원',exact:true}).click();
  await page.getByRole('tab',{name:'상품 정보',exact:true}).focus();await page.keyboard.press('ArrowRight');assert(await page.getByRole('tab',{name:'수령액 계산'}).getAttribute('aria-selected')==='true','Keyboard arrow navigation');
  await page.getByRole('tab',{name:'위험 안내',exact:true}).click();assert(await page.getByText('중도 이전 제한',{exact:true}).isVisible(),'Risk tab');
  await page.getByRole('tab',{name:'상품 정보',exact:true}).click();
  await page.setViewportSize({width:768,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'768px no document overflow');await page.screenshot({path:dir+'market-tablet.png'});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px no document overflow');await page.screenshot({path:dir+'market-mobile.png'});
  await page.getByRole('link',{name:'청약 입력',exact:true}).click();assert(await page.locator('#units').isVisible(),'Mobile jump to subscription');await page.screenshot({path:dir+'order-mobile.png'});
  await page.getByRole('button',{name:'지갑 연결하고 로그인',exact:true}).click();await page.getByRole('heading',{name:'지갑으로 로그인',exact:true}).waitFor();checks.push('Guest primary action opens wallet');await page.screenshot({path:dir+'wallet-mobile.png'});
  await page.getByRole('button',{name:'투자내역',exact:true}).click();assert(await page.getByRole('heading',{name:'내 지갑으로 로그인해 주세요.',exact:true}).isVisible(),'Private portfolio locked');
  await page.getByRole('button',{name:'매출관리',exact:true}).click();assert(await page.getByRole('heading',{name:'매출 증빙 자료 제출',exact:true}).isVisible(),'Merchant entry explained');assert(await page.locator('#csv-file').count()===0,'Anonymous cannot submit CSV');
  await page.getByRole('button',{name:'청약',exact:true}).click();await page.setViewportSize({width:1440,height:900});
  assert(errors.length===0,'No browser runtime errors');
  return {checkedAt:new Date().toISOString(),origin:'http://127.0.0.1:3000',checks,errors,transactions:0};
}
