const CATEGORY_CONFIG = {
  'balcony-insulation': {companyQueries:['утепление балконов','утепление лоджий','ремонт балконов'],privateQueries:['утепление балкона','утепление лоджии'],keywords:['балкон','лоджи','утепл'],qualifyKeywords:['утепл','теплоизоляц']},
  'balcony-glazing': {companyQueries:['остекление балконов','остекление лоджий','теплое остекление балкона'],privateQueries:['остекление балкона','остекление лоджии'],keywords:['балкон','лоджи','остекл'],qualifyKeywords:['остекл','окон','балкон','лоджи']},
  'window-replacement': {companyQueries:['замена окон','установка пластиковых окон','окна пвх монтаж'],privateQueries:['установка окон','замена окон'],keywords:['окн','пвх','стеклопак'],qualifyKeywords:['окн','стеклопак','пвх']},
  'window-repair': {companyQueries:['ремонт пластиковых окон','регулировка окон','ремонт фурнитуры окон'],privateQueries:['ремонт окон','регулировка окон'],keywords:['ремонт','окн','регулиров','фурнитур'],qualifyKeywords:['ремонт окон','регулиров','фурнитур','стеклопак','уплотн']},
  'balcony-finishing': {companyQueries:['отделка балконов','ремонт балконов','внутренняя отделка лоджий'],privateQueries:['отделка балкона','ремонт балкона'],keywords:['балкон','лоджи','отделк','ремонт'],qualifyKeywords:['отделк','обшив','ремонт балкон','ремонт лоджи']},
  'balcony-leak-repair': {companyQueries:['герметизация балконов','ремонт протечек балкона','герметизация швов балкона'],privateQueries:['герметизация балкона','ремонт протечки балкона'],keywords:['балкон','лоджи','гермет','протеч','шв'],qualifyKeywords:['гермет','протеч','гидроизоляц','шв','козыр','фасад']},
  'plumbing-works': {companyQueries:['сантехнические работы квартира','разводка труб водоснабжения','сантехник ремонт санузла'],privateQueries:['сантехник разводка труб','сантехник установка сантехники'],keywords:['сантех','труб','водоснабж','канализац','смесител'],qualifyKeywords:['сантехник','сантехническ','разводка труб','водоснабж','канализац','сантехника']},
  'radiator-heating': {companyQueries:['замена радиаторов отопления','установка радиаторов отопления','замена батарей отопления'],privateQueries:['сантехник замена радиатора','мастер установка батареи'],keywords:['радиатор','батаре','отоплен','стояк'],qualifyKeywords:['радиатор','батаре','отоплен','стояк','опрессов']},
  'electrical-installation': {companyQueries:['электромонтажные работы квартира','замена проводки квартира','электрик электрощит'],privateQueries:['электрик проводка квартира','электромонтаж розетки щит'],keywords:['электр','проводк','электромонтаж','розет','щит'],qualifyKeywords:['электромонтаж','электрик','проводк','электрощит','розет','автомат','узо']},
};

const PLATFORM_HOSTS = [
  'yandex.ru','yandex.com','uslugi.yandex.ru','2gis.ru','otzovik.com','rmnt.ru',
  'avito.ru','vk.com','youtube.com','dzen.ru','zoon.ru','yell.ru','flamp.ru','spravker.ru',
  'xn--g1abdcwihado2k.xn--p1ai'
];

function text(v){ return String(v ?? '').trim(); }
function lower(v){ return text(v).toLowerCase().replace(/ё/g,'е'); }
function uniq(arr){ return [...new Set(arr.filter(Boolean))]; }
function hostOf(url){ try { return new URL(url).hostname.replace(/^www\./,'').toLowerCase(); } catch { return ''; } }
function isPlatformHost(host){ return PLATFORM_HOSTS.some(x => host === x || host.endsWith('.'+x)); }
function normalizeName(v){ return lower(v).replace(/[^a-zа-я0-9]+/g,' ').trim(); }
function tokens(v){ return normalizeName(v).split(/\s+/).filter(x => x.length > 2); }
function overlap(a,b){ const A=new Set(tokens(a)), B=new Set(tokens(b)); if(!A.size||!B.size)return 0; let n=0; for(const x of A)if(B.has(x))n++; return n/Math.max(A.size,B.size); }
function xmlDecode(s){ return text(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/<hlword>|<\/hlword>/g,''); }
function tag(block,name){ const m=block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i')); return m?xmlDecode(m[1]).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim():''; }
function fromBase64(v){ try { const bin=atob(v); const bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i); return new TextDecoder().decode(bytes); } catch { return ''; } }

