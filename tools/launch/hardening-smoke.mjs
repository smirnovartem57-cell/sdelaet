const SITE=(process.env.SDELAET_BASE_URL||'https://onsdelaet.ru').replace(/\/$/,'');
const API=(process.env.SDELAET_API_URL||'https://api.onsdelaet.ru').replace(/\/$/,'');
const TG=(process.env.SDELAET_TG_URL||'https://tg.onsdelaet.ru').replace(/\/$/,'');

async function get(url){
  const response=await fetch(url,{redirect:'follow',headers:{'user-agent':'sdelaet-hardening-smoke/1.0'}});
  return {response,text:await response.text()};
}

const checks=[];
for(const [name,url] of [['api_health',`${API}/health`],['telegram_health',`${TG}/health`]]){
  try{
    const {response,text}=await get(url);
    checks.push({name,status:response.status,ok:response.status===200&&text.includes('"ok":true')});
  }catch(error){checks.push({name,status:0,ok:false,error:String(error?.message||error)});}
}

const {response:site}=await get(`${SITE}/`);
const requiredHeaders=['strict-transport-security','x-content-type-options','referrer-policy','x-frame-options'];
for(const header of requiredHeaders){
  const value=site.headers.get(header);
  checks.push({name:`header:${header}`,status:site.status,ok:Boolean(value),value:value||''});
}

console.table(checks);
const failures=checks.filter(x=>!x.ok);
console.log(JSON.stringify({total:checks.length,failures:failures.length,failed:failures.map(x=>x.name)},null,2));
if(failures.length) process.exit(1);
