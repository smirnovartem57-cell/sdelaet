import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {getPlan} from './plans.mjs';
import {createTochkaPayment,getTochkaPaymentInfo,validateTochkaConfiguration} from './tochka.mjs';
import {verifyTochkaWebhook} from './webhook.mjs';
import {getOrder,listOrders,withOrders} from './store.mjs';
import {applyProviderStatus,refreshOrder} from './lifecycle.mjs';

const env=process.env,port=Number(env.PAYMENT_PORT||8790);
const origin=env.PUBLIC_ORIGIN||'https://onsdelaet.ru';
const accountApi=String(env.ACCOUNT_API_URL||'http://127.0.0.1:3210').replace(/\/$/,'');
function json(res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':origin,'access-control-allow-credentials':'true'});res.end(JSON.stringify(body))}
async function body(req,max=16000){let raw='';for await(const c of req){raw+=c;if(raw.length>max)throw Object.assign(new Error('PAYLOAD_TOO_LARGE'),{status:413})}return raw}
const failure=(code,status=409)=>Object.assign(new Error(code),{status});

async function authorizeRepeat(req,plan,taskId){
  if(plan.priceType!=='repeat')return;
  const r=await fetch(accountApi+'/v1/account/payment-authorize',{
    method:'POST',headers:{'content-type':'application/json','cookie':String(req.headers.cookie||'')},
    body:JSON.stringify({taskId,plan:plan.baseId}),signal:AbortSignal.timeout(3500)
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.ok||d.allowed!==true)throw failure(d.error||'REPEAT_DISCOUNT_NOT_AVAILABLE',r.ok?403:r.status);
}

async function createPayment(req){
  const input=JSON.parse(await body(req)||'{}'),plan=getPlan(input.plan);
  const email=String(input.email||'').trim().toLowerCase(),taskId=String(input.taskId||'').slice(0,80);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw failure('VALID_EMAIL_REQUIRED_FOR_RECEIPT',400);
  if(!taskId)throw failure('TASK_ID_REQUIRED',400);
  const {order,reused}=await withOrders(async (orders,save)=>{
    const matches=Object.values(orders).filter(order=>order.taskId===taskId);
    if(matches.some(order=>order.status==='paid'))throw failure('TASK_ALREADY_PAID');
    const pending=matches.find(order=>order.status==='pending');
    if(pending){
      if(pending.receiptEmail?.toLowerCase()!==email||pending.plan!==plan.id){
        throw failure('PAYMENT_ALREADY_PENDING');
      }
      if(pending.paymentUrl)return {order:pending,reused:true};
      if(pending.dispatchState==='reserved'){
        validateTochkaConfiguration(env);
        return {order:pending,reused:false};
      }
      throw failure('PAYMENT_ALREADY_PENDING');
    }
    validateTochkaConfiguration(env);
    // The account checks eligibility against this same store. Serialize the
    // authorization and reservation across tasks to protect one repeat credit.
    await authorizeRepeat(req,plan,taskId);
    const id='SD-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+randomUUID().replaceAll('-','');
    const order={id,plan:plan.id,basePlan:plan.baseId,amount:plan.amount,regularAmount:plan.regularAmount,
      priceType:plan.priceType,repeatDiscountPercent:plan.repeatDiscountPercent||0,
      status:'pending',dispatchState:'reserved',taskId,receiptEmail:email,createdAt:new Date().toISOString(),
      ymClientId:String(input.ymClientId||'').slice(0,100),
      serviceId:String(input.serviceId||'').slice(0,120),
      serviceName:String(input.serviceName||'').slice(0,240),
      city:String(input.city||'').slice(0,240),
      attribution:input.attribution&&typeof input.attribution==='object'?input.attribution:null};
    orders[id]=order;
    await save();
    return {order,reused:false};
  });
  if(!reused){
    await withOrders(async (orders,save)=>{
      const current=orders[order.id];
      if(current?.status!=='pending'||current.dispatchState!=='reserved'){
        throw failure('PAYMENT_ALREADY_PENDING');
      }
      current.dispatchState='dispatching';
      await save();
    });
    // After the dispatch claim, a failure is ambiguous. Keep the original order ID
    // reserved so a retry cannot create a second bank payment.
    const payment=await createTochkaPayment({...env,PUBLIC_ORIGIN:origin},{orderId:order.id,plan,email});
    await withOrders(async (orders,save)=>{
      const current=orders[order.id];
      if(current.operationId&&payment.operationId&&current.operationId!==payment.operationId){
        throw failure('PAYMENT_OPERATION_MISMATCH');
      }
      Object.assign(current,{provider:'tochka',paymentUrl:payment.url,
        operationId:current.operationId||payment.operationId||'',consumerId:payment.consumerId||'',fiscalization:'tochka_receipt'});
      await save();
    });
    order.paymentUrl=payment.url;
  }
  return {ok:true,reused,orderId:order.id,paymentUrl:order.paymentUrl,amount:order.amount,
    regularAmount:order.regularAmount,priceType:order.priceType};
}

export const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type','access-control-allow-credentials':'true'});return res.end()}
  try{
    if(req.method==='GET'&&req.url==='/health')return json(res,200,{ok:true,service:'sdelaet-payment-api',provider:'tochka',configured:Boolean(env.TOCHKA_JWT_TOKEN&&env.TOCHKA_CUSTOMER_CODE)});
    if(req.method==='POST'&&req.url==='/v1/payments'){
      const result=await createPayment(req);
      return json(res,result.reused?200:201,result);
    }
    if(req.method==='GET'&&req.url.startsWith('/v1/payments/')){
      const id=decodeURIComponent(req.url.split('/').pop());
      let order;
      try{order=await refreshOrder(id,env,{checkPaid:true})}
      catch(error){console.warn('payment status refresh failed',id,error.message);order=await getOrder(id)}
      return order?json(res,200,{ok:true,order}):json(res,404,{ok:false,error:'ORDER_NOT_FOUND'});
    }
    if(req.method==='POST'&&req.url==='/v1/tochka/webhook'){
      let claims;
      try{claims=await verifyTochkaWebhook(await body(req,32000))}
      catch(error){
        if(error.message==='TOCHKA_PUBLIC_KEY_UNAVAILABLE')throw failure(error.message,503);
        if(error instanceof SyntaxError||error.message.startsWith('BAD_WEBHOOK_'))throw failure('INVALID_PAYMENT_WEBHOOK',400);
        throw error;
      }
      const data=claims?.Data||claims?.data||claims;
      const fact=data?.Operation?.[0]||data;
      const operation=fact?.operationId||data?.operationId;
      const boundOrder=operation&&!fact?.paymentLinkId&&!data?.paymentLinkId?
        (await listOrders()).find(order=>order.operationId===operation):null;
      const id=fact?.paymentLinkId||data?.paymentLinkId||boundOrder?.id;
      const status=String(fact?.status||data?.status).toUpperCase();
      if(status==='APPROVED'||status==='REFUNDED'){
        if(!id)throw failure('PAYMENT_ORDER_REQUIRED',400);
        if(!operation)throw failure('PAYMENT_OPERATION_MISMATCH');
        const amount=fact.amount??data.amount;
        if(status==='REFUNDED'||amount==null){
          const verified=await getTochkaPaymentInfo(env,{operationId:operation});
          if(verified.status.toUpperCase()!==status)throw failure('PAYMENT_STATUS_NOT_CONFIRMED',503);
          await applyProviderStatus(id,verified,env);
        }else{
          await applyProviderStatus(id,{status:'APPROVED',operationId:operation,
            amount,paidAt:fact.paidAt||data.paidAt},env);
        }
      }
      return json(res,200,{ok:true});
    }
    return json(res,404,{ok:false,error:'NOT_FOUND'});
  }catch(error){return json(res,error.status||500,{ok:false,error:String(error.message||error)})}
});
server.listen(port,'127.0.0.1',()=>console.log('sdelaet payment api on '+server.address().port));
