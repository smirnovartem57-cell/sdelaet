import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {getPlan} from './plans.mjs';
import {createTochkaPayment} from './tochka.mjs';
import {verifyTochkaWebhook} from './webhook.mjs';
import {putOrder,getOrder,patchOrder} from './store.mjs';

const env=process.env,port=Number(env.PAYMENT_PORT||8790);
const origin=env.PUBLIC_ORIGIN||'https://onsdelaet.ru';
function json(res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':origin});res.end(JSON.stringify(body))}
async function body(req,max=16000){let raw='';for await(const c of req){raw+=c;if(raw.length>max)throw Object.assign(new Error('PAYLOAD_TOO_LARGE'),{status:413})}return raw}
function webhookFields(c){const d=c?.Data||c?.data||c;return {id:d?.paymentLinkId||d?.Operation?.[0]?.paymentLinkId,status:d?.status||d?.Operation?.[0]?.status,operationId:d?.operationId||d?.Operation?.[0]?.operationId,amount:d?.amount||d?.Operation?.[0]?.amount}}

const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}
  try{
    if(req.method==='GET'&&req.url==='/health')return json(res,200,{ok:true,service:'sdelaet-payment-api',provider:'tochka',configured:Boolean(env.TOCHKA_JWT_TOKEN&&env.TOCHKA_CUSTOMER_CODE)});
    if(req.method==='POST'&&req.url==='/v1/payments'){const input=JSON.parse(await body(req)||'{}');const plan=getPlan(input.plan);const id=`SD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${randomUUID().slice(0,8).toUpperCase()}`;await putOrder({id,plan:plan.id,amount:plan.amount,status:'pending',taskId:String(input.taskId||'').slice(0,80),createdAt:new Date().toISOString()});const payment=await createTochkaPayment({...env,PUBLIC_ORIGIN:origin},{orderId:id,plan});await patchOrder(id,{provider:'tochka',paymentUrl:payment.url});return json(res,201,{ok:true,orderId:id,paymentUrl:payment.url})}
    if(req.method==='GET'&&req.url.startsWith('/v1/payments/')){const id=decodeURIComponent(req.url.split('/').pop());const order=await getOrder(id);return order?json(res,200,{ok:true,order}):json(res,404,{ok:false,error:'ORDER_NOT_FOUND'})}
    if(req.method==='POST'&&req.url==='/v1/tochka/webhook'){const claims=await verifyTochkaWebhook(await body(req,32000));const f=webhookFields(claims);if(f.id&&f.status==='APPROVED')await patchOrder(f.id,{status:'paid',operationId:f.operationId||'',paidAt:new Date().toISOString()});return json(res,200,{ok:true})}
    return json(res,404,{ok:false,error:'NOT_FOUND'});
  }catch(e){return json(res,e.status||500,{ok:false,error:String(e.message||e),detail:env.DEBUG==='1'?e.detail:undefined})}
});
server.listen(port,'127.0.0.1',()=>console.log(`sdelaet payment api on 127.0.0.1:${port}`));
