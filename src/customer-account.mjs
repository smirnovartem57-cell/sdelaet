import { listTaskOffers, getOfferDialogueHistory } from './offer-pipeline.mjs';
import fs from 'node:fs';
import { candidatePublicEvidence } from './candidate-public-evidence.mjs';
import crypto from 'node:crypto';

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

export function createCustomerAccount({db,customerAuth,sendJson,authorizeOutreach=null,paymentStoreFile=process.env.PAYMENT_STORE_FILE||'/var/lib/sdelaet-payments/orders.json',paymentApiUrl='http://127.0.0.1:8790'}){
 db.exec(
  'CREATE TABLE IF NOT EXISTS customer_task_owners(task_id TEXT PRIMARY KEY,email TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);'+
  'CREATE INDEX IF NOT EXISTS idx_customer_task_owners_email ON customer_task_owners(email,updated_at);'+
  'CREATE TABLE IF NOT EXISTS customer_profiles(email TEXT PRIMARY KEY,region TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);'+
  'CREATE TABLE IF NOT EXISTS task_attribution(task_id TEXT PRIMARY KEY,ym_client_id TEXT,internal_user_id TEXT,first_touch_json TEXT,last_touch_json TEXT,intent_cluster TEXT,attribution_saved_at TEXT NOT NULL,client_id_bound_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);'+
  'CREATE INDEX IF NOT EXISTS idx_task_attribution_client ON task_attribution(ym_client_id,attribution_saved_at);'+
  'CREATE TABLE IF NOT EXISTS crm_task_state(task_id TEXT PRIMARY KEY,ym_client_id TEXT,attribution_json TEXT NOT NULL DEFAULT \'{}\',first_source TEXT,first_medium TEXT,first_campaign TEXT,first_content TEXT,first_term TEXT,first_yclid TEXT,first_intent TEXT,first_landing_page TEXT,first_referrer TEXT,first_touch_date TEXT,last_source TEXT,last_medium TEXT,last_campaign TEXT,last_content TEXT,last_term TEXT,last_yclid TEXT,last_intent TEXT,last_landing_page TEXT,last_referrer TEXT,last_touch_date TEXT,service_id TEXT,service_name TEXT,city TEXT,task_created_at TEXT,selected_tariff TEXT,tariff_price INTEGER,payment_id TEXT,payment_status TEXT,paid_amount INTEGER,paid_at TEXT,updated_at TEXT NOT NULL);'
 );
 const profileCols=new Set(db.prepare('PRAGMA table_info(customer_profiles)').all().map(x=>x.name));
 if(!profileCols.has('geo_json'))db.exec('ALTER TABLE customer_profiles ADD COLUMN geo_json TEXT');
 if(!profileCols.has('name'))db.exec('ALTER TABLE customer_profiles ADD COLUMN name TEXT');
 if(!profileCols.has('phone'))db.exec('ALTER TABLE customer_profiles ADD COLUMN phone TEXT');
 if(!profileCols.has('notification_channel'))db.exec('ALTER TABLE customer_profiles ADD COLUMN notification_channel TEXT');
 function requireSession(req){const s=customerAuth.getSession(req);if(!s?.email){const e=new Error('AUTH_REQUIRED');e.status=401;throw e}return norm(s.email)}
 function ensureClientForEmail(email){
  const normalized=norm(email);
  if(!normalized){const e=new Error('AUTH_EMAIL_REQUIRED');e.status=400;throw e}
  const existing=db.prepare("SELECT client_id_crm FROM clients WHERE lower(COALESCE(email_normalized,email,''))=? ORDER BY created_at ASC LIMIT 1").get(normalized);
  if(existing?.client_id_crm)return text(existing.client_id_crm);
  const ts=now(),clientId='client_account_'+crypto.createHash('sha256').update(normalized).digest('hex').slice(0,20);
  const byId=db.prepare('SELECT client_id_crm FROM clients WHERE client_id_crm=?').get(clientId);
  if(byId?.client_id_crm)return text(byId.client_id_crm);
  db.prepare(`
    INSERT INTO clients(
      client_id_crm,name,phone,phone_normalized,email,email_normalized,
      preferred_contact,ym_client_id,consent_personal_data,consent_at,
      consent_version,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    clientId,'','', '',normalized,normalized,
    'email',null,0,null,null,ts,ts
  );
  return clientId;
 }
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
  if(paid&&latest){const lim=T[s.payment.plan]?.limit||5;candidates=db.prepare('SELECT candidate_id,type,name,match_level,website,phone,address,raw_json FROM candidates WHERE run_id=? ORDER BY rowid LIMIT ?').all(latest.id,lim).map(x=>{const r=parse(x.raw_json,{});return{
   id:x.candidate_id,
   type:x.type,
   name:x.name,
   matchLevel:x.match_level,
   website:x.website,
   phone:x.phone,
   address:x.address,
   geo:text(r.geo||r.city||r.region||''),
   email:text(r.email||(Array.isArray(r.emails)?r.emails[0]:'')),
   telegram:text(r.telegram||(Array.isArray(r.telegrams)?r.telegrams[0]:'')),
   evidence:candidatePublicEvidence(r),
   why:Array.isArray(r.rankReasons)?r.rankReasons:(r.reason?[r.reason]:[]),
   facts:Array.isArray(r.facts)?r.facts.slice(0,24):[],
   sources:Array.isArray(r.sources)?r.sources.slice(0,24):[],
   selectionBreakdown:r.selectionBreakdown&&typeof r.selectionBreakdown==='object'?r.selectionBreakdown:null,
   trustProfile:r.trustProfile&&typeof r.trustProfile==='object'?r.trustProfile:null,
   legalIdentity:r.legalIdentity&&typeof r.legalIdentity==='object'?r.legalIdentity:null,
   fnsProfile:r.fnsProfile&&typeof r.fnsProfile==='object'?r.fnsProfile:null,
   claimedExperience:r.claimedExperience&&typeof r.claimedExperience==='object'?r.claimedExperience:null,
   yandexServicesProfile:r.yandexServicesProfile&&typeof r.yandexServicesProfile==='object'?r.yandexServicesProfile:null,
   reputation:r.reputation&&typeof r.reputation==='object'?r.reputation:null
  }})}
  const outreach=db.prepare('SELECT request_id,candidate_id,candidate_name,channel,recipient,status,prepared_at,sent_at,delivered_at,replied_at,failed_at,last_error FROM outreach_attempts WHERE task_id=? ORDER BY prepared_at DESC LIMIT 50').all(id).map(x=>({requestId:x.request_id,candidateId:x.candidate_id,candidateName:x.candidate_name,channel:x.channel,recipient:x.recipient,status:x.status,preparedAt:x.prepared_at,sentAt:x.sent_at,deliveredAt:x.delivered_at,repliedAt:x.replied_at,failedAt:x.failed_at,lastError:x.last_error}));
  const replies=db.prepare('SELECT request_id,candidate_id,reply_type,channel,raw_text,received_at FROM contractor_replies WHERE task_id=? ORDER BY received_at DESC LIMIT 50').all(id);
  const offers=listTaskOffers(db,id).map(x=>({candidateId:x.candidate_id,requestId:x.request_id,offerId:x.offer_id,version:x.version,comparable:x.comparable,comparisonStatus:x.comparison_status,normalized:x.normalized,gaps:x.gaps,risks:x.risks,dialogue:x.dialogue,createdAt:x.created_at,updatedAt:x.updated_at}));
  const dialogues={};for(const o of offers){if(o.requestId&&!dialogues[o.requestId])dialogues[o.requestId]=getOfferDialogueHistory(db,o.requestId)}
  return{...s,candidates,outreach,replies,offers,dialogues,attribution:taskAttribution(id),pricing:pricing(email)}
 }
 function safeTouch(v){const x=v&&typeof v==='object'?v:{};const out={};['source','medium','campaign','content','term','yclid','intent_cluster','landing_page','referrer','timestamp'].forEach(k=>{const val=text(x[k]);if(val)out[k]=val.slice(0,k==='referrer'||k==='landing_page'?1500:500)});return out}
 function saveAttributionSnapshot(taskId,a){
  if(!a||typeof a!=='object')return null;
  const existing=db.prepare('SELECT * FROM task_attribution WHERE task_id=?').get(taskId);if(existing)return existing;
  const first=safeTouch(a.first_touch),last=safeTouch(a.last_touch),intent=text(a.intent_cluster||last.intent_cluster||first.intent_cluster).slice(0,80),client=text(a.ym_client_id).slice(0,100),ts=text(a.attribution_saved_at)||now();
  db.prepare('INSERT INTO task_attribution(task_id,ym_client_id,internal_user_id,first_touch_json,last_touch_json,intent_cluster,attribution_saved_at,client_id_bound_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(taskId,client||null,null,JSON.stringify(first),JSON.stringify(last),intent||null,ts,client?ts:null,ts,ts);
  return db.prepare('SELECT * FROM task_attribution WHERE task_id=?').get(taskId)
 }
 function syncCrmTask(taskId){
  const task=db.prepare('SELECT task_id,service_id,service_name,city,created_at FROM tasks WHERE task_id=?').get(taskId);if(!task)return null;
  const a=taskAttribution(taskId)||{},f=safeTouch(a.first_touch),l=safeTouch(a.last_touch),ts=now();
  db.prepare(`INSERT INTO crm_task_state(task_id,ym_client_id,attribution_json,first_source,first_medium,first_campaign,first_content,first_term,first_yclid,first_intent,first_landing_page,first_referrer,first_touch_date,last_source,last_medium,last_campaign,last_content,last_term,last_yclid,last_intent,last_landing_page,last_referrer,last_touch_date,service_id,service_name,city,task_created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(task_id) DO UPDATE SET ym_client_id=excluded.ym_client_id,attribution_json=excluded.attribution_json,service_id=excluded.service_id,service_name=excluded.service_name,city=excluded.city,updated_at=excluded.updated_at`).run(taskId,a.ym_client_id||null,JSON.stringify(a),f.source||null,f.medium||null,f.campaign||null,f.content||null,f.term||null,f.yclid||null,f.intent_cluster||a.intent_cluster||null,f.landing_page||null,f.referrer||null,f.timestamp||null,l.source||null,l.medium||null,l.campaign||null,l.content||null,l.term||null,l.yclid||null,l.intent_cluster||a.intent_cluster||null,l.landing_page||null,l.referrer||null,l.timestamp||null,task.service_id||null,task.service_name||null,task.city||null,task.created_at||null,ts);
  return db.prepare('SELECT * FROM crm_task_state WHERE task_id=?').get(taskId)
 }
 function recordPaymentLifecycle(taskId,{paymentId='',status='',tariff='',amount=0,paidAmount=0,paidAt=null}={}){
  syncCrmTask(taskId);const ts=now();db.prepare('UPDATE crm_task_state SET selected_tariff=COALESCE(NULLIF(?,\'\'),selected_tariff),tariff_price=CASE WHEN ?>0 THEN ? ELSE tariff_price END,payment_id=COALESCE(NULLIF(?,\'\'),payment_id),payment_status=COALESCE(NULLIF(?,\'\'),payment_status),paid_amount=CASE WHEN ?>0 THEN ? ELSE paid_amount END,paid_at=COALESCE(?,paid_at),updated_at=? WHERE task_id=?').run(tariff,Number(amount),Number(amount),paymentId,status,Number(paidAmount),Number(paidAmount),paidAt,ts,taskId);return db.prepare('SELECT * FROM crm_task_state WHERE task_id=?').get(taskId)
 }
 function captureAttribution(taskId,a){const r=saveAttributionSnapshot(taskId,a);syncCrmTask(taskId);return r}
 function bindClientId(email,taskId,value){owner(email,taskId);const id=text(value).slice(0,100);if(!id){const e=new Error('YM_CLIENT_ID_REQUIRED');e.status=400;throw e}const row=db.prepare('SELECT ym_client_id FROM task_attribution WHERE task_id=?').get(taskId);if(!row){const e=new Error('TASK_ATTRIBUTION_NOT_FOUND');e.status=404;throw e}if(row.ym_client_id&&row.ym_client_id!==id){const e=new Error('YM_CLIENT_ID_IMMUTABLE');e.status=409;throw e}const ts=now();db.prepare('UPDATE task_attribution SET ym_client_id=COALESCE(ym_client_id,?),client_id_bound_at=COALESCE(client_id_bound_at,?),updated_at=? WHERE task_id=?').run(id,ts,ts,taskId);syncCrmTask(taskId);return{id}}
 function taskAttribution(taskId){const r=db.prepare('SELECT * FROM task_attribution WHERE task_id=?').get(taskId);return r?{ym_client_id:r.ym_client_id||'',first_touch:parse(r.first_touch_json,{}),last_touch:parse(r.last_touch_json,{}),intent_cluster:r.intent_cluster||'',attribution_saved_at:r.attribution_saved_at}:null}
 function upsert(email,t){
  if(!t||typeof t!=='object'){const e=new Error('TASK_REQUIRED');e.status=400;throw e}const id=text(t.id||t.taskId);if(!id){const e=new Error('TASK_ID_REQUIRED');e.status=400;throw e}
  sync(email);const old=db.prepare('SELECT task_id,client_id_crm,status FROM tasks WHERE task_id=?').get(id),o=db.prepare('SELECT email FROM customer_task_owners WHERE task_id=?').get(id);
  if(o&&norm(o.email)!==email){const e=new Error('TASK_NOT_FOUND');e.status=404;throw e}
  if(old&&!o&&old.client_id_crm){const c=db.prepare('SELECT email,email_normalized FROM clients WHERE client_id_crm=?').get(old.client_id_crm);if(c&&norm(c.email_normalized||c.email)!==email){const e=new Error('TASK_NOT_FOUND');e.status=404;throw e}}
  const ts=now(),clientIdCrm=text(old?.client_id_crm)||ensureClientForEmail(email);
  if(!old)db.prepare("INSERT INTO tasks(task_id,client_id_crm,service_id,service_name,city,description,task_json,status,created_at,updated_at,last_completed_stage) VALUES(?,?,?,?,?,?,?,'draft',?,?,NULL)").run(id,clientIdCrm,text(t.categoryId),text(t.category||t.raw_service||'Задача'),text(t.locality||t.city||t.region),text(t.description||t.scope||t.raw_service),JSON.stringify(t),ts,ts);
  else db.prepare('UPDATE tasks SET client_id_crm=?,service_id=?,service_name=?,city=?,description=?,task_json=?,status=?,updated_at=? WHERE task_id=?').run(clientIdCrm,text(t.categoryId),text(t.category||t.raw_service||'Задача'),text(t.locality||t.city||t.region),text(t.description||t.scope||t.raw_service),JSON.stringify(t),['draft',''].includes(text(old.status))?'draft':old.status,ts,id);
  db.prepare('INSERT INTO customer_task_owners(task_id,email,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(task_id) DO UPDATE SET email=excluded.email,updated_at=excluded.updated_at').run(id,email,ts,ts);
  const attr=saveAttributionSnapshot(id,t.attribution||t._attribution||null);
  syncCrmTask(id);
  return detail(email,id)
 }
 function profile(email){
  const r=db.prepare('SELECT region,geo_json,name,phone,notification_channel,updated_at FROM customer_profiles WHERE email=?').get(email);
  const client=db.prepare("SELECT name,phone,preferred_contact FROM clients WHERE lower(COALESCE(email_normalized,email,''))=? ORDER BY created_at ASC LIMIT 1").get(email)||{};
  return{
   email,
   region:r?.region||'',
   geo:r?.geo_json?parse(r.geo_json,null):null,
   name:text(r?.name||client.name||''),
   phone:text(r?.phone||client.phone||''),
   notificationChannel:['email','telegram','both'].includes(text(r?.notification_channel))?text(r.notification_channel):(text(client.preferred_contact)==='telegram'?'telegram':'email'),
   updatedAt:r?.updated_at||null
  }
 }
 function saveProfile(email,b){
  const current=profile(email),region=text(b?.region!==undefined?b.region:current.region).slice(0,160),geo=safeGeo(b?.geo!==undefined?b.geo:current.geo,region),label=region||geo.canonicalLocality||geo.canonicalRegion,ts=now();
  const name=text(b?.name!==undefined?b.name:current.name).slice(0,100),phone=text(b?.phone!==undefined?b.phone:current.phone).slice(0,50),notificationChannel=['email','telegram','both'].includes(text(b?.notificationChannel||b?.notification_channel))?text(b.notificationChannel||b.notification_channel):(current.notificationChannel||'email');
  db.prepare('INSERT INTO customer_profiles(email,region,created_at,updated_at,geo_json,name,phone,notification_channel) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET region=excluded.region,updated_at=excluded.updated_at,geo_json=excluded.geo_json,name=excluded.name,phone=excluded.phone,notification_channel=excluded.notification_channel').run(email,label,ts,ts,JSON.stringify(geo),name,phone,notificationChannel);
  const clientId=ensureClientForEmail(email);
  db.prepare('UPDATE clients SET name=COALESCE(NULLIF(?,\'\'),name),phone=COALESCE(NULLIF(?,\'\'),phone),phone_normalized=COALESCE(NULLIF(?,\'\'),phone_normalized),preferred_contact=?,updated_at=? WHERE client_id_crm=?').run(name,phone,phone.replace(/\D+/g,''),notificationChannel==='telegram'?'telegram':'email',ts,clientId);
  return profile(email)
 }
 function authorize(email,id,plan){owner(email,id);if(!T[plan]){const e=new Error('UNKNOWN_TARIFF');e.status=400;throw e}if(taskPayments(email,id).some(x=>x.status==='paid')){const e=new Error('TASK_ALREADY_PAID');e.status=409;throw e}if(!entitlement(email).eligible){const e=new Error('REPEAT_DISCOUNT_NOT_AVAILABLE');e.status=403;throw e}return{allowed:true,taskId:id,plan,repeatPlan:plan+'_repeat'}}
 async function createPayment(req,email,b){
  const id=text(b?.taskId||b?.task_id),tariff=text(b?.tariffId||b?.tariff_id);if(!id||!T[tariff]){const e=new Error('TASK_AND_TARIFF_REQUIRED');e.status=400;throw e}owner(email,id);
  const taskPay=taskPayments(email,id);if(taskPay.some(x=>x.status==='paid')){const e=new Error('TASK_ALREADY_PAID');e.status=409;throw e}
  const existing=taskPay.find(x=>x.status==='pending'&&basePlan(x.plan)===tariff&&x.paymentUrl);if(existing)return{ok:true,reused:true,orderId:existing.id,paymentUrl:existing.paymentUrl,plan:tariff,amount:Number(existing.amount),regularAmount:Number(existing.regularAmount||T[tariff].regular),priceType:existing.priceType||(repeatPlan(existing.plan)?'repeat':'regular')};
  const pr=pricing(email),rep=pr.repeatDiscount.eligible,plan=rep?tariff+'_repeat':tariff;
  const attr=taskAttribution(id);
  const taskRow=db.prepare('SELECT service_id,service_name,city,created_at FROM tasks WHERE task_id=?').get(id)||{};
  const rr=await fetch(paymentApiUrl+'/v1/payments',{method:'POST',headers:{'content-type':'application/json','cookie':text(req.headers.cookie)},body:JSON.stringify({plan,taskId:id,email,ymClientId:attr?.ym_client_id||'',attribution:attr||null,serviceId:taskRow.service_id||'',serviceName:taskRow.service_name||'',city:taskRow.city||''})}),d=await rr.json().catch(()=>({}));
  if(!rr.ok||!d.ok){const e=new Error(d.error||'PAYMENT_LINK_FAILED');e.status=rr.status||500;throw e}
  recordPaymentLifecycle(id,{paymentId:d.orderId,status:'pending',tariff:plan,amount:pr.tariffs[tariff].amount});
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
   const cid=u.pathname.match(/^\/v1\/account\/tasks\/([^/]+)\/client-id$/);if(req.method==='POST'&&cid){const b=await body(req);reply(res,200,{ok:true,...bindClientId(email,decodeURIComponent(cid[1]),b.ym_client_id)},origin);return true}
   const oa=u.pathname.match(/^\/v1\/account\/tasks\/([^/]+)\/outreach-authorize$/);
   if(req.method==='POST'&&oa){const taskId=decodeURIComponent(oa[1]);owner(email,taskId);if(typeof authorizeOutreach!=='function'){const e=new Error('OUTREACH_AUTHORIZATION_UNAVAILABLE');e.status=503;throw e}const b=await body(req);const message=text(b.message),candidateIds=[...new Set((Array.isArray(b.candidateIds)?b.candidateIds:[b.candidateId||b.candidate_id]).map(text).filter(Boolean))];if(!message||!candidateIds.length||b.explicitConfirm!==true){const e=new Error('OUTREACH_CONFIRMATION_REQUIRED');e.status=400;throw e}const ps=taskPayments(email,taskId),paid=ps.find(x=>x.status==='paid');if(!paid){const e=new Error('PAID_ENTITLEMENT_REQUIRED');e.status=403;throw e}const result=await authorizeOutreach({taskId,orderId:paid.id,idempotencyKey:text(b.idempotencyKey||b.idempotency_key)||('account:'+taskId+':'+candidateIds.slice().sort().join(',')+':'+Date.now()),candidateIds,message,explicitConfirm:true});reply(res,200,{ok:true,authorized:true,...result},origin);return true}
   reply(res,404,{ok:false,error:'ACCOUNT_ROUTE_NOT_FOUND'},origin);return true
  }catch(e){reply(res,e?.status||500,{ok:false,error:e?.message||'ACCOUNT_FAILED'},origin);return true}
 }
 return{handle,recordPaymentLifecycle,captureAttribution,_test:{upsert,detail,list,pricing,entitlement,owner,sync,ensureClientForEmail,authorize,profile,saveProfile,taskAttribution,syncCrmTask,recordPaymentLifecycle}}
}
