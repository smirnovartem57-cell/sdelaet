const DEFAULT_URL='https://wordstat-excel.smirart.workers.dev';

export async function getWordstatQuota(baseUrl=DEFAULT_URL){
  const r=await fetch(`${baseUrl}/api/quota`,{headers:{accept:'application/json'}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.message||data.error||`WORDSTAT_QUOTA_HTTP_${r.status}`);
  return data;
}

export async function fetchWordstatFrequency(phrases,{region='225',baseUrl=DEFAULT_URL}={}){
  const unique=[...new Set((phrases||[]).map(x=>String(x||'').trim()).filter(Boolean))];
  if(!unique.length) return {queries:[],raw:null};
  const queries=[]; let yandexRequestsUsed=0;
  for(let i=0;i<unique.length;i+=10){
    const batch=unique.slice(i,i+10);
    const r=await fetch(`${baseUrl}/api/frequency`,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({phrases:batch,regions:[String(region)]})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.message||data.error||`WORDSTAT_FREQUENCY_HTTP_${r.status}`);
    yandexRequestsUsed+=Number(data.yandexRequestsUsed||0);
    for(const item of data.results||[]) queries.push({query:item.phrase,demand:Number.isFinite(Number(item.frequency))?Number(item.frequency):null,intent:null,topic:null,sourceRefs:['wordstat_frequency']});
  }
  return {queries,yandexRequestsUsed,region:String(region)};
}