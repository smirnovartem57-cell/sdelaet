import fs from 'node:fs';

const T={
 find:{id:'find',name:'Подбор',regular:990,repeat:690,limit:5},
 choice:{id:'choice',name:'До выбора',regular:2590,repeat:1790,limit:15}
};
const text=v=>String(v??'').trim();
const norm=v=>text(v).toLowerCase();
const now=()=>new Date().toISOString();
const basePlan=p=>String(p||'').replace(/_repeat$/,'');
const repeatPlan=p=>/_repeat$/.test(String(p||''));
function parse(v,fallback={}){try{return typeof v==='string'?JSON.parse(v||'{}'):(v&&typeof v==='object'?v:fallback)}catch{return fallback}}
function safeGeo(v,regionFallback=''){
  const g=v&&typeof v==='object'?v:{};
  const region=text(g.canonicalRegion||regionFallback).slice(0,160);
  const locality=text(g.canonicalLocality).slice(0,160);
  const regionId=/^ru-[a-z0-9-]+$/.test(text(g.regionId))?text(g.regionId):'';
  const localityId=/^ru-[a-z0-9-]+$/.test(text(g.localityId))?text(g.localityId):'';
  const scope=['market_area','region','locality','unknown'].includes(text(g.scope))?text(g.scope):(locality?'locality':region?'region':'unknown');
  const launchZone=['moscow_mo_pilot','russia','unknown'].includes(text(g.launchZone))?text(g.launchZone):(['ru-mow','ru-mos','ru-moscow-area'].includes(regionId)?'moscow_mo_pilot':regionId?'russia':'unknown');
  return {rawGeo:text(g.rawGeo||locality||region).slice(0,200),canonicalRegion:region,canonicalLocality:locality,regionId,localityId,countryCode:'RU',confidence:['high','medium','low'].includes(text(g.confidence))?text(g.confidence):'low',needsConfirmation:g.needsConfirmation===true,source:text(g.source||'account').slice(0,80),scope,launchZone};
}
function body(req,max=524288){return new Promise((ok,fail)=>{let n=0,a=[];req.on('data',c=>{n+=c.length;if(n>max){fail(Object.assign(new Error('PAYLOAD_TOO_LARGE'),{status:413}));req.destroy();return}a.push(c)});req.on('end',()=>{try{ok(JSON.parse(Buffer.concat(a).toString('utf8')||'{}'))}catch{fail(Object.assign(new Error('BAD_JSON'),{status:400}))}});req.on('error',fail)})}