function parseYandexRaw(raw){
  const decoded=fromBase64(raw);
  if(!decoded)return [];
  try {
    const j=JSON.parse(decoded);
    const docs=Array.isArray(j.docs)?j.docs:[];
    return docs.map(d=>({
      title:text(d.DocumentTitle||d.title),
      url:text(d.FullUrl||d.url),
      description:text(d.Description||d.info_context||d.description),
      raw:d,
    })).filter(x=>x.url);
  } catch {}
  const docs=[];
  const blocks=decoded.match(/<doc\b[\s\S]*?<\/doc>/gi)||[];
  for(const b of blocks){
    const url=tag(b,'url')||tag(b,'FullUrl');
    if(!url)continue;
    docs.push({title:tag(b,'title')||tag(b,'DocumentTitle'),url,description:tag(b,'headline')||tag(b,'passage')||tag(b,'Description')});
  }
  return docs;
}

function checkedAt(){ return new Date().toISOString(); }
function source(id,kind,label,url){ return {id,kind,label,url,host:hostOf(url),checkedAt:checkedAt()}; }
function fact(status,label,sourceId=''){ return {status,label,sourceId}; }

async function fetchJson(url,opts={},timeout=9000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const r=await fetch(url,{...opts,signal:controller.signal});
    const body=await r.text();
    if(!r.ok)throw new Error(`HTTP ${r.status}: ${body.slice(0,180)}`);
    return JSON.parse(body);
  } finally { clearTimeout(timer); }
}

async function yandexWebSearch(env,query,limit=10){
  if(!env.YANDEX_SEARCH_API_KEY || !env.YANDEX_FOLDER_ID)return [];
  const body={
    query:{searchType:'SEARCH_TYPE_RU',queryText:query,familyMode:'FAMILY_MODE_MODERATE',page:'0',fixTypoMode:'FIX_TYPO_MODE_ON'},
    groupSpec:{groupMode:'GROUP_MODE_FLAT',groupsOnPage:String(Math.max(1,Math.min(limit,20))),docsInGroup:'1'},
    maxPassages:'2',region:'225',l10N:'LOCALIZATION_RU',folderId:env.YANDEX_FOLDER_ID,responseFormat:'FORMAT_XML',
    metadata:{fields:{'x-genesis-info-context':'on'}}
  };
  const j=await fetchJson('https://searchapi.api.cloud.yandex.net/v2/web/search',{
    method:'POST',headers:{'content-type':'application/json','authorization':'Api-Key '+env.YANDEX_SEARCH_API_KEY},body:JSON.stringify(body)
  },12000);
  return parseYandexRaw(j.rawData||'');
}

async function dgisSearch(env,query,city,limit=10){
  if(!env.DGIS_API_KEY)return [];
  const u=new URL('https://catalog.api.2gis.com/3.0/items');
  u.searchParams.set('q',`${query} ${city}`.trim());
  u.searchParams.set('type','branch');
  u.searchParams.set('locale','ru_RU');
  u.searchParams.set('page_size',String(Math.max(1,Math.min(limit,20))));
  u.searchParams.set('fields','items.rubrics,items.full_address_name');
  u.searchParams.set('key',env.DGIS_API_KEY);
  const j=await fetchJson(u.toString(),{},9000);
  return (j?.result?.items||[]).map(x=>({
    id:text(x.id),name:text(x.name||x.name_ex?.primary||x.full_name),address:text(x.full_address_name||x.address_name),
    rubrics:(x.rubrics||[]).map(r=>text(r.name)).filter(Boolean),
  })).filter(x=>x.name);
}

