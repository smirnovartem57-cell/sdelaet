import fs from 'node:fs';
import {categories} from '../tools/category-agents/manifest.mjs';
const allowed=new Set(['IDEA','RESEARCH','EXPERT_MODEL','TESTING','READY','ACTIVE','SEASONAL_PAUSE']);
let fail=0;
for(const c of categories()){
 const x=JSON.parse(fs.readFileSync(new URL('../'+c.profile,import.meta.url),'utf8'));let ok=allowed.has(x.status)&&x.status===c.status;
 if(!ok){console.log('FAIL lifecycle/manifest',c.categoryId,x.status,c.status);fail++;continue}
 if(x.status==='READY'){const g=x.releaseGate||{};if(g.status!=='PASS'||g.e2e!=='PASS'||g.productionDeploy!=='PASS'){console.log('FAIL READY gate',c.categoryId);fail++;ok=false}}
 if(x.status==='RESEARCH'&&x.lifecycle?.research!=='IN_PROGRESS'){console.log('FAIL RESEARCH marker',c.categoryId);fail++;ok=false}
 if(ok)console.log('PASS',c.categoryId,x.status);
}
if(fail)process.exit(1);console.log(`Category lifecycle regression: ${categories().length}/${categories().length} PASS`);
