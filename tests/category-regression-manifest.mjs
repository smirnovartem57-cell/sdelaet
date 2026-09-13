import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {categories} from '../tools/category-agents/manifest.mjs';
let fail=0,count=0;
const seen=new Set();
for(const c of categories().filter(x=>['TESTING','READY','ACTIVE','SEASONAL_PAUSE'].includes(x.status))){for(const f of [c.qaTest,c.e2eTest]){if(!f||seen.has(f))continue;seen.add(f);count++;const r=spawnSync(process.execPath,[path.resolve(f)],{stdio:'inherit'});if(r.status!==0){console.error('FAIL category regression',c.categoryId,f);fail++}}}
if(fail)process.exit(1);console.log(`Category manifest regressions: ${count}/${count} PASS`);
