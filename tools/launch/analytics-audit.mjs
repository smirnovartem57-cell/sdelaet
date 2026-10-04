const SITE=(process.env.SDELAET_BASE_URL||'https://onsdelaet.ru').replace(/\/$/,'');
const METRIKA_ID='112503660';
const pages=['/','/create-task.html','/payment.html','/candidates.html','/compare.html'];

async function fetchText(path){
  const response=await fetch(`${SITE}${path}`,{redirect:'follow',headers:{'user-agent':'sdelaet-analytics-audit/1.0'}});
  return {path,status:response.status,text:await response.text()};
}

const rows=[];
for(const path of pages){
  const {status,text}=await fetchText(path);
  const scripts=[...text.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(x=>x[1]);
  const hasAnalytics=scripts.some(x=>/\/assets\/analytics\.js(?:\?|$)/.test(x));
  const hasMetrika=text.includes(METRIKA_ID);
  const goals=[...text.matchAll(/sdTrack\(\s*["']([^"']+)["']/g)].map(x=>x[1]);
  rows.push({path,status,analytics_js:hasAnalytics,metrika_id_inline:hasMetrika,inline_goals:[...new Set(goals)].join(', ')});
}
console.table(rows);

const critical=rows.filter(x=>x.status!==200);
const missing=rows.filter(x=>!x.analytics_js);
console.log(JSON.stringify({metrika_id:METRIKA_ID,total:rows.length,http_failures:critical.length,pages_without_analytics_js:missing.map(x=>x.path)},null,2));
if(critical.length) process.exit(1);
