import {getOrder,withOrders} from './store.mjs';
import {findTochkaPayment,getTochkaPaymentInfo} from './tochka.mjs';

const now=()=>new Date().toISOString();
const conflict=code=>Object.assign(new Error(code),{status:409});

export function needsLifecycleDelivery(order){
  return Boolean(['paid','refunded'].includes(order?.status)&&order.taskId&&(order.operationId||order.id)&&order.lifecyclePending!==false);
}

async function deliver(id,env){
  return withOrders(async (orders,save)=>{
    const order=orders[id];
    if(!needsLifecycleDelivery(order))return order;
    const accountApi=String(env.ACCOUNT_API_URL||'http://127.0.0.1:3210').replace(/\/$/,'');
    const response=await fetch(accountApi+'/v1/internal/payment-confirmed',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({taskId:order.taskId,paymentId:order.operationId||order.id,status:order.status,
        tariff:order.plan,amount:order.amount,paidAmount:order.paidAmount??order.amount,paidAt:order.paidAt}),
      signal:AbortSignal.timeout(3500)
    });
    if(!response.ok)throw Object.assign(new Error('PAYMENT_LIFECYCLE_SYNC_FAILED'),{status:503});
    order.lifecyclePending=false;
    await save();
    return order;
  });
}

export async function applyProviderStatus(id,fact,env){
  const order=await withOrders(async (orders,save)=>{
    const current=Object.hasOwn(orders,id)?orders[id]:null;
    if(!current)return null;
    if(fact.paymentLinkId&&fact.paymentLinkId!==id)throw conflict('PAYMENT_ORDER_MISMATCH');
    if(!fact.operationId||(current.operationId&&fact.operationId!==current.operationId)){
      throw conflict('PAYMENT_OPERATION_MISMATCH');
    }
    const status=String(fact.status||'').toUpperCase();
    if(status==='APPROVED'&&(fact.amount==null||Number(fact.amount)!==Number(current.amount))){
      throw conflict('PAYMENT_AMOUNT_MISMATCH');
    }
    if(current.status==='refunded'||(current.status==='paid'&&status!=='REFUNDED'))return current;
    current.operationId=fact.operationId;
    if(fact.paymentUrl&&!current.paymentUrl)current.paymentUrl=fact.paymentUrl;
    current.providerStatus=status;
    current.providerCheckedAt=now();
    if(status==='APPROVED'){
      current.status='paid';
      current.paidAt=current.paidAt||fact.paidAt||now();
      current.paidAmount=Number(fact.amount);
      current.lifecyclePending=true;
      current.paymentSuccessEvent={event:'payment_success',task_id:current.taskId,
        payment_id:current.operationId,tariff:current.plan,amount:current.paidAmount,
        currency:'RUB',ym_client_id:current.ymClientId||'',
        intent_cluster:current.attribution?.intent_cluster||'',confirmedBy:'tochka_verified'};
    }else if(status==='EXPIRED'||status==='REFUNDED'){
      current.status=status.toLowerCase();
      if(status==='REFUNDED'){
        current.refundedAt=now();
        current.lifecyclePending=true;
      }
    }
    await save();
    return current;
  });
  return needsLifecycleDelivery(order)?deliver(id,env):order;
}

export async function refreshOrder(id,env,{reconcile=false,checkPaid=false}={}){
  const order=await getOrder(id);
  if(checkPaid&&order?.status==='paid'&&order.operationId){
    const fact=await getTochkaPaymentInfo(env,{operationId:order.operationId});
    return applyProviderStatus(id,fact,env);
  }
  if(needsLifecycleDelivery(order))return deliver(id,env);
  if(order?.status!=='pending')return order;
  if(order.dispatchState==='reserved'){
    if(!reconcile)return order;
    return withOrders(async (orders,save)=>{
      const current=orders[id];
      if(current?.status==='pending'&&current.dispatchState==='reserved'){
        current.status='expired';
        await save();
      }
      return current;
    });
  }
  const fact=order.operationId?await getTochkaPaymentInfo(env,{operationId:order.operationId}):
    reconcile?await findTochkaPayment(env,order):null;
  return fact?applyProviderStatus(id,fact,env):order;
}