function candidateFromWeb(doc,type,query,city){
  const host=hostOf(doc.url);
  const isPrivate=host==='uslugi.yandex.ru'||host.endsWith('.uslugi.yandex.ru');
  if(type==='private'&&!isPrivate)return null;
  if(type==='company'&&(isPrivate||isPlatformHost(host)))return null;
  const name=text(doc.title).replace(/\s*[—|-].*$/,'').trim()||host;
  if(!name)return null;
  const sid='ys-'+Math.random().toString(36).slice(2,9);
  const kind=isPrivate?'yandex_services':'web_search';
  const label=isPrivate?'Яндекс Исполнители':'Веб-поиск / сайт';
  const src=source(sid,kind,label,doc.url);
  return {
    id:'web-'+(host||normalizeName(name).replace(/\s+/g,'-')).replace(/[^a-z0-9а-я-]/g,'').slice(0,60),
    name,type:isPrivate?'private':'company',geo:city||'',website:isPrivate?'':doc.url,
    description:text(doc.description),query,
    sources:[src],facts:[fact('confirmed',isPrivate?'Профиль найден в Яндекс Исполнителях.':'Страница найдена в поисковой выдаче Яндекса.',sid)],
    rankReasons:[],internalScore:0
  };
}

function candidateFrom2gis(item,query,city){
  const link='https://2gis.ru/search/'+encodeURIComponent(`${item.name} ${city}`.trim());
  const sid='2g-'+item.id;
  return {
    id:'2gis-'+item.id,name:item.name,type:'company',geo:item.address||city||'',website:'',description:item.rubrics.join(', '),query,
    sources:[source(sid,'2gis','2ГИС',link)],facts:[fact('confirmed',`Организация найдена в 2ГИС${item.address?' по адресу '+item.address:''}.`,sid)],
    rankReasons:[],internalScore:0
  };
}

function mergeCandidates(candidates){
  const out=[];
  for(const c of candidates){
    if(!c)continue;
    const h=c.website?hostOf(c.website):'';
    let found=out.find(x=>{
      if(x.type!==c.type)return false;
      const xh=x.website?hostOf(x.website):'';
      if(h&&xh&&h===xh)return true;
      const ov=overlap(x.name,c.name);
      return ov>=0.75;
    });
    if(!found){ out.push(c); continue; }
    found.sources=[...found.sources,...c.sources].filter((s,i,a)=>a.findIndex(z=>z.url===s.url)===i);
    found.facts=[...found.facts,...c.facts].filter((f,i,a)=>a.findIndex(z=>z.label===f.label)===i);
    if(!found.geo&&c.geo)found.geo=c.geo;
    if(!found.description&&c.description)found.description=c.description;
    if(!found.website&&c.website)found.website=c.website;
  }
  return out;
}

export function qualifyCandidateForTask(c,task,configOverride){
  const config=configOverride||CATEGORY_CONFIG[text(task&&task.categoryId)||''];
  if(!config)return {status:'unsupported',qualified:false,reasons:['Категория не поддерживается поиском.']};
  const hay=lower([c&&c.name,c&&c.description,c&&c.geo].join(' '));
  const matched=(config.qualifyKeywords||config.keywords||[]).filter(k=>hay.includes(lower(k)));
  const city=lower(task&&task.city); const geoKnown=lower(c&&c.geo);
  const geoOk=!city||!geoKnown||geoKnown.includes(city)||city.includes(geoKnown);
  const reasons=[]; if(matched.length)reasons.push('В данных кандидата подтверждена профильная специализация.');
  if(geoOk)reasons.push('География не противоречит задаче.');
  const qualified=matched.length>0&&geoOk;
  return {status:qualified?'qualified':(matched.length?'geo_check':'needs_verification'),qualified,matchedKeywords:matched,reasons};
}

