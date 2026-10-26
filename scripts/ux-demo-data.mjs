import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),check=process.argv.includes('--check');
const spec=JSON.parse(await readFile(new URL('fixtures/ux/spec.json',root),'utf8'));
if(spec.mode!=='SIMULATION'||spec.datasetId!==`updish-ux-v${spec.version}`||!Number.isInteger(spec.version)||spec.version<1||!/^\d{4}-\d{2}-\d{2}$/.test(spec.asOf))throw new Error('Invalid fixture identity');
if(new Set(spec.stores.map(s=>s.key)).size!==spec.stores.length)throw new Error('Duplicate store key');
for(const s of spec.stores)if(!/^[a-z0-9-]+$/.test(s.key)||!Number.isSafeInteger(s.targetUnits)||s.targetUnits<1||!Number.isSafeInteger(s.unitPriceWon)||s.unitPriceWon<1||!Number.isInteger(s.rateBps)||s.rateBps<0||s.rateBps>10000||s.monthlyNetWon.length!==6||s.monthlyNetWon.some(n=>!Number.isSafeInteger(n)||n<1))throw new Error('Invalid store fixture specification');
const months=['2026-05','2026-06','2026-07','2026-08','2026-09','2026-10'];
const outputs=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const personas=[
  {id:'investor-new',name:'처음 방문한 투자자',roles:['INVESTOR','CUSTOMER'],participation:'NOT_VERIFIED_SAMPLE'},
  {id:'investor-active',name:'여러 가게에 투자한 고객',roles:['INVESTOR','CUSTOMER'],participation:'ELIGIBLE_SAMPLE'},
  {id:'merchant-seongsu',name:'성수 가게 관리자',roles:['MERCHANT','INVESTOR','CUSTOMER'],participation:'ELIGIBLE_SAMPLE'},
  {id:'merchant-group',name:'여러 가게의 관리자',roles:['MERCHANT','CUSTOMER'],participation:'NOT_VERIFIED_SAMPLE'},
  {id:'customer-only',name:'혜택을 이용하는 고객',roles:['CUSTOMER'],participation:'NOT_VERIFIED_SAMPLE'},
  {id:'reviewer',name:'증빙 검토 담당자',roles:['REVIEWER'],participation:'NOT_APPLICABLE_SAMPLE'},
  {id:'operator',name:'시연 운영자',roles:['OPERATOR'],participation:'NOT_APPLICABLE_SAMPLE'},
  {id:'background',name:'가상 배경 참여자',roles:[],participation:'NOT_APPLICABLE_SAMPLE',selectable:false},
].map(p=>({...p,selectable:p.selectable??true,synthetic:true}));
const stores=spec.stores.map(s=>({id:`store-${s.key}`,name:s.name,district:s.district,category:s.category,ownerPersonaId:s.ownerPersonaId,description:`${s.category} 매장을 가정한 UX 시연용 가상 가게입니다. 실제 업체·주소·매출과 무관합니다.`,synthetic:true}));
const offerings=spec.stores.map(s=>({id:`offering-${s.key}`,storeId:`store-${s.key}`,title:`${s.name} 매출배분 1호`,status:s.status,targetUnits:s.targetUnits,unitPriceWon:String(s.unitPriceWon),targetWon:String(BigInt(s.targetUnits)*BigInt(s.unitPriceWon)),rateBps:s.rateBps,months:s.months,startsOn:s.startsOn,principalRedemption:'만기 원금 별도 상환 의무 없음',acceptedUnits:0,synthetic:true}));
const subscriptions=[],holdings=[],revenues=[],evidence=[],settlements=[],settlementLines=[],payments=[];
function subscribe(key,personaId,units,status,allocatedUnits=0){
  const o=offerings.find(o=>o.id===`offering-${key}`),id=`subscription-${key}-${personaId}`;
  const refundedUnits=['CANCELLED','REFUNDED'].includes(status)?units:status==='ALLOCATED'?units-allocatedUnits:0;
  subscriptions.push({id,offeringId:o.id,personaId,units,allocatedUnits,refundedUnits,status,synthetic:true});
  if(status==='ACCEPTED')o.acceptedUnits+=units;
  if(status==='ALLOCATED'){o.acceptedUnits+=allocatedUnits;holdings.push({id:`holding-${key}-${personaId}`,offeringId:o.id,personaId,units:allocatedUnits,chainUnits:0,chainStatus:'NOT_SUBMITTED',synthetic:true});}
}
subscribe('seongsu','investor-active',80,'ACCEPTED');subscribe('seongsu','background',2000,'ACCEPTED');
subscribe('yeonnam','investor-new',50,'ACCEPTED');subscribe('yeonnam','background',2700,'ACCEPTED');
subscribe('mangwon','investor-active',50,'CANCELLED');subscribe('mangwon','background',1500,'ACCEPTED');
for(const [key,active,bg] of [['eulji',100,2900],['hapjeong',200,4800],['mullae',100,3500]]){subscribe(key,'investor-active',active,'ALLOCATED',active);subscribe(key,'background',bg,'ALLOCATED',bg);}
subscribe('seochon','investor-active',70,'ALLOCATED',50);subscribe('seochon','merchant-seongsu',30,'ALLOCATED',30);subscribe('seochon','background',2320,'ALLOCATED',2320);
subscribe('songri','investor-active',100,'REFUNDED');subscribe('songri','background',1000,'REFUNDED');
function csv(key,period,total){
  const days=new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5)),0)).getUTCDate();
  const rows=['source,event_id,kind,related_id,amount_won,date'];
  for(let day=1;day<=days;day++){
    const net=Math.floor(total/days)+(day<=total%days?1:0),adjust=day===1?30000:day===2?20000:0;
    const date=`${period}-${String(day).padStart(2,'0')}`,id=`${key}${period.replace('-','')}${String(day).padStart(2,'0')}`;
    rows.push(`POS,${id},SALE,,${net+adjust},${date}`);
    if(adjust)rows.push(`POS,${id}_adjust,${day===1?'DISCOUNT':'REFUND'},${id},${adjust},${date}`);
    rows.push(`PG,${id}_capture,CAPTURE,${id},${net},${date}`,`BANK,${id}_deposit,DEPOSIT,,${net},${date}`);
  }
  return rows.join('\n')+'\n';
}
function source(id,storeId,period,content,net,ready=true){
  const filename=`${id}.csv`,path=`ux/csv/${filename}`;outputs.set(`fixtures/${path}`,Buffer.from(content));
  return {id,storeId,period,sourceCsv:path,sha256:sha(content),netSalesWon:String(net),reconciled:ready,synthetic:true};
}
for(const s of spec.stores)for(const [i,period] of months.entries())revenues.push(source(`revenue-${s.key}-${period}`,`store-${s.key}`,period,csv(s.key,period,s.monthlyNetWon[i]),s.monthlyNetWon[i]));
function base(key,period){return revenues.find(r=>r.id===`revenue-${key}-${period}`);}
function content(r){return outputs.get(`fixtures/${r.sourceCsv}`).toString();}
const missing=base('mangwon','2026-10');
const missingSource=source('source-mangwon-missing-bank',missing.storeId,missing.period,content(missing).split('\n').filter(l=>!l.startsWith('BANK,')).join('\n'),Number(missing.netSalesWon),false);
const mismatch=base('hapjeong','2026-09');
const mismatched=content(mismatch).replace(/(PG,[^\n]*?,)(\d+)(,2026-09-01)/,(_,a,b,c)=>a+(Number(b)-1000)+c);
const mismatchSource=source('source-hapjeong-pg-mismatch',mismatch.storeId,mismatch.period,mismatched,Number(mismatch.netSalesWon),false);
const original=base('eulji','2026-10'),firstId='eulji20261001';
let corrected=content(original).trimEnd().split('\n').map(l=>{
  const f=l.split(',');if(f[0]==='PG'&&f[3]===firstId||f[0]==='BANK'&&f[1]===`${firstId}_deposit`)f[4]=String(Number(f[4])-600000);return f.join(',');
});corrected.push(`POS,${firstId}_late_refund,REFUND,${firstId},600000,2026-10-26`);
const correction=source('source-eulji-correction',original.storeId,original.period,corrected.join('\n')+'\n',Number(original.netSalesWon)-600000);
const exceptionSources=[missingSource,mismatchSource,correction];
for(const [id,key,period,status,sourceId] of [
  ['evidence-seongsu-review','seongsu','2026-10','REVIEW_SAMPLE',base('seongsu','2026-10').id],
  ['evidence-mangwon-blocked','mangwon','2026-10','BLOCKED_SAMPLE',missingSource.id],
  ['evidence-hapjeong-blocked','hapjeong','2026-09','BLOCKED_SAMPLE',mismatchSource.id],
  ['evidence-seochon-review','seochon','2026-09','CLOSED_SAMPLE',base('seochon','2026-09').id],
  ['evidence-eulji-correction','eulji','2026-10','CLOSED_SAMPLE',correction.id],
])evidence.push({id,storeId:`store-${key}`,offeringId:`offering-${key}`,period,status,sourceId,submittedBy:stores.find(s=>s.id===`store-${key}`).ownerPersonaId,reviewedBy:status==='CLOSED_SAMPLE'?'reviewer':null,synthetic:true});
function allocate(pool,positions){
  const total=positions.reduce((n,p)=>n+BigInt(p.units),0n);
  const parts=positions.map(p=>({id:p.id,floor:pool*BigInt(p.units)/total,remainder:pool*BigInt(p.units)%total})).sort((a,b)=>a.remainder===b.remainder?a.id.localeCompare(b.id):a.remainder>b.remainder?-1:1);
  const rest=Number(pool-parts.reduce((n,p)=>n+p.floor,0n));return new Map(parts.map((p,i)=>[p.id,p.floor+(i<rest?1n:0n)]));
}
function settle(key,period,version=1,sourceRow=base(key,period),status='APPROVED_SAMPLE'){
  const o=offerings.find(o=>o.id===`offering-${key}`),pool=BigInt(sourceRow.netSalesWon)*BigInt(o.rateBps)/10000n;
  const positions=holdings.filter(h=>h.offeringId===o.id),amounts=allocate(pool,positions),id=`settlement-${key}-${period}-v${version}`;
  const previous=settlements.find(s=>s.offeringId===o.id&&s.period===period&&s.version===version-1);
  const cash=BigInt(sourceRow.netSalesWon)*45n/100n-10500000n;
  settlements.push({id,offeringId:o.id,storeId:o.storeId,period,version,previousId:previous?.id??null,status,sourceId:sourceRow.id,netSalesWon:sourceRow.netSalesWon,poolWon:String(pool),cashAvailableWon:String(cash>0n?cash:0n),calculatedBy:'reviewer',approvedBy:status==='APPROVED_SAMPLE'?'operator':null,chainStatus:'NOT_SUBMITTED',synthetic:true});
  for(const h of positions){
    const prior=settlementLines.filter(l=>l.holdingId===h.id&&settlements.find(s=>s.id===l.settlementId)?.period===period);
    const priorPaid=prior.reduce((n,l)=>n+BigInt(l.paidWon),0n),old=previous?prior.find(l=>l.settlementId===previous.id):undefined;
    settlementLines.push({id:`line-${id}-${h.personaId}`,settlementId:id,holdingId:h.id,personaId:h.personaId,units:h.units,amountWon:String(amounts.get(h.id)),paidWon:'0',priorPaidWon:String(priorPaid),deltaWon:String(amounts.get(h.id)-BigInt(old?.amountWon??0)),synthetic:true});
  }
  return id;
}
function pay(settlementId,personaId,requested,paid,outcome){const l=settlementLines.find(l=>l.settlementId===settlementId&&l.personaId===personaId);payments.push({id:`payment-${payments.length+1}`,lineId:l.id,personaId,requestedWon:String(requested),paidWon:String(paid),outcome,synthetic:true});l.paidWon=String(BigInt(l.paidWon)+BigInt(paid));}
const euljiSep=settle('eulji','2026-09');for(const l of settlementLines.filter(l=>l.settlementId===euljiSep))pay(euljiSep,l.personaId,l.amountWon,l.amountWon,'SUCCESS_SAMPLE');
const euljiOct=settle('eulji','2026-10');for(const l of settlementLines.filter(l=>l.settlementId===euljiOct))pay(euljiOct,l.personaId,l.amountWon,l.amountWon,'SUCCESS_SAMPLE');
settle('eulji','2026-10',2,correction);
const hap=settle('hapjeong','2026-10');pay(hap,'investor-active',33600,0,'FAILED_SAMPLE');pay(hap,'investor-active',33600,15000,'PARTIAL_SAMPLE');pay(hap,'background',806400,285000,'PARTIAL_SAMPLE');
settle('seochon','2026-09',1,base('seochon','2026-09'),'REVIEW_SAMPLE');settle('seochon','2026-10');
const mullae=settle('mullae','2026-09');const matureLine=settlementLines.find(l=>l.settlementId===mullae&&l.personaId==='investor-active');pay(mullae,'investor-active',matureLine.amountWon,20000,'PARTIAL_SAMPLE');const bgLine=settlementLines.find(l=>l.settlementId===mullae&&l.personaId==='background');pay(mullae,'background',bgLine.amountWon,bgLine.amountWon,'SUCCESS_SAMPLE');
for(const l of settlementLines){const balance=BigInt(l.amountWon)-BigInt(l.priorPaidWon)-BigInt(l.paidWon);l.unpaidWon=String(balance>0n?balance:0n);l.overpaidWon=String(balance<0n?-balance:0n);}
const benefits=[
  ['first-visit','seongsu','첫 방문 음료 1잔',0,'2026-10-01','2026-11-30',100],
  ['eulji-side','eulji','투자자 안주 1회',50,'2026-10-01','2026-11-30',100],
  ['hapjeong-discount','hapjeong','식사 금액 10% 할인',100,'2026-10-01','2026-11-30',100],
  ['seochon-tea','seochon','차 한 잔 혜택',20,'2026-10-01','2026-11-30',100],
  ['seochon-tier','seochon','100단위 이상 시식 초대',100,'2026-10-01','2026-11-30',100],
  ['mullae-expired','mullae','지난달 디저트 쿠폰',50,'2026-09-01','2026-09-30',100],
  ['yeonnam-upcoming','yeonnam','오픈 주간 사이드 메뉴',0,'2026-11-01','2026-11-30',100],
  ['mangwon-soldout','mangwon','한정 베이커리 세트',0,'2026-10-01','2026-11-30',2],
].map(([id,key,title,requiredUnits,validFrom,validUntil,maxClaims])=>({id,storeId:`store-${key}`,offeringId:`offering-${key}`,title,requiredUnits,validFrom,validUntil,maxClaims,maxPerPersona:1,synthetic:true}));
const claims=[
  ['hapjeong-discount','investor-active','CLAIMED_SAMPLE','2026-10-12'],['seochon-tea','investor-active','USED_SAMPLE','2026-10-20'],
  ['mullae-expired','investor-active','CLAIMED_SAMPLE','2026-09-12'],['first-visit','customer-only','USED_SAMPLE','2026-10-19'],
  ['mangwon-soldout','investor-active','USED_SAMPLE','2026-10-11'],['mangwon-soldout','merchant-seongsu','CLAIMED_SAMPLE','2026-10-12'],
].map(([benefitId,personaId,status,claimedOn],i)=>({id:`claim-${i+1}`,benefitId,personaId,status,claimedOn,code:`DEMO-NOT-VALID-${i+1}`,synthetic:true}));
const benefitStates=[];
for(const p of personas.filter(p=>p.selectable&&p.roles.includes('CUSTOMER')))for(const b of benefits){
  const mine=claims.find(c=>c.personaId===p.id&&c.benefitId===b.id),held=holdings.find(h=>h.personaId===p.id&&h.offeringId===b.offeringId)?.units??0;
  const status=mine?.status==='USED_SAMPLE'?'USED_SAMPLE':spec.asOf>b.validUntil?'EXPIRED_SAMPLE':mine?'CLAIMED_SAMPLE':spec.asOf<b.validFrom?'UPCOMING_SAMPLE':held<b.requiredUnits?'LOCKED_SAMPLE':claims.filter(c=>c.benefitId===b.id).length>=b.maxClaims?'SOLD_OUT_SAMPLE':'AVAILABLE_SAMPLE';
  benefitStates.push({personaId:p.id,benefitId:b.id,status,heldUnits:held,synthetic:true});
}
const scenarios=[
  {id:'discover-invest',personaId:'investor-new',path:['LOGIN','STORE_LIST','OFFERING_DETAIL','SUBSCRIBE'],expected:'로그인 후 가게 목록에서 모집 중 상품 선택. 접수는 보유와 다름.'},
  {id:'portfolio',personaId:'investor-active',path:['LOGIN','PORTFOLIO','HOLDING','SETTLEMENT'],expected:'여러 가게 보유와 완납/미지급/부분 지급/정정/만기 잔액 확인.'},
  {id:'merchant',personaId:'merchant-seongsu',path:['LOGIN','STORE_MANAGEMENT','REVENUE','EVIDENCE'],expected:'본인 가게 관리만 노출. 같은 사람의 투자/혜택 화면도 존재.'},
  {id:'multi-store-merchant',personaId:'merchant-group',path:['LOGIN','STORE_MANAGEMENT','STORE_SELECTOR'],expected:'여러 담당 가게를 선택. 다른 관리자 가게는 수정 범위에 없음.'},
  {id:'customer-benefits',personaId:'customer-only',path:['LOGIN','BENEFITS','BENEFIT_DETAIL'],expected:'투자 내역 없는 고객도 일반 혜택 조회. 투자 수량 조건 혜택은 잠김.'},
  {id:'review-queue',personaId:'reviewer',path:['LOGIN','REVIEW_QUEUE','EVIDENCE'],expected:'검토 대기/보완 필요/마감 자료를 구분. 제출자와 검토자 분리.'},
  {id:'operator-approval',personaId:'operator',path:['LOGIN','OPERATIONS','APPROVAL'],expected:'산정자와 승인자 분리. 샘플 행위가 실제 권한을 부여하지 않음.'},
];
const dataset={datasetId:spec.datasetId,version:spec.version,asOf:spec.asOf,mode:'SIMULATION',source:'SYNTHETIC_UX_FIXTURE',disclaimer:'UX 시연용 가상 자료. 실제 계정·가게·권한·Dojang·온체인 보유·정산 승인·지급·쿠폰이 아닙니다.',personas,stores,offerings,subscriptions,holdings,revenues,exceptionSources,evidence,settlements,settlementLines,payments,benefits,claims,benefitStates,scenarios};
outputs.set('fixtures/ux/dataset.json',Buffer.from(JSON.stringify(dataset,null,2)+'\n'));
outputs.set('services/core-api/src/main/resources/demo/ux-dataset.json',outputs.get('fixtures/ux/dataset.json'));
for(const [path,bytes] of [...outputs])if(path.startsWith('fixtures/ux/csv/'))outputs.set(path.replace('fixtures/ux/csv/','services/core-api/src/main/resources/demo/ux/csv/'),bytes);
outputs.set('services/core-api/src/main/resources/demo/ux-dataset.sha256',Buffer.from(sha(outputs.get('fixtures/ux/dataset.json'))+'\n'));
for(const [path,bytes] of outputs){
  const url=new URL(path,root);if(check){if(!(await readFile(url)).equals(bytes))throw new Error(`Stale UX fixture: ${path}`);}
  else{await mkdir(dirname(fileURLToPath(url)),{recursive:true});await writeFile(url,bytes);}
}
console.log(JSON.stringify({action:check?'VERIFIED':'GENERATED',datasetId:dataset.datasetId,sha256:sha(outputs.get('fixtures/ux/dataset.json')),counts:Object.fromEntries(Object.entries(dataset).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length])),databaseWrites:0}));
