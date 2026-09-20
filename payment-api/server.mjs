import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {getPlan} from './plans.mjs';
import {createTochkaPayment,getTochkaPaymentInfo} from './tochka.mjs';
import {verifyTochkaWebhook} from './webhook.mjs';
import {putOrder,getOrder,patchOrder} from './store.mjs';

const env=process.env,port=Number(env.PAYMENT_PORT||8790);
const origin=env.PUBLIC_ORIGIN||'https://onsdelaet.ru';
const accountApi=String(env.ACCOUNT_API_URL||'http://127.0.0.1:3210').replace(/\/$/,'');
function json(res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':origin,'access-control-allow-credentials':'true'});res.end(JSON.stringify(body))}
async function body(req,max=16000){let raw='';for await(const c of req){raw+=c;if(raw.length>max)throw Object.assign(new Error('PAYLOAD_TOO_LARGE'),{status:413})}return raw}
function webhookFields(c){const d=c?.Data||c?.data||c;return {id:d?.paymentLinkId||d?.Operation?.[0]?.paymentLinkId,status:d?.status||d?.Operation?.[0]?.status,operationId:d?.operationId||d?.Operation?.[0]?.operationId,amount:d?.amount||d?.Operation?.[0]?.amount}}
async function refreshPendingOrder(order){
  if(!order||order.status!=='pending'||!order.operationId)return order;
  try{
    const remote=await getTochkaPaymentInfo(env,{operationId:order.operationId});
    const providerStatus=String(remote.status||'').toUpperCase();
    const patch={providerStatus,providerCheckedAt:new Date().toISOString()};
    if(providerStatus==='APPROVED'){
      patch.status='paid';
      patch.paidAt=remote.paidAt||new Date().toISOString();
      patch.operationId=remote.operationId||order.operationId;
    }else if(providerStatus==='EXPIRED')patch.status='expired';
    else if(providerStatus==='REFUNDED')patch.status='refunded';
    await patchOrder(order.id,patch);
    return await getOrder(order.id);
  }catch(error){
    console.warn('payment status refresh failed',order.id,String(error?.message||error));
    return order;
  }
}

async function authorizeRepeat(req,plan,taskId){
  if(plan.priceType!=='repeat')return true;
  const r=await fetch(accountApi+'/v1/account/payment-authorize',{
    method:'POST',
    headers:{'content-type':'application/json','cookie':String(req.headers.cookie||'')},
    body:JSON.stringify({taskId,plan:plan.baseId})
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.ok||d.allowed!==true)throw Object.assign(new Error(d.error||'REPEAT_DISCOUNT_NOT_AVAILABLE'),{status:r.status||403});
  return true;
}

const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type','access-control-allow-credentials':'true'});return res.end()}
  try{
    if(req.method==='GET'&&req.url==='/health')return json(res,200,{ok:true,service:'sdelaet-payment-api',provider:'tochka',configured:Boolean(env.TOCHKA_JWT_TOKEN&&env.TOCHKA_CUSTOMER_CODE)});
    if(req.method==='POST'&&req.url==='/v1/payments'){
      const input=JSON.parse(await body(req)||'{}'),plan=getPlan(input.plan),email=String(input.email||'').trim().toLowerCase(),taskId=String(input.taskId||'').slice(0,80);
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Object.assign(new Error('VALID_EMAIL_REQUIRED_FOR_RECEIPT'),{status:400});
      if(!taskId)throw Object.assign(new Error('TASK_ID_REQUIRED'),{status:400});
      await authorizeRepeat(req,plan,taskId);
      const id=`SD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${randomUUID().slice(0,8).toUpperCase()}`;
      await putOrder({id,plan:plan.id,basePlan:plan.baseId,amount:plan.amount,regularAmount:plan.regularAmount,priceType:plan.priceType,repeatDiscountPercent:plan.repeatDiscountPercent||0,status:'pending',taskId,receiptEmail:email,createdAt:new Date().toISOString()});
      const payment=await createTochkaPayment({...env,PUBLIC_ORIGIN:origin},{orderId:id,plan,email});
      await patchOrder(id,{provider:'tochka',paymentUrl:payment.url,operationId:payment.operationId||'',consumerId:payment.consumerId||'',fiscalization:'tochka_receipt'});
      return json(res,201,{ok:true,orderId:id,paymentUrl:payment.url,amount:plan.amount,regularAmount:plan.regularAmount,priceType:plan.priceType});
    }
    if(req.method==='GET'&&req.url.startsWith('/v1/payments/')){const id=decodeURIComponent(req.url.split('/').pop());var order=await getOrder(id);if(order&&order.status==='pending')order=await refreshPendingOrder(order);return order?json(res,200,{ok:true,order}):json(res,404,{ok:false,error:'ORDER_NOT_FOUND'})}
    if(req.method==='POST'&&req.url==='/v1/tochka/webhook'){const claims=await verifyTochkaWebhook(await body(req,32000));const f=webhookFields(claims);if(f.id&&f.status==='APPROVED')await patchOrder(f.id,{status:'paid',operationId:f.operationId||'',paidAt:new Date().toISOString()});return json(res,200,{ok:true})}
    return json(res,404,{ok:false,error:'NOT_FOUND'});
  }catch(e){return json(res,e.status||500,{ok:false,error:String(e.message||e),detail:env.DEBUG==='1'?e.detail:undefined})}
});
server.listen(port,'127.0.0.1',()=>console.log(`sdelaet payment api on 127.0.0.1:${port}`));
