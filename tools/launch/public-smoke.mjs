const BASE=(process.env.SDELAET_BASE_URL||'https://onsdelaet.ru').replace(/\/$/,'');
const paths=['/','/create-task.html','/payment.html','/offer.html','/privacy.html','/requisites.html'];
const timeoutMs=Number(process.env.SDELAET_SMOKE_TIMEOUT_MS||10000);

async function check(path){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(`${BASE}${path}`,{redirect:'follow',signal:controller.signal,headers:{'user-agent':'sdelaet-launch-smoke/1.0'}});
    const text=await response.text();
    return {path,status:response.status,ok:response.ok,bytes:Buffer.byteLength(text),title:(text.match(/<title>([^<]*)<\/title>/i)||[])[1]||null};
  }catch(error){
    return {path,status:0,ok:false,error:error?.name==='AbortError'?'TIMEOUT':String(error?.message||error)};
  }finally{clearTimeout(timer);}
}

const results=[];
for(const path of paths) results.push(await check(path));
const failures=results.filter(x=>!x.ok||x.status!==200||!x.bytes);
console.table(results);
console.log(JSON.stringify({base:BASE,total:results.length,failures:failures.length},null,2));
if(failures.length) process.exit(1);
