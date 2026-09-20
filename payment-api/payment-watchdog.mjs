import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {listOrders,getOrder,patchOrder} from './store.mjs';
import {getTochkaPaymentInfo} from './tochka.mjs';

const env=process.env;
const alertAfterMs=Math.max(1,Number(env.PAYMENT_PENDING_ALERT_MINUTES||10))*60_000;
const alertEmail=String(env.PAYMENT_ALERT_EMAIL||'bill@onsdelaet.ru').trim();
const alertFrom=String(env.PAYMENT_ALERT_FROM||'bill@onsdelaet.ru').trim();
const emailEnabled=String(env.PAYMENT_ALERT_EMAIL_ENABLED||'0')==='1';
const adminTelegramChatId=String(env.ADMIN_TELEGRAM_CHAT_ID||'').trim();
const telegramGatewayUrl=String(env.TELEGRAM_GATEWAY_URL||'').trim().replace(/\/+$/,'');
const telegramGatewaySecret=String(env.TELEGRAM_GATEWAY_SECRET||'').trim();
const telegramBotToken=String(env.TELEGRAM_BOT_TOKEN||'').trim();
const stateFile=String(env.PAYMENT_WATCHDOG_STATE_FILE||'/var/lib/sdelaet-payments/watchdog-state.json');

function now(){return new Date().toISOString()}
function ageMinutes(order,ts=Date.now()){const created=Date.parse(order?.createdAt||'');return Number.isFinite(created)?Math.max(0,Math.floor((ts-created)/60000)):0}
export function isTestOrder(order){const task=String(order?.taskId||''),id=String(order?.id||'');return /^SD-WATCHDOG-/i.test(id)||/^TEST-PROD-/i.test(task)||/^fiscal-receipt-smoke-/i.test(task)}
export function shouldAlertPending(order,ts=Date.now()){if(!order||order.status!=='pending'||isTestOrder(order))return false;const created=Date.parse(order.createdAt||'');return Number.isFinite(created)&&(ts-created)>=alertAfterMs}
function safe(v){return String(v==null?'—':v)}
function paymentLink(order){return `https://onsdelaet.ru/payment-success.html?order=${encodeURIComponent(order.id)}`}

async function loadState(){try{return JSON.parse(await readFile(stateFile,'utf8'))}catch(e){if(e.code==='ENOENT')return {orders:{}};throw e}}
async function saveState(state){await mkdir(path.dirname(stateFile),{recursive:true});const tmp=stateFile+'.tmp';await writeFile(tmp,JSON.stringify(state,null,2));await rename(tmp,stateFile)}

async function sendTelegram(subject,body){
  if(!adminTelegramChatId)return false;
  const message=`${subject}

${body}`.slice(0,3900);
  if(env.PAYMENT_WATCHDOG_DRY_RUN==='1'){console.log('DRY_TELEGRAM',message);return true}
  if(telegramGatewayUrl&&telegramGatewaySecret){
    const r=await fetch(`${telegramGatewayUrl}/telegram/send`,{method:'POST',headers:{'content-type':'application/json','x-sdelaet-gateway-secret':telegramGatewaySecret},body:JSON.stringify({chat_id:adminTelegramChatId,text:message,disable_web_page_preview:true})});
    const d=await r.json().catch(()=>({}));if(!r.ok||d.ok!==true)throw new Error(d.error||'TELEGRAM_GATEWAY_SEND_FAILED');return true;
  }
  if(telegramBotToken){
    const r=await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:adminTelegramChatId,text:message,disable_web_page_preview:true})});
    const d=await r.json().catch(()=>({}));if(!r.ok||d.ok!==true)throw new Error(d.description||'TELEGRAM_SEND_FAILED');return true;
  }
  return false;
}

async function notify(subject,body){
  let sent=false,errors=[];
  try{sent=await sendTelegram(subject,body)||sent}catch(e){errors.push(`telegram:${String(e?.message||e)}`)}
  if(emailEnabled){try{await sendMail(subject,body);sent=true}catch(e){errors.push(`email:${String(e?.message||e)}`)}}
  if(!sent)throw new Error(errors.join(';')||'NO_ALERT_CHANNEL_CONFIGURED');
  return true;
}

