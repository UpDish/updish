import { readFile,writeFile,mkdir } from 'node:fs/promises';
const names=['UpDishDemoUnits','SettlementRegistry','UpDishDemoCash','UpDishDistribution'] as const;
const runtime:Record<string,unknown>={};const browser:Record<string,unknown>={};
for(const name of names) {
  const artifact=JSON.parse(await readFile(`contracts/out/${name}.sol/${name}.json`,'utf8'));
  browser[name]={abi:artifact.abi,bytecode:artifact.bytecode.object};
  runtime[name]={runtime:artifact.deployedBytecode.object,immutableRanges:Object.values(artifact.deployedBytecode.immutableReferences??{}).flatMap((ranges:any)=>ranges.map((r:any)=>[r.start,r.length]))};
}
await mkdir('services/core-api/src/main/resources/chain',{recursive:true});
await writeFile('services/core-api/src/main/resources/chain/runtime-manifest.json',JSON.stringify(runtime,null,2)+'\n');
await writeFile('apps/web/lib/contract-build.json',JSON.stringify(browser)+'\n');
console.log('Exported browser deployments and server runtime verification manifest.');
