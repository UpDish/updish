import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const paths=execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(path=>
  ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml'].includes(path)||
  (path.startsWith('apps/web/')&&!path.split('/').some(part=>part.startsWith('.env')))||path.startsWith('packages/chain-config/'));
const files=paths.map(path=>({file:path,data:readFileSync(path).toString('base64'),encoding:'base64'}));
console.log(JSON.stringify({files,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}));