export function createCustomerAccount({db,customerAuth,sendJson,paymentStoreFile=process.env.PAYMENT_STORE_FILE||'/var/lib/sdelaet-payments/orders.json',paymentApiUrl='http://127.0.0.1:8790'}){
 db.exec(
  'CREATE TABLE IF NOT EXISTS customer_task_owners(task_id TEXT PRIMARY KEY,email TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);'+
  'CREATE INDEX IF NOT EXISTS idx_customer_task_owners_email ON customer_task_owners(email,updated_at);'+
  'CREATE TABLE IF NOT EXISTS customer_profiles(email TEXT PRIMARY KEY,region TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);'
 );
 const profileCols=new Set(db.prepare('PRAGMA table_info(customer_profiles)').all().map(x=>x.name));
 if(!profileCols.has('geo_json'))db.exec('ALTER TABLE customer_profiles ADD COLUMN geo_json TEXT');
 function requireSession(req){const s=customerAuth.getSession(req);if(!s?.email){const e=new Error('AUTH_REQUIRED');e.status=401;throw e}return norm(s.email)}
 function sync(email){
  const rows=db.prepare("SELECT DISTINCT t.task_id FROM tasks t INNER JOIN clients c ON c.client_id_crm=t.client_id_crm WHERE lower(COALESCE(c.email_normalized,c.email,''))=?").all(email);
  const q=db.prepare('INSERT INTO customer_task_owners(task_id,email,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(task_id) DO NOTHING'),ts=now();
  rows.forEach(r=>q.run(r.task_id,email,ts,ts));
 }
 function owner(email,id){sync(email);const r=db.prepare('SELECT email FROM customer_task_owners WHERE task_id=?').get(id);if(!r||norm(r.email)!==email){const e=new Error('TASK_NOT_FOUND');e.status=404;throw e}}
 function payStore(){try{return Object.values(JSON.parse(fs.readFileSync(paymentStoreFile,'utf8')||'{}')).filter(Boolean)}catch{return[]}}
 function ids(email){sync(email);return new Set(db.prepare('SELECT task_id FROM customer_task_owners WHERE email=?').all(email).map(x=>text(x.task_id)))}
 function payments(email){const own=ids(email);return payStore().filter(x=>own.has(text(x.taskId)))}
 function taskPayments(email,id){owner(email,id);return payStore().filter(x=>text(x.taskId)===id).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))}
 function entitlement(email){
  const p=payments(email);
  const paid=new Set(p.filter(x=>x.status==='paid').map(x=>text(x.taskId)).filter(Boolean));
  const used=new Set(p.filter(x=>repeatPlan(x.plan)&&['pending','paid'].includes(x.status)).map(x=>text(x.taskId)).filter(Boolean));
  return{eligible:paid.size>used.size,paidTaskCount:paid.size,repeatUsedCount:used.size}
 }
 function pricing(email){
  const r=entitlement(email),tariffs={};
  Object.values(T).forEach(x=>tariffs[x.id]={id:x.id,name:x.name,regularAmount:x.regular,repeatAmount:x.repeat,amount:r.eligible?x.repeat:x.regular,priceType:r.eligible?'repeat':'regular'});
  return{repeatDiscount:{eligible:r.eligible,percent:30,...r},tariffs}
 }
 function aggregate(email,row){
  const id=text(row.task_id),j=parse(row.task_json,{});
  const run=db.prepare("SELECT id,created_at,candidate_count,status FROM search_runs WHERE task_id=? AND status='ok' AND COALESCE(previous_run_id,'')='' ORDER BY created_at DESC LIMIT 1").get(id)||db.prepare("SELECT id,created_at,candidate_count,status FROM search_runs WHERE task_id=? AND status='ok' ORDER BY created_at DESC LIMIT 1").get(id)||null;
  const outreach=Number(db.prepare("SELECT COUNT(*) n FROM outreach_attempts WHERE task_id=? AND status IN ('sent','delivered','replied')").get(id)?.n||0);
  const replies=Number(db.prepare('SELECT COUNT(*) n FROM contractor_replies WHERE task_id=?').get(id)?.n||0);
  const offers=Number(db.prepare('SELECT COUNT(*) n FROM contractor_offers WHERE task_id=?').get(id)?.n||0);
  const ps=taskPayments(email,id),paid=ps.find(x=>x.status==='paid')||null,pending=ps.find(x=>x.status==='pending')||null,p=paid||pending||ps[0]||null;
  let code='draft',label='Заполняем задачу',result='Нужно закончить описание задачи.',action='Продолжить описание',anchor='';
  if(row.completed_at){code='completed';label='Завершена';result='Задача сохранена в истории.';action='Открыть завершённую задачу'}
  else if(offers>0){code='offers_ready';label='Есть предложения';result='Предложений готово к сравнению: '+offers;action='Сравнить предложения';anchor='#comparison'}
  else if(outreach>0||replies>0){code='waiting_replies';label='Ждём ответы';result=replies?'Получено ответов: '+replies:'Обращения отправлены исполнителям.';action='Посмотреть исполнителей';anchor='#responses'}
  else if(paid){code='selection_open';label='Подбор открыт';result='Оплата подтверждена, найденные исполнители доступны.';action='Посмотреть исполнителей';anchor='#selection'}
  else if(run&&Number(run.candidate_count||0)>0){code='research_ready';label='Подходящие варианты найдены';result='Найдено вариантов: '+Number(run.candidate_count||0);action='Посмотреть результат исследования';anchor='#research'}
  else if(run){code='research_ready';label='Исследование завершено';result='Подходящих вариантов пока не найдено.';action='Посмотреть результат исследования';anchor='#research'}
  else if(['research_running','searching'].includes(text(row.status))){code='researching';label='Исследуем рынок';result='Бесплатное исследование рынка идёт.';action='Открыть задачу';anchor='#research'}
  return{
   taskId:id,title:text(j.category||row.service_name||j.raw_service||j.description||'Задача'),region:text(j.locality&&j.region&&j.locality!==j.region?(j.locality+', '+j.region):(j.locality||j.region||j.city||row.city||'Регион не указан')),
   description:text(j.description||row.description||''),rawService:text(j.raw_service||j.description||row.description||''),categoryId:text(j.categoryId||row.service_id||''),categoryStatus:text(j.category_status||'matched'),
   status:{code,label},keyResult:result,nextAction:{label:action,href:'/task.html?task='+encodeURIComponent(id)+anchor},
   createdAt:row.created_at,updatedAt:row.updated_at,lastCompletedStage:row.last_completed_stage||null,completedAt:row.completed_at||null,
   research:run?{runId:run.id,createdAt:run.created_at,candidateCount:Number(run.candidate_count||0),status:'completed'}:null,
   payment:p?{orderId:p.id,plan:basePlan(p.plan),planName:T[basePlan(p.plan)]?.name||p.plan,amount:Number(p.amount||0),regularAmount:Number(p.regularAmount||T[basePlan(p.plan)]?.regular||p.amount||0),priceType:p.priceType||(repeatPlan(p.plan)?'repeat':'regular'),status:p.status,createdAt:p.createdAt||null,paidAt:p.paidAt||null}:null,
   counts:{outreach,replies,offers,candidates:Number(run?.candidate_count||0)},taskJson:j
  }
 }
 function list(email){sync(email);return db.prepare('SELECT t.* FROM customer_task_owners o INNER JOIN tasks t ON t.task_id=o.task_id WHERE o.email=? ORDER BY COALESCE(t.updated_at,t.created_at) DESC').all(email).map(r=>aggregate(email,r))}
 function detail(email,id){
  owner(email,id);const row=db.prepare('SELECT * FROM tasks WHERE task_id=?').get(id);if(!row){const e=new Error('TASK_NOT_FOUND');e.status=404;throw e}
  const s=aggregate(email,row),latest=db.prepare("SELECT id FROM search_runs WHERE task_id=? AND status='ok' ORDER BY created_at DESC LIMIT 1").get(id),paid=s.payment?.status==='paid';let candidates=[];
  if(paid&&latest){const lim=T[s.payment.plan]?.limit||5;candidates=db.prepare('SELECT candidate_id,type,name,match_level,website,phone,address,raw_json FROM candidates WHERE run_id=? ORDER BY rowid LIMIT ?').all(latest.id,lim).map(x=>{const r=parse(x.raw_json,{});return{id:x.candidate_id,type:x.type,name:x.name,matchLevel:x.match_level,website:x.website,phone:x.phone,address:x.address,why:Array.isArray(r.rankReasons)?r.rankReasons:(r.reason?[r.reason]:[])}})}
  const replies=db.prepare('SELECT candidate_id,reply_type,channel,raw_text,received_at FROM contractor_replies WHERE task_id=? ORDER BY received_at DESC LIMIT 20').all(id);
  const offers=db.prepare('SELECT candidate_id,comparison_status,normalized_json,created_at,updated_at FROM contractor_offers WHERE task_id=? ORDER BY updated_at DESC LIMIT 20').all(id).map(x=>({candidateId:x.candidate_id,comparisonStatus:x.comparison_status,normalized:parse(x.normalized_json,{}),createdAt:x.created_at,updatedAt:x.updated_at}));
  return{...s,candidates,replies,offers,pricing:pricing(email)}
 }
 function upsert(email,t){
  if(!t||typeof t!=='object'){const e=new Error('TASK_REQUIRED');e.status=400;throw e}const id=text(t.id||t.taskId);if(!id){const e=new Error('TASK_ID_REQUIRED');e.status=400;throw e}
  sync(email);const old=db.prepare('SELECT task_id,client_id_crm,status FROM tasks WHERE task_id=?').get(id),o=db.prepare('SELECT email FROM customer_task_owners WHERE task_id=?').get(id);
  if(o&&norm(o.email)!==email){const e=new Error('TASK_NOT_FOUND');e.status=404;throw e}
  if(old&&!o&&old.client_id_crm){const c=db.prepare('SELECT email,email_normalized FROM clients WHERE client_id_crm=?').get(old.client_id_crm);if(c&&norm(c.email_normalized||c.email)!==email){const e=new Error('TASK_NOT_FOUND');e.status=404;throw e}}
  const ts=now();
  if(!old)db.prepare("INSERT INTO tasks(task_id,client_id_crm,service_id,service_name,city,description,task_json,status,created_at,updated_at,last_completed_stage) VALUES(?,NULL,?,?,?,?,?,'draft',?,?,NULL)").run(id,text(t.categoryId),text(t.category||t.raw_service||'Задача'),text(t.locality||t.city||t.region),text(t.description||t.scope||t.raw_service),JSON.stringify(t),ts,ts);
  else db.prepare('UPDATE tasks SET service_id=?,service_name=?,city=?,description=?,task_json=?,status=?,updated_at=? WHERE task_id=?').run(text(t.categoryId),text(t.category||t.raw_service||'Задача'),text(t.locality||t.city||t.region),text(t.description||t.scope||t.raw_service),JSON.stringify(t),['draft',''].includes(text(old.status))?'draft':old.status,ts,id);
  db.prepare('INSERT INTO customer_task_owners(task_id,email,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(task_id) DO UPDATE SET email=excluded.email,updated_at=excluded.updated_at').run(id,email,ts,ts);
  return detail(email,id)
 }
 function profile(email){const r=db.prepare('SELECT region,geo_json,updated_at FROM customer_profiles WHERE email=?').get(email);return{email,region:r?.region||'',geo:r?.geo_json?parse(r.geo_json,null):null,updatedAt:r?.updated_at||null}}
 function saveProfile(email,b){const region=text(b?.region).slice(0,160),geo=safeGeo(b?.geo,region),label=region||geo.canonicalLocality||geo.canonicalRegion,ts=now();db.prepare('INSERT INTO customer_profiles(email,region,created_at,updated_at,geo_json) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET region=excluded.region,updated_at=excluded.updated_at,geo_json=excluded.geo_json').run(email,label,ts,ts,JSON.stringify(geo));return profile(email)}
 function authorize(email,id,plan){owner(email,id);if(!T[plan]){const e=new Error('UNKNOWN_TARIFF');e.status=400;throw e}if(taskPayments(email,id).some(x=>x.status==='paid')){const e=new Error('TASK_ALREADY_PAID');e.status=409;throw e}if(!entitlement(email).eligible){const e=new Error('REPEAT_DISCOUNT_NOT_AVAILABLE');e.status=403;throw e}return{allowed:true,taskId:id,plan,repeatPlan:plan+'_repeat'}}
 async function createPayment(req,email,b){
  const id=text(b?.taskId||b?.task_id),tariff=text(b?.tariffId||b?.tariff_id);if(!id||!T[tariff]){const e=new Error('TASK_AND_TARIFF_REQUIRED');e.status=400;throw e}owner(email,id);
  const taskPay=taskPayments(email,id);if(taskPay.some(x=>x.status==='paid')){const e=new Error('TASK_ALREADY_PAID');e.status=409;throw e}
  const existing=taskPay.find(x=>x.status==='pending'&&basePlan(x.plan)===tariff&&x.paymentUrl);if(existing)return{ok:true,reused:true,orderId:existing.id,paymentUrl:existing.paymentUrl,plan:tariff,amount:Number(existing.amount),regularAmount:Number(existing.regularAmount||T[tariff].regular),priceType:existing.priceType||(repeatPlan(existing.plan)?'repeat':'regular')};
  const pr=pricing(email),rep=pr.repeatDiscount.eligible,plan=rep?tariff+'_repeat':tariff;
  const rr=await fetch(paymentApiUrl+'/v1/payments',{method:'POST',headers:{'content-type':'application/json','cookie':text(req.headers.cookie)},body:JSON.stringify({plan,taskId:id,email})}),d=await rr.json().catch(()=>({}));
  if(!rr.ok||!d.ok){const e=new Error(d.error||'PAYMENT_LINK_FAILED');e.status=rr.status||500;throw e}
  return{ok:true,reused:false,orderId:d.orderId,paymentUrl:d.paymentUrl,plan:tariff,amount:pr.tariffs[tariff].amount,regularAmount:pr.tariffs[tariff].regularAmount,priceType:rep?'repeat':'regular'}
 }
 const reply=(res,status,data,origin)=>sendJson(res,status,data,origin);
 async function handle(req,res,origin){
  const u=new URL(req.url||'/','http://localhost');if(!u.pathname.startsWith('/v1/account/'))return false;
  try{
   const email=requireSession(req);
   if(req.method==='GET'&&u.pathname==='/v1/account/tasks'){reply(res,200,{ok:true,tasks:list(email),pricing:pricing(email)},origin);return true}
   if(req.method==='POST'&&u.pathname==='/v1/account/tasks'){const b=await body(req);reply(res,200,{ok:true,task:upsert(email,b.task||b)},origin);return true}
   const m=u.pathname.match(/^\/v1\/account\/tasks\/([^/]+)$/);if(req.method==='GET'&&m){reply(res,200,{ok:true,task:detail(email,decodeURIComponent(m[1]))},origin);return true}
   if(req.method==='GET'&&u.pathname==='/v1/account/profile'){reply(res,200,{ok:true,profile:profile(email)},origin);return true}
   if(req.method==='POST'&&u.pathname==='/v1/account/profile'){reply(res,200,{ok:true,profile:saveProfile(email,await body(req))},origin);return true}
   if(req.method==='GET'&&u.pathname==='/v1/account/pricing'){const id=text(u.searchParams.get('taskId'));if(id)owner(email,id);reply(res,200,{ok:true,...pricing(email)},origin);return true}
   if(req.method==='POST'&&u.pathname==='/v1/account/payment-authorize'){const b=await body(req);reply(res,200,{ok:true,...authorize(email,text(b.taskId),text(b.plan))},origin);return true}
   if(req.method==='POST'&&u.pathname==='/v1/account/payment'){reply(res,200,await createPayment(req,email,await body(req)),origin);return true}
   reply(res,404,{ok:false,error:'ACCOUNT_ROUTE_NOT_FOUND'},origin);return true
  }catch(e){reply(res,e?.status||500,{ok:false,error:e?.message||'ACCOUNT_FAILED'},origin);return true}
 }
 return{handle,_test:{upsert,detail,list,pricing,entitlement,owner,sync,authorize,profile,saveProfile}}
}
