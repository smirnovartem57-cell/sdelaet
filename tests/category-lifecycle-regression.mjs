import fs from 'node:fs';
const allowed=new Set(['IDEA','RESEARCH','EXPERT_MODEL','TESTING','READY','ACTIVE','SEASONAL_PAUSE']);
const files=['balcony-insulation.json','balcony-glazing.json','window-replacement.json','window-repair.json','balcony-finishing.json','balcony-leak-repair.json','electrical-installation.json','plumbing-works.json','radiator-heating.json','minor-apartment-repair.json','tile-installation.json','flooring-installation.json','wall-finishing.json'];
let fail=0;
for(const file of files){
  const p=new URL('../assets/category-profiles/'+file,import.meta.url);
  const x=JSON.parse(fs.readFileSync(p,'utf8'));
  let ok=allowed.has(x.status);
  if(!ok){console.log('FAIL invalid lifecycle',file,x.status);fail++;continue;}
  if(x.status==='READY'){
    const g=x.releaseGate||{};
    if(g.status!=='PASS'||g.e2e!=='PASS'||g.productionDeploy!=='PASS'){
      console.log('FAIL READY without complete release gate',file);fail++;ok=false;
    }
  }
  if(x.status==='RESEARCH'){
    if(!x.lifecycle||x.lifecycle.research!=='IN_PROGRESS'){
      console.log('FAIL RESEARCH without lifecycle marker',file);fail++;ok=false;
    }
  }
  if(ok)console.log('PASS',file,x.status);
}
if(fail)process.exit(1);
console.log('Category lifecycle regression: '+files.length+'/'+files.length+' PASS');