async function sendMail(subject,body){
  if(env.PAYMENT_WATCHDOG_DRY_RUN==='1'){console.log('DRY_ALERT',subject);console.log(body);return}
  if(!alertEmail)return;
  const message=[`From: ${alertFrom}`,`To: ${alertEmail}`,`Subject: ${subject}`,'Content-Type: text/plain; charset=UTF-8','MIME-Version: 1.0','',body].join('\n');
  await new Promise((resolve,reject)=>{const child=spawn('/usr/sbin/sendmail',['-t','-oi'],{stdio:['pipe','ignore','pipe']});let err='';child.stderr.on('data',d=>err+=d.toString());child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(`SENDMAIL_${code} ${err}`)));child.stdin.end(message)})
}

function stuckBody(order,providerStatus,extra=''){return [
  'Платёж остаётся в pending дольше допустимого времени.',
  '',
  `Заказ: ${safe(order.id)}`,
  `Возраст: ${ageMinutes(order)} мин.`,
  `Тариф: ${safe(order.basePlan||order.plan)}`,
  `Сумма: ${safe(order.amount)} ₽`,
  `Task ID: ${safe(order.taskId)}`,
  `Email клиента: ${safe(order.receiptEmail)}`,
  `Статус у нас: ${safe(order.status)}`,
  `Статус Точки: ${safe(providerStatus)}`,
  `Operation ID: ${safe(order.operationId)}`,
  extra?`Примечание: ${extra}`:'',
  '',
  `Проверить: ${paymentLink(order)}`
].filter(Boolean).join('\n')}

function recoveredBody(order,providerStatus){return [
  'Зависший платёж автоматически восстановлен watchdog.',
  '',
  `Заказ: ${safe(order.id)}`,
  `Тариф: ${safe(order.basePlan||order.plan)}`,
  `Сумма: ${safe(order.amount)} ₽`,
  `Task ID: ${safe(order.taskId)}`,
  `Email клиента: ${safe(order.receiptEmail)}`,
  `Статус Точки: ${safe(providerStatus)}`,
  `Оплачено: ${safe(order.paidAt)}`,
  '',
  `Открыть: ${paymentLink(order)}`
].join('\n')}

export async function runWatchdog(){
  const state=await loadState();state.orders=state.orders||{};
  const orders=await listOrders();let checked=0,healed=0,alerts=0,skipped=0;
  for(const order of orders){
    if(!order||order.status!=='pending'){continue}
    if(isTestOrder(order)){skipped++;continue}
    checked++;const rec=state.orders[order.id]||{};let current=order,providerStatus='UNKNOWN';
    if(order.operationId){
      try{
        const remote=await getTochkaPaymentInfo(env,{operationId:order.operationId});
        providerStatus=String(remote.status||'').toUpperCase()||'UNKNOWN';
        const patch={providerStatus,providerCheckedAt:now()};
        if(providerStatus==='APPROVED'){patch.status='paid';patch.paidAt=remote.paidAt||now();patch.operationId=remote.operationId||order.operationId}
        else if(providerStatus==='EXPIRED')patch.status='expired';
        else if(providerStatus==='REFUNDED')patch.status='refunded';
        await patchOrder(order.id,patch);current=await getOrder(order.id);
      }catch(error){providerStatus='CHECK_ERROR';rec.lastError=String(error?.message||error);rec.lastErrorAt=now()}
    }else providerStatus='NO_OPERATION_ID';
    if(current?.status==='paid'){
      healed++;
      if(rec.stuckNotifiedAt&&!rec.recoveredNotifiedAt){await notify(`[Сделает] Оплата восстановлена — ${current.id}`,recoveredBody(current,providerStatus));rec.recoveredNotifiedAt=now();alerts++}
      rec.lastStatus='paid';rec.lastProviderStatus=providerStatus;rec.lastCheckedAt=now();state.orders[order.id]=rec;continue
    }
    if(current?.status==='expired'||current?.status==='refunded'){rec.lastStatus=current.status;rec.lastProviderStatus=providerStatus;rec.lastCheckedAt=now();state.orders[order.id]=rec;continue}
    if(shouldAlertPending(current)&&!rec.stuckNotifiedAt){
      await notify(`[Сделает] Оплата зависла — ${current.id}`,stuckBody(current,providerStatus,rec.lastError||''));
      rec.stuckNotifiedAt=now();alerts++;
    }
    rec.lastStatus=current?.status||'pending';rec.lastProviderStatus=providerStatus;rec.lastCheckedAt=now();state.orders[order.id]=rec;
  }
  state.updatedAt=now();await saveState(state);
  console.log(JSON.stringify({ok:true,checked,healed,alerts,skipped,updatedAt:state.updatedAt}));
  return {checked,healed,alerts,skipped};
}

const isMain=process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(isMain){runWatchdog().catch(error=>{console.error(error);process.exitCode=1})}