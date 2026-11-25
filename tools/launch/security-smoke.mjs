const SITE=(process.env.SDELAET_BASE_URL||'https://onsdelaet.ru').replace(/\/$/,'');
const API=(process.env.SDELAET_API_URL||'https://api.onsdelaet.ru').replace(/\/$/,'');
const timeoutMs=Number(process.env.SDELAET_SMOKE_TIMEOUT_MS||10000);

async function probe(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{redirect:'manual',signal:controller.signal,headers:{'user-agent':'sdelaet-security-smoke/1.0'}});
    const text=await response.text();
    return {url,status:response.status,bytes:Buffer.byteLength(text)};
  }catch(error){
    return {url,status:0,error:error?.name==='AbortError'?'TIMEOUT':String(error?.message||error)};
  }finally{clearTimeout(timer);}
}

const cases=[
  {name:'admin_ui_requires_auth',url:`${SITE}/admin/`,expect:[401]},
  {name:'admin_api_requires_auth',url:`${SITE}/admin-api/recovery`,expect:[401]},
  {name:'public_admin_api_hidden',url:`${API}/v1/admin/recovery`,expect:[404]}
];

const results=[];
for(const item of cases){
  const result=await probe(item.url);
  results.push({...item,...result,ok:item.expect.includes(result.status)});
}
console.table(results.map(({name,status,ok,url})=>({name,status,ok,url})));
const failures=results.filter(x=>!x.ok);
console.log(JSON.stringify({total:results.length,failures:failures.length},null,2));
if(failures.length) process.exit(1);