function scoreCandidate(c,task,config){
  let s=25; const why=[];
  const qualification=qualifyCandidateForTask(c,task,config); c.qualification=qualification;
  if(qualification.qualified){s+=15;why.push('Профильность исполнителя подтверждена найденными данными.');}else{s-=12;why.push('Профильность по этой услуге требует дополнительной проверки.');}
  const hay=lower([c.name,c.description,c.geo,c.query].join(' '));
  const kw=config.keywords.filter(k=>hay.includes(k));
  if(kw.length){s+=20;why.push('В найденных данных есть профильные слова по нужной услуге.');}
  const city=lower(task.city);
  if(city&&hay.includes(city)){s+=18;why.push('География совпадает с объектом.');}
  if(c.type==='private'&&c.sources.some(x=>x.kind==='yandex_services')){s+=15;why.push('Есть профиль частного мастера в Яндекс Исполнителях.');}
  if(c.type==='company'&&c.website){s+=15;why.push('Найден собственный сайт компании.');}
  if(c.sources.length>1){s+=12;why.push('Кандидат подтверждается несколькими источниками.');}
  if(task.executorPreference==='company'&&c.type==='company'){s+=5;why.push('Соответствует выбранному типу: компания.');}
  if(task.executorPreference==='private'&&c.type==='private'){s+=5;why.push('Соответствует выбранному типу: частный мастер.');}
  const desc=lower(task.description||task.scope||'');
  if(desc&&overlap(desc,hay)>0.08){s+=5;why.push('Описание кандидата пересекается с формулировкой задачи.');}
  s=Math.max(0,Math.min(100,s));
  c.internalScore=s;
  c.matchLevel=s>=80?'Очень высокое':s>=65?'Высокое':s>=50?'Среднее':'Низкое';
  c.rankReasons=uniq(why).slice(0,4);
  if(!c.rankReasons.length)c.rankReasons=['Кандидат попал в выдачу по профильному поисковому запросу.'];
  if(!c.facts.some(f=>f.status==='unknown'))c.facts.push(fact('unknown','Минимальный объём заказа, срок старта и окончательная цена требуют запроса исполнителю.'));
  return c;
}

function publicCandidate(c){
  const {internalScore,...safe}=c;
  safe.sources=safe.sources.map(s=>({...s,checkedAt:s.checkedAt}));
  return safe;
}

export async function searchCandidates(env,input){
  const categoryId=text(input.categoryId)||'balcony-insulation';
  const config=CATEGORY_CONFIG[categoryId];
  if(!config) return {ok:false,status:400,error:'CATEGORY_NOT_SUPPORTED',message:'Категория пока не подключена к автоматическому поиску.'};
  const city=text(input.city).slice(0,120);
  if(!city)return {ok:false,status:400,error:'CITY_REQUIRED',message:'Нужен город или район для поиска.'};
  const pref=['company','private','any'].includes(input.executorPreference)?input.executorPreference:'any';
  if(!env.YANDEX_SEARCH_API_KEY&&!env.DGIS_API_KEY){return {ok:false,status:503,error:'SEARCH_NOT_CONFIGURED',message:'Поисковые провайдеры ещё не настроены.'};}
  const jobs=[];
  if(pref!=='private'){
    for(const q of config.companyQueries.slice(0,2)){
      if(env.YANDEX_SEARCH_API_KEY)jobs.push(yandexWebSearch(env,`${q} ${city}`,10).then(d=>d.map(x=>candidateFromWeb(x,'company',q,city))).catch(()=>[]));
      if(env.DGIS_API_KEY)jobs.push(dgisSearch(env,q,city,10).then(d=>d.map(x=>candidateFrom2gis(x,q,city))).catch(()=>[]));
    }
  }
  if(pref!=='company'&&env.YANDEX_SEARCH_API_KEY){
    for(const q of config.privateQueries.slice(0,2)){
      jobs.push(yandexWebSearch(env,`site:uslugi.yandex.ru ${q} ${city}`,10).then(d=>d.map(x=>candidateFromWeb(x,'private',q,city))).catch(()=>[]));
    }
  }
  const nested=await Promise.all(jobs);
  let merged=mergeCandidates(nested.flat().filter(Boolean));
  const task={...input,city,executorPreference:pref};
  merged=merged.map(c=>scoreCandidate(c,task,config)).sort((a,b)=>b.internalScore-a.internalScore||b.sources.length-a.sources.length);
  const max=Math.max(1,Math.min(Number(input.limit)||10,15));
  merged=merged.slice(0,max).map(publicCandidate);
  return {ok:true,status:200,query:{categoryId,city,executorPreference:pref},providers:{yandexSearch:Boolean(env.YANDEX_SEARCH_API_KEY),dgis:Boolean(env.DGIS_API_KEY)},count:merged.length,candidates:merged,generatedAt:checkedAt()};
}
