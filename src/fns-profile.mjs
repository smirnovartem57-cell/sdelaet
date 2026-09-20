const BASE='https://pb.nalog.ru/';
const TTL=Math.max(60000,Number(process.env.FNS_PROFILE_CACHE_TTL_MS||21600000));
const cache=new Map();
const txt=v=>String(v??'').trim();
const n=v=>Number.isFinite(Number(v))?Number(v):null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function iso(v){
  const s=txt(v); if(!s)return '';
  let m=s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if(m)return m[3]+'-'+m[2]+'-'+m[1];
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m?m[1]+'-'+m[2]+'-'+m[3]:'';
}
function mspLabel(c){return Number(c)===1?'Микропредприятие':Number(c)===2?'Малое предприятие':Number(c)===3?'Среднее предприятие':''}
function srcUrl(inn){return BASE+'search.html#mode=search-all&page=1&pageSize=10&queryAll='+encodeURIComponent(inn)}
function active(row,kind){return kind==='ul'?(String(row?.pr_liq??'0')==='0'&&String(row?.sulst_ex??'')!=='50'):(String(row?.pr_sipst??'0')==='0'&&String(row?.predo??'1')==='1')}
function choose(result,inn,ogrn){
  const rows=[...(result?.ul?.data||[]).map(row=>({row,kind:'ul'})),...(result?.ip?.data||[]).map(row=>({row,kind:'ip'}))].filter(x=>txt(x.row?.inn)===inn);
  rows.sort((a,b)=>(ogrn&&txt(b.row?.ogrn)===ogrn?1:0)-(ogrn&&txt(a.row?.ogrn)===ogrn?1:0)||(active(b.row,b.kind)?1:0)-(active(a.row,a.kind)?1:0)||Date.parse(iso(b.row?.dtreg||b.row?.dtogrn)||'1970-01-01')-Date.parse(iso(a.row?.dtreg||a.row?.dtogrn)||'1970-01-01'));
  return rows[0]||null;
}
function latestYear(a){return [...(a||[])].sort((x,y)=>Number(y?.yearcode||0)-Number(x?.yearcode||0))[0]||null}
function latestDebt(a){
  const rows=(a||[]).filter(x=>Number(x?.yearcode)>0&&Number(x?.periodcode)>0); if(!rows.length)return null;
  const max=Math.max(...rows.map(x=>Number(x.yearcode)*100+Number(x.periodcode)));
  const g=rows.filter(x=>Number(x.yearcode)*100+Number(x.periodcode)===max);
  if(!g.some(x=>Number(x.empty||0)!==1))return null;
  const amount=g.reduce((s,x)=>s+Number(x.totalsum||0),0);
  return amount>0?{amount,year:Math.floor(max/100),period:max%100}:null;
}
export function normalizeFnsProfile({inn,ogrn='',searchRow,kind,detail=null,checkedAt=new Date().toISOString()}={}){
  if(!searchRow)return null;
  const v=detail?.vyp||{}, reg=iso(v['ДатаРег']||v['ДатаОГРН']||searchRow.dtreg||searchRow.dtogrn);
  const e=latestYear(detail?.sschr), f=latestYear((detail?.form1||[]).filter(x=>Number(x?.empty||0)!==1));
  const ec=e?n(e.sschr):n(v.sschr), ey=e?n(e.yearcode):n(v.sschr_yearcode);
  const income=f?n(f.revenue):n(v.revenuesum), expense=f?n(f.expense):n(v.expensesum), fy=f?n(f.yearcode):n(v.form1_yearcode);
  const msp=n(v.rsmpcategory), cap=kind==='ul'?n(v['СумКап']):null, short=txt(v['НаимЮЛСокр']||searchRow.namec), full=txt(v['НаимЮЛПолн']||searchRow.namep||searchRow.namec);
  return {
    provider:'ФНС · Прозрачный бизнес',checkedAt,sourceUrl:srcUrl(inn),entityType:kind==='ip'?'individual_entrepreneur':'legal_entity',
    inn:txt(v['ИНН']||searchRow.inn||inn),ogrn:txt(v['ОГРН']||searchRow.ogrn||ogrn),legalName:short||full,fullLegalName:full||short,
    legalForm:kind==='ip'?'ИП':((short||full).match(/^(ООО|АО|ПАО|НАО|ЗАО|ОАО)(?:\s|$)/i)?.[1]||''),
    registeredAt:reg,active:kind==='ul'?(String(v.sulst_ex??searchRow.sulst_ex??'')==='10'||active(searchRow,kind)):active(searchRow,kind),
    statusLabel:txt(v.sulst_name_ex||searchRow.sulst_name_ex)||(kind==='ip'?(active(searchRow,kind)?'Действующий ИП':'Деятельность прекращена'):''),
    okved:{code:txt(v['КодОКВЭД']||searchRow.okved2main||searchRow.okved2),name:txt(v['НаимОКВЭД']||searchRow.okved2mainname||searchRow.okved2name)},
    capital:cap&&cap>0?{amount:cap,type:txt(v['НаимВидКап']||'Уставный капитал')}:null,
    employees:ec!=null&&ey?{count:ec,year:ey}:null,
    finance:(income!=null||expense!=null)&&fy?{income,expense,profit:income!=null&&expense!=null?income-expense:null,year:fy}:null,
    msp:msp&&mspLabel(msp)?{code:msp,label:mspLabel(msp),since:iso(txt(v.rsmpdate).split(' ')[0])}:null,
    debt:latestDebt(detail?.arrear),dataDate:iso(v['ДатаВып'])||''
  };
}
async function get(url,opt={},timeout=15000){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
  try{const r=await fetch(url,{...opt,signal:c.signal});const body=await r.text();return{ok:r.ok,status:r.status,body,headers:r.headers}}finally{clearTimeout(t)}
}
async function post(path,data,cookie,referer){
  const r=await get(BASE+path,{method:'POST',headers:{'user-agent':'Mozilla/5.0 (compatible; SdelaetBot/1.0; +https://onsdelaet.ru/)','accept-language':'ru-RU,ru;q=0.9','content-type':'application/x-www-form-urlencoded; charset=UTF-8','x-requested-with':'XMLHttpRequest',cookie,referer:BASE+referer},body:new URLSearchParams(data)});
  if(!r.ok)throw new Error('FNS_HTTP_'+r.status); return r.body&&r.body!=='null'?JSON.parse(r.body):null;
}
async function poll(path,data,cookie,referer,tries=18,delay=400){
  for(let i=0;i<tries;i++){if(i)await sleep(delay);const x=await post(path,data(),cookie,referer);if(x)return x}throw new Error('FNS_TIMEOUT');
}
export async function fetchFnsProfile({inn,ogrn='',force=false}={}){
  const clean=txt(inn).replace(/\D/g,''); if(!/^\d{10}$|^\d{12}$/.test(clean))return null;
  const key=clean+':'+txt(ogrn), old=cache.get(key); if(!force&&old&&Date.now()-old.at<TTL)return old.value;
  const page=await get(BASE+'search.html',{headers:{'user-agent':'Mozilla/5.0 (compatible; SdelaetBot/1.0; +https://onsdelaet.ru/)','accept-language':'ru-RU,ru;q=0.9'}});
  if(!page.ok)throw new Error('FNS_SEARCH_PAGE_HTTP_'+page.status);
  const cookie=(page.headers.getSetCookie?.()||[]).map(x=>x.split(';')[0]).join('; ');
  const init=await post('search-proc.json',{mode:'search-all',queryAll:clean,page:'1',pageSize:'10',pbCaptchaToken:'',token:''},cookie,'search.html');
  if(init?.captchaRequired)return{available:false,provider:'ФНС · Прозрачный бизнес',reason:'captcha_required',checkedAt:new Date().toISOString(),sourceUrl:srcUrl(clean)};
  const result=await poll('search-proc.json',()=>({id:init.id,method:'get-response'}),cookie,'search.html');
  const sel=choose(result,clean,txt(ogrn)); if(!sel)return null;
  let detail=null;
  try{
    const ci=await post('company-proc.json',{token:sel.row.token,method:'get-request'},cookie,'company.html?token='+sel.row.token);
    if(ci?.id&&ci?.token&&!ci?.captchaRequired)detail=await poll('company-proc.json',()=>({token:ci.token,id:ci.id,method:'get-response'}),cookie,'company.html?token='+sel.row.token,20,450);
  }catch(e){if(!/429|captcha/i.test(String(e?.message||e)))console.warn('FNS detail failed',clean,String(e?.message||e))}
  const value=normalizeFnsProfile({inn:clean,ogrn,searchRow:sel.row,kind:sel.kind,detail}); cache.set(key,{at:Date.now(),value}); return value;
}
export function clearFnsProfileCache(){cache.clear()}
