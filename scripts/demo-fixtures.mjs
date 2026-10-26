import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('fixtures/catalog.json',root));
const catalog=JSON.parse(source);
const check=process.argv.includes('--check');
if(catalog.schemaVersion!==1||catalog.mode!=='SIMULATION')throw new Error('Invalid demo catalog');
const files=[['catalog.json',source]];
for(const scenario of catalog.scenarios){
  if(!/^[a-z0-9-]+\.csv$/.test(scenario.filename))throw new Error('Invalid fixture path');
  const content=await readFile(new URL(`fixtures/${scenario.filename}`,root));
  if(createHash('sha256').update(content).digest('hex')!==scenario.sha256)throw new Error(`Fixture hash changed: ${scenario.filename}`);
  files.push([scenario.filename,content]);
}
for(const [name,content] of files){
  const target=new URL(`apps/web/public/samples/${name}`,root);
  if(check){if(!(await readFile(target)).equals(content))throw new Error(`Public sample is stale: ${name}`);}
  else await writeFile(target,content);
}
console.log(`${check?'Verified':'Published'} ${files.length-1} demo CSV files and catalog; no database writes.`);
