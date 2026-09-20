import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function ok(v,m){if(!v)throw new Error(m)}
const file=path.join(os.tmpdir(),'sdelaet-fns-cache-regression-'+process.pid+'.json');
const key='621200001637:325620000011313';
const checkedAt=new Date(Date.now()-120000).toISOString();
fs.writeFileSync(file,JSON.stringify({
  [key]:{
    at:Date.now()-120000,
    value:{
      provider:'ФНС · Прозрачный бизнес',
      checkedAt,
      sourceUrl:'https://pb.nalog.ru/search.html#queryAll=621200001637',
      entityType:'individual_entrepreneur',
      inn:'621200001637',
      ogrn:'325620000011313',
      legalName:'ХРУЛЕВ АЛЕКСЕЙ АЛЕКСЕЕВИЧ',
      legalForm:'ИП',
      registeredAt:'2025-03-04',
      active:true,
      statusLabel:'Действующий ИП',
      msp:{code:1,label:'Микропредприятие',since:'2025-04-10'}
    }
  }
}), 'utf8');

process.env.FNS_PROFILE_CACHE_FILE=file;
process.env.FNS_PROFILE_CACHE_TTL_MS='60000';
process.env.FNS_PROFILE_STALE_TTL_MS='604800000';

const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw new Error('SIMULATED_FNS_DOWN')};
try{
  const mod=await import('../src/fns-profile.mjs?cache-regression='+Date.now());
  const profile=await mod.fetchFnsProfile({inn:'621200001637',ogrn:'325620000011313',force:true});
  ok(profile?.inn==='621200001637','stale profile must be returned');
  ok(profile?.registeredAt==='2025-03-04','cached registration date must survive');
  ok(profile?.msp?.label==='Микропредприятие','cached MSP must survive');
  ok(profile?.cacheStatus==='stale','fallback must be marked stale');
  ok(/SIMULATED_FNS_DOWN/.test(profile?.fallbackReason||''),'fallback reason must be recorded');
  console.log('FNS CACHE REGRESSION: PASS');
} finally {
  globalThis.fetch=originalFetch;
  try{fs.rmSync(file,{force:true})}catch{}
}
