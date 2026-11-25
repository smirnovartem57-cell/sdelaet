import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {once} from 'node:events';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import http from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {createCustomerAccount} from '../src/customer-account.mjs';
import {getPlan} from '../payment-api/plans.mjs';

const directory=await mkdtemp(path.join(tmpdir(),'sdelaet-payment-matrix-'));
const email='fixture@example.test';
const timestamp='2026-11-25T10:00:00.000Z';
Object.assign(process.env,{
  PAYMENT_PORT:'0',PAYMENT_STORE_FILE:path.join(directory,'orders.json'),
  PAYMENT_WATCHDOG_STATE_FILE:path.join(directory,'watchdog.json'),
  PAYMENT_PENDING_ALERT_MINUTES:'1',PAYMENT_WATCHDOG_DRY_RUN:'1',
  PAYMENT_ALERT_EMAIL_ENABLED:'0',ADMIN_TELEGRAM_CHAT_ID:'fixture',
  PUBLIC_ORIGIN:'http://127.0.0.1',TOCHKA_JWT_TOKEN:'fixture',
  TOCHKA_CUSTOMER_CODE:'fixture',TOCHKA_MERCHANT_ID:'fixture'
});

const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE tasks(task_id TEXT PRIMARY KEY,client_id_crm,service_id,service_name,city,created_at,selected_candidate_id,status);
  CREATE TABLE clients(client_id_crm PRIMARY KEY,email,email_normalized,created_at);
  CREATE TABLE search_runs(id,task_id,created_at,candidate_count,status,previous_run_id);
  CREATE TABLE candidates(run_id,candidate_id,type,name,match_level,website,phone,address,raw_json);
  CREATE TABLE outreach_attempts(task_id,request_id,authorization_id,candidate_id,candidate_name,channel,
    recipient,status,prepared_at,sent_at,delivered_at,replied_at,failed_at,last_error,metadata_json,attachments_json);
  CREATE TABLE contractor_replies(task_id,request_id,candidate_id,reply_type,channel,raw_text,received_at);
  CREATE TABLE contractor_offers(task_id,request_id,version,created_at);`);
db.prepare('INSERT INTO clients VALUES (?,?,?,?)').run('fixture',email,email,timestamp);
function task(id){db.prepare("INSERT INTO tasks VALUES (?,?,?,?,?,?,NULL,'draft')").run(id,'fixture','window','Windows','Moscow',timestamp)}
const account=createCustomerAccount({db,customerAuth:{getSession:()=>({email})}});
const operations=new Map(),bankCreates=new Map(),projections=new Map();
const bankStatusFailures=new Set(),refundProjections=new Map();
let bankMode='normal',lostId,denyProjection=false,denyAlert=false,stallAlert=false,onAlertStall;
const servers=[];
function send(res,status,value){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value))}
async function body(req){const chunks=[];for await(const chunk of req)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks))}
async function listen(handler){
  const listener=http.createServer((req,res)=>handler(req,res).catch(error=>send(res,500,{error:error.message})));
  servers.push(listener);
  listener.listen(0,'127.0.0.1');
  await once(listener,'listening');
  return 'http://127.0.0.1:'+listener.address().port;
}
const fakeBank=await listen(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(req.method==='POST'){
    const {Data}=await body(req),id=Data.paymentLinkId;
    bankCreates.set(id,Data);
    assert.ok(id.length<=45);
    assert.equal(Data.amount,Data.Items[0].amount);
    assert.equal(new URL(Data.redirectUrl).searchParams.get('order'),id);
    assert.equal(new URL(Data.failRedirectUrl).searchParams.get('order'),id);
    const operation={status:'CREATED',paymentLinkId:id,operationId:'op-'+id,amount:Data.amount,paymentLink:'http://127.0.0.1/pay/'+id};
    operations.set(operation.operationId,operation);
    if(bankMode==='lose-response'){
      lostId=id;
      res.destroy();
      return;
    }
    await new Promise(resolve=>setTimeout(resolve,40));
    return send(res,200,{Data:operation});
  }
  if(url.pathname.endsWith('/payments')){
    assert.equal(url.searchParams.get('customerCode'),'fixture');
    assert.match(url.searchParams.get('fromDate'),/^\d{4}-\d{2}-\d{2}$/);
    return send(res,200,{Data:{Operation:[...operations.values()]}});
  }
  const operationId=url.pathname.split('/').at(-1);
  if(bankStatusFailures.has(operationId))return send(res,503,{error:'FIXTURE_BANK_OFFLINE'});
  return send(res,200,{Data:{Operation:[operations.get(operationId)]}});
});
process.env.TOCHKA_BASE_URL=fakeBank;
process.env.ACCOUNT_API_URL=await listen(async(req,res)=>{
  const value=await body(req);
  if(req.url==='/telegram/send'){
    if(stallAlert){onAlertStall();return}
    return send(res,denyAlert?503:200,{ok:!denyAlert,error:'FIXTURE_ALERT_OFFLINE'});
  }
  if(req.url==='/v1/account/payment-authorize'){
    try{return send(res,200,{ok:true,...account._test.authorize(email,value.taskId,value.plan)})}
    catch(error){return send(res,error.status||500,{error:error.message})}
  }
  assert.equal(req.url,'/v1/internal/payment-confirmed');
  if(denyProjection)return send(res,503,{ok:false});
  const previous=db.prepare('SELECT payment_status FROM crm_task_state WHERE task_id=?').get(value.taskId);
  const row=account.confirmPayment(value.taskId,value.paymentId,value.status);
  if(row?.payment_id!==value.paymentId)return send(res,409,{ok:false});
  if(value.status==='paid'&&previous?.payment_status!=='paid')projections.set(value.taskId,(projections.get(value.taskId)||0)+1);
  if(value.status==='refunded'&&row.payment_status==='refunded'&&previous?.payment_status!=='refunded'){
    refundProjections.set(value.taskId,(refundProjections.get(value.taskId)||0)+1);
  }
  return send(res,200,{ok:true});
});

process.env.TELEGRAM_GATEWAY_URL=process.env.ACCOUNT_API_URL;
process.env.TELEGRAM_GATEWAY_SECRET='fixture';

const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const realFetch=globalThis.fetch;
globalThis.fetch=(target,options)=>{
  const url=new URL(target);
  if(url.href==='https://enter.tochka.com/doc/openapi/static/keys/public'){
    return Promise.resolve(Response.json(publicKey.export({format:'jwk'})));
  }
  assert.equal(url.hostname,'127.0.0.1','non-fixture network access');
  return realFetch(target,options);
};

try{
  const {server}=await import('../payment-api/server.mjs');
  servers.push(server);
  if(!server.listening)await once(server,'listening');
  const root='http://127.0.0.1:'+server.address().port;
  const {getOrder,withOrders,listOrders}=await import('../payment-api/store.mjs');
  const {runWatchdog}=await import('../payment-api/payment-watchdog.mjs');
  async function request(route,method='GET',data){
    const response=await fetch(root+route,{method,body:data===undefined?undefined:typeof data==='string'?data:JSON.stringify(data)});
    return {status:response.status,...await response.json()};
  }
  const create=(taskId,plan)=>request('/v1/payments','POST',
    {taskId,plan,email,ymClientId:'fixture-client',serviceId:'windows',serviceName:'Window repair',city:'Moscow'+'x'.repeat(240)});
  const status=id=>request('/v1/payments/'+id);
  function jwt(fact,key=privateKey){
    const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
    const prefix=encode({alg:'RS256'})+'.'+encode(fact);
    return prefix+'.'+sign('RSA-SHA256',Buffer.from(prefix),key).toString('base64url');
  }
  const webhook=(fact,key)=>request('/v1/tochka/webhook','POST',jwt(fact,key));
  const factFor=id=>operations.get('op-'+id);
  const approve=id=>Object.assign(factFor(id),{status:'APPROVED',paidAt:timestamp});
  for(const id of ['first','repeat','second','repeat-choice','racer','unknown','preflight','parallel-a','parallel-b','credit-a','credit-b','legacy'])task(id);
  for(const id of ['first','repeat-choice']){
    db.prepare('INSERT INTO search_runs VALUES (?,?,?,?,?,NULL)').run(id,id,timestamp,16,'ok');
    for(let index=0;index<16;index++){
      db.prepare("INSERT INTO candidates VALUES (?,?,'company',?,'strong',NULL,NULL,NULL,'{}')").run(id,String(index),'Fixture '+index);
    }
  }
  assert.equal(account.confirmPayment('first','absent'),null);
  assert.equal(account._test.detail(email,'first').candidates.length,0);
  assert.equal(account._test.pricing(email).repeatDiscount.eligible,false);
  const source=await readFile(new URL('../src/server.mjs',import.meta.url),'utf8');
  const start=source.indexOf('function searchOrderEntitlement(');
  const end=source.indexOf('\n}\n',start)+2;
  const tariffStart=source.indexOf('const COMMERCIAL_TARIFFS');
  const tariffEnd=source.indexOf('\n}',tariffStart)+3;
  const entitlement=runInNewContext(
    source.slice(tariffStart,tariffEnd)+';\n'+source.slice(start,end)+'\nsearchOrderEntitlement',
    {db,customerAccount:account,text:value=>String(value??'').trim(),
      basePaymentPlanId:value=>value.replace(/_repeat$/,'')}
  );
  const refine=(taskId,orderId)=>entitlement({taskId,orderId,refinement:{previousRunId:taskId}});
  const first=await create('first','find');
  assert.equal(first.status,201);
  assert.equal(first.amount,990);
  const savedFirst=await getOrder(first.orderId);
  assert.deepEqual([savedFirst.serviceId,savedFirst.serviceName,savedFirst.city],['windows','Window repair','Moscow'+'x'.repeat(234)]);
  assert.throws(()=>refine('first',first.orderId),{message:'PAID_ENTITLEMENT_REQUIRED'});
  assert.equal((await status(first.orderId)).order.status,'pending');
  assert.equal((await create('first','find')).orderId,first.orderId);
  assert.equal((await create('first','choice')).status,409);
  const nodes=new Map(),goals=[];
  let browserCheck;
  const window={
    location:{search:'?order='+first.orderId},
    document:{readyState:'loading',hidden:true,addEventListener(){},querySelector(){return null},
      getElementById(id){
        if(!nodes.has(id)){
          const classes=new Set();
          nodes.set(id,{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}});
        }
        return nodes.get(id);
      }},
    addEventListener(){},sdAnalytics:{paymentReturn(){},paymentStatus(...args){goals.push(args)}},
    sdMotion:{once(key,handler){browserCheck=handler();return browserCheck},button:()=>()=>{},
      statusHtml:state=>state,reveal(){},animate(){}}
  };
  runInNewContext(await readFile(new URL('../assets/task-journey-v1.js',import.meta.url),'utf8'),{window,URLSearchParams,URL});
  window.sdJourney.configure({request:async url=>{
    if(url.startsWith('/api/payments'))return status(first.orderId);
    assert.equal(url,'/v1/account/tasks/first');
    return {task:account._test.detail(email,'first')};
  }});
  const paymentReturn=window.sdJourney.initPaymentReturn();
  await browserCheck;
  assert.equal(nodes.get('status').innerHTML,'pending');
  assert.equal(nodes.get('continueBtn').classList.contains('hidden'),true);
  assert.equal(goals.length,0);
  const firstFact=approve(first.orderId);
  const wrongKey=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey;
  assert.equal((await webhook(firstFact,wrongKey)).status,400);
  for(const patch of [{amount:1},{operationId:'different'}]){
    assert.equal((await webhook({...firstFact,...patch})).status,409);
    assert.equal((await getOrder(first.orderId)).status,'pending');
  }
  assert.equal((await webhook(firstFact)).status,200);
  assert.equal((await webhook({...firstFact,paidAt:'2030-01-01T00:00:00.000Z'})).status,200);
  assert.equal((await getOrder(first.orderId)).paidAt,timestamp);
  assert.equal(projections.get('first'),1);
  await paymentReturn.check();
  await paymentReturn.check();
  assert.equal(nodes.get('continueBtn').href,'/task.html?task=first#selection');
  assert.equal(nodes.get('continueBtn').classList.contains('hidden'),false);
  assert.equal(goals.length,1);
  assert.equal(account._test.detail(email,'first').candidates.length,5);
  assert.equal(refine('first',first.orderId).searchBudget.remaining,1);
  db.prepare('INSERT INTO search_runs VALUES (?,?,?,?,?,?)').run('refined-first','first',timestamp,16,'ok','first');
  assert.throws(()=>refine('first',first.orderId),{message:'ADDITIONAL_SEARCH_LIMIT_REACHED'});
  assert.throws(()=>refine('second',first.orderId),{message:'ORDER_TASK_MISMATCH'});
  assert.equal((await status(first.orderId)).order.paymentSuccessEvent.ym_client_id,'fixture-client');
  assert.equal((await create('first','find')).status,409);

  const repeat=await create('repeat','find_repeat');
  assert.equal(repeat.status,201);
  assert.equal(repeat.amount,690);
  assert.equal(account._test.pricing(email).repeatDiscount.eligible,false);
  factFor(repeat.orderId).status='EXPIRED';
  assert.equal((await status(repeat.orderId)).order.status,'expired');
  assert.equal(account._test.pricing(email).repeatDiscount.eligible,true);
  const repeatChoice=await create('repeat-choice','choice_repeat');
  assert.equal(repeatChoice.status,201);
  assert.equal(repeatChoice.amount,1790);
  approve(repeatChoice.orderId);
  assert.equal((await status(repeatChoice.orderId)).order.status,'paid');
  assert.equal(projections.get('repeat-choice'),1);
  assert.equal(account._test.detail(email,'repeat-choice').candidates.length,15);
  db.prepare('INSERT INTO search_runs VALUES (?,?,?,?,?,?)').run('refined-choice','repeat-choice',timestamp,16,'ok','repeat-choice');
  assert.equal(refine('repeat-choice',repeatChoice.orderId).searchBudget.remaining,null);
  db.prepare("UPDATE tasks SET selected_candidate_id='chosen' WHERE task_id='repeat-choice'").run();
  assert.throws(()=>refine('repeat-choice',repeatChoice.orderId),{message:'TASK_SELECTION_COMPLETED'});
  assert.equal(account._test.pricing(email).repeatDiscount.eligible,true);

  const merchant=process.env.TOCHKA_MERCHANT_ID;
  delete process.env.TOCHKA_MERCHANT_ID;
  assert.equal((await create('preflight','find_repeat')).status,503);
  assert.equal((await listOrders()).some(order=>order.taskId==='preflight'),false);
  assert.equal(account._test.pricing(email).repeatDiscount.eligible,true);
  process.env.TOCHKA_MERCHANT_ID=merchant;

  bankMode='lose-response';
  const beforeLost=bankCreates.size;
  assert.equal((await create('unknown','find_repeat')).status,500);
  bankMode='normal';
  assert.equal((await create('unknown','find_repeat')).status,409);
  assert.equal(bankCreates.size,beforeLost+1);
  assert.equal(account._test.pricing(email).repeatDiscount.eligible,false);
  await withOrders(async(orders,save)=>{orders[lostId].createdAt=timestamp;await save()});
  const lostOperation=operations.get('op-'+lostId);
  operations.delete(lostOperation.operationId);
  assert.equal((await runWatchdog()).alerts,1);
  assert.equal((await getOrder(lostId)).status,'pending');
  assert.equal(account._test.pricing(email).repeatDiscount.eligible,false);
  operations.set(lostOperation.operationId,lostOperation);
  await runWatchdog();
  const recovered=await create('unknown','find_repeat');
  assert.equal(recovered.orderId,lostId);
  assert.equal(recovered.paymentUrl,lostOperation.paymentLink);
  assert.equal(bankCreates.size,beforeLost+1);
  lostOperation.status='EXPIRED';
  await runWatchdog();
  assert.equal((await getOrder(lostId)).status,'expired');
  assert.equal(account._test.pricing(email).repeatDiscount.eligible,true);

  const beforeCredit=bankCreates.size;
  const credits=await Promise.all([create('credit-a','find_repeat'),create('credit-b','choice_repeat')]);
  assert.deepEqual(credits.map(x=>x.status).sort(),[201,403]);
  assert.equal(bankCreates.size,beforeCredit+1);
  const credit=credits.find(x=>x.status===201);
  approve(credit.orderId);
  await runWatchdog();
  assert.equal((await getOrder(credit.orderId)).status,'paid');

  const beforeRace=bankCreates.size;
  const racers=await Promise.all([create('racer','choice'),create('racer','choice'),create('racer','find')]);
  assert.equal(racers.filter(x=>x.status===201).length,1);
  assert.equal(bankCreates.size,beforeRace+1);
  const racingOrder=racers.find(x=>x.status===201);
  const racingFact=approve(racingOrder.orderId);
  denyProjection=true;
  assert.equal((await webhook(racingFact)).status,503);
  assert.equal((await getOrder(racingOrder.orderId)).lifecyclePending,true);
  denyProjection=false;
  bankStatusFailures.add(racingFact.operationId);
  await runWatchdog();
  assert.equal(projections.get('racer'),1);
  assert.equal((await getOrder(racingOrder.orderId)).lifecyclePending,false);
  bankStatusFailures.delete(racingFact.operationId);
  await Promise.all([webhook(racingFact),status(racingOrder.orderId),runWatchdog()]);
  assert.equal(projections.get('racer'),1);
  assert.equal((await getOrder(racingOrder.orderId)).lifecyclePending,false);

  const second=await create('second','choice');
  assert.equal(second.amount,2590);
  const legacy=await create('legacy','find');
  const earlierPaidAt='2026-11-25T09:00:00.000Z';
  await withOrders(async(orders,save)=>{orders[legacy.orderId].paidAt=earlierPaidAt;await save()});
  const {paymentLinkId,amount,...legacyFact}=approve(legacy.orderId);
  assert.equal((await webhook(legacyFact)).status,200);
  assert.equal(projections.get('legacy'),1);
  assert.equal((await getOrder(legacy.orderId)).paidAt,earlierPaidAt);
  const workerSource=`import {withOrders} from './payment-api/store.mjs';
    for(let index=0;index<8;index++){
      const id=process.env.FIXTURE_WORKER+index;
      await withOrders(async(orders,save)=>{orders[id]={id,status:'expired'};await save()});
    }`;
  const worker=name=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--input-type=module','-e',workerSource],
      {env:{...process.env,FIXTURE_WORKER:name},stdio:'inherit'});
    child.once('error',reject);
    child.once('exit',code=>code===0?resolve():reject(Error('store worker '+code)));
  });
  await Promise.all([worker('worker-a'),worker('worker-b'),create('parallel-a','find'),create('parallel-b','choice')]);
  function startCrashFixture(source){
    const marker=path.join(directory,randomUUID());
    const prelude="import {writeFileSync} from 'node:fs';const notify=value=>writeFileSync(process.env.FIXTURE_MARKER,value);";
    const child=spawn(process.execPath,['--input-type=module','-e',prelude+source],
      {env:{...process.env,FIXTURE_MARKER:marker},stdio:'inherit'});
    const message=Promise.race([
      (async()=>{
        for(let attempt=0;attempt<200;attempt++){
          try{return await readFile(marker,'utf8')}catch(error){if(error.code!=='ENOENT')throw error}
          await new Promise(resolve=>setTimeout(resolve,25));
        }
        throw Error('fixture marker timeout');
      })(),
      once(child,'exit').then(([code,signal])=>{throw Error('fixture exited early: '+(signal||code))})
    ]);
    return {child,message};
  }
  async function killWriter(child){
    const exited=once(child,'exit');
    assert.equal(child.kill('SIGKILL'),true);
    await exited;
  }
  const liveWriter=startCrashFixture(`
    import {withOrders} from './payment-api/store.mjs';
    await withOrders(async orders=>{
      orders['uncommitted-crash-record']={id:'uncommitted-crash-record'};
      notify('holding');
      setInterval(()=>{},1000);
      await new Promise(()=>{});
    });
  `);
  try{
    assert.equal(await liveWriter.message,'holding');
    let acquired=false;
    const waiter=withOrders(async(records,save)=>{
      acquired=true;
      assert.equal(records['uncommitted-crash-record'],undefined);
      assert.equal(records[first.orderId].status,'paid');
      records['after-crash']={id:'after-crash',status:'expired'};
      await save();
    });
    await new Promise(resolve=>setTimeout(resolve,150));
    assert.equal(acquired,false,'live writer still owns the lock');
    await killWriter(liveWriter.child);
    await waiter;
    assert.equal((await getOrder('after-crash')).status,'expired');
  }finally{if(liveWriter.child.exitCode===null&&liveWriter.child.signalCode===null)await killWriter(liveWriter.child)}

  // Kill the writer after the app commits paid, before the payment store acks
  // delivery. Replay must leave the app projection and original paidAt intact.
  task('crash-after-projection');
  const crossing=await create('crash-after-projection','find');
  const crossingFact=approve(crossing.orderId);
  const crashAfterProjection=startCrashFixture(`
    import {applyProviderStatus} from './payment-api/lifecycle.mjs';
    const actualFetch=globalThis.fetch;
    globalThis.fetch=async (...args)=>{
      const response=await actualFetch(...args);
      if(!response.ok)throw Error('fixture projection failed: '+response.status);
      await response.text();
      notify('projection committed');
      setInterval(()=>{},1000);
      await new Promise(()=>{});
    };
    await applyProviderStatus(${JSON.stringify(crossing.orderId)},${JSON.stringify(crossingFact)},process.env);
  `);
  try{
    assert.equal(await crashAfterProjection.message,'projection committed');
    assert.equal(projections.get('crash-after-projection'),1);
    assert.equal((await getOrder(crossing.orderId)).lifecyclePending,true);
    await killWriter(crashAfterProjection.child);
    await runWatchdog();
    const recovered=await getOrder(crossing.orderId);
    assert.equal(recovered.status,'paid');
    assert.equal(recovered.paidAt,timestamp);
    assert.equal(recovered.lifecyclePending,false);
    assert.equal(projections.get('crash-after-projection'),1);
  }finally{
    if(crashAfterProjection.child.exitCode===null&&crashAfterProjection.child.signalCode===null)await killWriter(crashAfterProjection.child);
  }
  task('reserved-crash');
  const reservation=startCrashFixture(`
    import {withOrders} from './payment-api/store.mjs';
    await withOrders(async(orders,save)=>{
      orders['reserved-fixture']={id:'reserved-fixture',status:'pending',dispatchState:'reserved',
        plan:'find',amount:990,regularAmount:990,priceType:'regular',
        taskId:'reserved-crash',receiptEmail:'fixture@example.test',createdAt:new Date().toISOString()};
      await save();
    });
    notify('reservation saved');
    setInterval(()=>{},1000);
  `);
  try{
    assert.equal(await reservation.message,'reservation saved');
    await killWriter(reservation.child);
    const previousBankCount=bankCreates.size;
    const attempts=await Promise.all([create('reserved-crash','find'),create('reserved-crash','find')]);
    assert.equal(attempts.filter(result=>result.status===201).length,1);
    assert.equal(attempts.find(result=>result.status===201).orderId,'reserved-fixture');
    assert.equal(bankCreates.size,previousBankCount+1);
  }finally{if(reservation.child.exitCode===null&&reservation.child.signalCode===null)await killWriter(reservation.child)}

  task('legacy-unprojected');
  await withOrders(async(orders,save)=>{
    orders['legacy-unprojected']={id:'legacy-unprojected',taskId:'legacy-unprojected',
      operationId:'',status:'paid',plan:'find',amount:990,paidAt:timestamp,createdAt:timestamp};
    await save();
  });
  denyProjection=true;
  assert.equal((await runWatchdog()).alerts,1);
  const watchdogState=JSON.parse(await readFile(process.env.PAYMENT_WATCHDOG_STATE_FILE,'utf8'));
  assert.equal(watchdogState.orders['legacy-unprojected'].lastStatus,'lifecycle_pending');
  assert.equal(watchdogState.orders['legacy-unprojected'].lastError,'PAYMENT_LIFECYCLE_SYNC_FAILED');
  assert.equal((await runWatchdog()).alerts,0);
  denyProjection=false;
  assert.equal((await runWatchdog()).alerts,1);
  assert.equal((await getOrder('legacy-unprojected')).lifecyclePending,false);
  assert.equal(projections.get('legacy-unprojected'),1);
  assert.equal(db.prepare('SELECT payment_id FROM crm_task_state WHERE task_id=?').get('legacy-unprojected').payment_id,'legacy-unprojected');
  assert.equal(db.prepare('SELECT paid_amount FROM crm_task_state WHERE task_id=?').get('legacy-unprojected').paid_amount,990);

  const alertOrder='broken-alert-first';
  task('broken-alert-later');
  await withOrders(async(orders,save)=>{
    orders[alertOrder]={id:alertOrder,taskId:alertOrder,status:'pending',createdAt:timestamp};
    await save();
  });
  const laterOrder=await create('broken-alert-later','find');
  approve(laterOrder.orderId);
  process.env.PAYMENT_WATCHDOG_DRY_RUN='0';
  denyAlert=true;
  await runWatchdog();
  assert.equal(projections.get('broken-alert-later'),1);
  let alertState=JSON.parse(await readFile(process.env.PAYMENT_WATCHDOG_STATE_FILE,'utf8'));
  assert.equal(alertState.orders[alertOrder].stuckNotifiedAt,undefined);
  assert.match(alertState.orders[alertOrder].lastAlertError,/FIXTURE_ALERT_OFFLINE/);
  denyAlert=false;
  stallAlert=true;
  const alertStarted=new Promise(resolve=>{onAlertStall=resolve});
  const stalledRun=runWatchdog();
  await Promise.race([alertStarted,stalledRun.then(()=>{throw Error('stalled alert was not attempted')})]);
  assert.equal((await runWatchdog()).alreadyRunning,true);
  assert.equal((await stalledRun).alerts,0);
  alertState=JSON.parse(await readFile(process.env.PAYMENT_WATCHDOG_STATE_FILE,'utf8'));
  assert.match(alertState.orders[alertOrder].lastAlertError,/timeout|aborted/i);
  stallAlert=false;
  assert.equal((await runWatchdog()).alerts,1);
  alertState=JSON.parse(await readFile(process.env.PAYMENT_WATCHDOG_STATE_FILE,'utf8'));
  assert.ok(alertState.orders[alertOrder].stuckNotifiedAt);
  assert.equal(alertState.orders[alertOrder].lastAlertError,undefined);

  task('refunded');
  db.prepare('INSERT INTO search_runs VALUES (?,?,?,?,?,NULL)').run('refund-search','refunded',timestamp,1,'ok');
  db.prepare("INSERT INTO candidates VALUES ('refund-search','candidate','company','Fixture','strong',NULL,NULL,NULL,'{}')").run();
  const refundable=await create('refunded','find');
  const refundFact=approve(refundable.orderId);
  await webhook(refundFact);
  assert.equal((await status(refundable.orderId)).order.status,'paid');
  assert.equal(account._test.detail(email,'refunded').candidates.length,1);
  const creditsBeforeRefund=account._test.pricing(email).repeatDiscount.paidTaskCount;
  refundFact.status='REFUNDED';
  bankStatusFailures.add(refundFact.operationId);
  const watchdogFile=process.env.PAYMENT_WATCHDOG_STATE_FILE;
  const refundState=JSON.parse(await readFile(watchdogFile,'utf8'));
  for(const order of await listOrders()){
    if(order.id!==refundable.orderId&&order.status==='paid'){
      refundState.orders[order.id]={...refundState.orders[order.id],lastRefundCheckAt:Date.now()};
    }
  }
  await writeFile(watchdogFile,JSON.stringify(refundState));
  await runWatchdog();
  assert.equal((await getOrder(refundable.orderId)).status,'paid');
  bankStatusFailures.delete(refundFact.operationId);
  denyProjection=true;
  await runWatchdog(); // No webhook or customer status request.
  assert.equal((await getOrder(refundable.orderId)).status,'refunded');
  assert.equal((await getOrder(refundable.orderId)).lifecyclePending,true);
  assert.equal(account._test.detail(email,'refunded').candidates.length,0);
  assert.equal(account._test.pricing(email).repeatDiscount.paidTaskCount,creditsBeforeRefund-1);
  denyProjection=false;
  await Promise.all([webhook(refundFact),runWatchdog(),webhook({...refundFact,status:'APPROVED'})]);
  assert.equal((await getOrder(refundable.orderId)).lifecyclePending,false);
  assert.equal(refundProjections.get('refunded'),1);
  const readCrm=()=>db.prepare('SELECT * FROM crm_task_state WHERE task_id=?').get('refunded');
  assert.equal(readCrm().payment_status,'refunded');
  const refundStamp=readCrm().updated_at;
  assert.equal(account.confirmPayment('refunded',refundFact.operationId,'refunded').updated_at,refundStamp);
  assert.equal(account.confirmPayment('refunded',refundFact.operationId,'paid'),null);
  assert.throws(()=>refine('refunded',refundable.orderId),{message:'PAID_ENTITLEMENT_REQUIRED'});
  assert.equal((await webhook({...refundFact,status:'APPROVED'})).status,200);
  assert.equal((await getOrder(refundable.orderId)).status,'refunded');
  assert.equal(projections.get('refunded'),1);
  const replacement=await create('refunded','find');
  assert.equal(replacement.status,201);
  const replacementFact=approve(replacement.orderId);
  assert.equal((await webhook(replacementFact)).status,200);
  assert.equal((await getOrder(replacement.orderId)).lifecyclePending,false);
  const replaced=db.prepare('SELECT payment_id FROM crm_task_state WHERE task_id=?').get('refunded');
  assert.equal(replaced.payment_id,replacementFact.operationId);
  account.confirmPayment('refunded',refundFact.operationId,'refunded');
  assert.equal(readCrm().payment_status,'paid');
  assert.equal((await webhook({...refundFact,status:'APPROVED'})).status,200);
  assert.equal(db.prepare('SELECT payment_id FROM crm_task_state WHERE task_id=?').get('refunded').payment_id,replacementFact.operationId);

  console.log('PAYMENT WRITER CRASH RECOVERY PASS');
  const orders=await listOrders();
  assert.equal(orders.filter(x=>x.id.startsWith('worker-')).length,16);
  assert.equal(orders.filter(x=>x.taskId?.startsWith('parallel-')).length,2);
  assert.equal(orders.find(x=>x.id===first.orderId).status,'paid');
  assert.deepEqual(['find','find_repeat','choice','choice_repeat'].map(id=>{
    const p=getPlan(id);return [p.amount,p.candidateLimit,p.additionalSearchLimit];
  }),[[990,5,1],[690,5,1],[2590,15,null],[1790,15,null]]);
  console.log('PAYMENT RUNTIME MATRIX PASS');
}finally{
  globalThis.fetch=realFetch;
  await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));
  db.close();
  await rm(directory,{recursive:true,force:true});
}
