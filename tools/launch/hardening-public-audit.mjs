const targets=[
  'https://onsdelaet.ru/',
  'https://api.onsdelaet.ru/health',
  'https://tg.onsdelaet.ru/health'
];

const requiredHeaders=[
  'strict-transport-security',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'x-frame-options'
];

async function probe(url){
  const response=await fetch(url,{redirect:'manual',headers:{'user-agent':'sdelaet-hardening-audit/1.0'}});
  const headers=Object.fromEntries([...response.headers.entries()]);
  return {url,status:response.status,headers};
}

const results=[];
for(const url of targets){
  const item=await probe(url);
  const missing=requiredHeaders.filter(name=>!item.headers[name]);
  results.push({url,status:item.status,missing_headers:missing.join(', ')||'none'});
}

console.table(results);
const critical=results.filter(x=>x.status<200||x.status>=400);
const site=results.find(x=>x.url==='https://onsdelaet.ru/');
const missingSecurity=site?site.missing_headers==='none'?[]:site.missing_headers.split(', '):requiredHeaders;
console.log(JSON.stringify({total:results.length,http_failures:critical.length,site_missing_security_headers:missingSecurity},null,2));
if(critical.length) process.exit(1);
