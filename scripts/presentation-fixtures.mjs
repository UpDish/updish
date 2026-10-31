import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const check=process.argv.includes('--check');
const root=new URL('../fixtures/presentation-v03/',import.meta.url);
const destination=new URL('../apps/web/public/samples/presentation-v03/',import.meta.url);
await mkdir(root,{recursive:true});await mkdir(destination,{recursive:true});
const sources=[];
for(const name of ['normal','missing-bank','cash-shortage','correction']){
  const source=new URL(name+'.csv',root);
  let bytes;try{bytes=await readFile(source);}catch(error){if(check)throw error;bytes=await readFile(new URL('../fixtures/'+name+'.csv',import.meta.url));await writeFile(source,bytes);}
  assert(!bytes.includes(13),'Presentation CSV must preserve LF bytes');
  const output=new URL(name+'.csv',destination);
  if(check)assert.deepEqual(await readFile(output),bytes);else await writeFile(output,bytes);
  sources.push({id:name,filename:name+'.csv',sha256:createHash('sha256').update(bytes).digest('hex')});
}
const catalog={scenarioCode:'presentation-v03',mode:'SIMULATION',title:'성수 모퉁이 2호점 확장',targetWon:'100000000',unitPriceWon:'10000',totalUnits:10000,ownUnits:100,rateBps:1000,period:'2026-10',confirmedNetSalesWon:'30000000',poolWon:'3000000',ownDistributionWon:'30000',months:60,description:'계약기간 60개월은 시연 가정. 본점 참고 매출과 2호점 가상 영업 매출을 구분. DEMO 토큰에는 현금 가치와 원화 담보가 없음.',sources};
for(const path of [new URL('catalog.json',root),new URL('catalog.json',destination)]){
 const text=JSON.stringify(catalog,null,2)+'\n';if(check)assert.equal(await readFile(path,'utf8'),text);else await writeFile(path,text);
}
console.log('Presentation v0.3 fixture bytes, hashes and 30,000 example '+(check?'verified':'generated'));
