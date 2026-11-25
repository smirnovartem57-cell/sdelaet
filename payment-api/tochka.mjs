const PROD='https://enter.tochka.com/uapi';
function required(env,name){const value=String(env[name]||'').trim();if(!value)throw Object.assign(new Error(`MISSING_${name}`),{status:503});return value}
export function validateTochkaConfiguration(env){
 for(const name of ['TOCHKA_JWT_TOKEN','TOCHKA_CUSTOMER_CODE','TOCHKA_MERCHANT_ID'])required(env,name);
 const endpoint=new URL(env.TOCHKA_BASE_URL||PROD);
 if(!['https:','http:'].includes(endpoint.protocol))throw new Error('INVALID_TOCHKA_ENDPOINT');
}
export async function createTochkaPayment(env,{orderId,plan,email}){
 const token=required(env,'TOCHKA_JWT_TOKEN'),customerCode=required(env,'TOCHKA_CUSTOMER_CODE'),merchantId=required(env,'TOCHKA_MERCHANT_ID');
 const base=String(env.TOCHKA_BASE_URL||PROD).replace(/\/$/,'');
 const Data={customerCode,merchantId,amount:plan.amount,purpose:`Оплата тарифа «${plan.name}» сервиса «Сделает»`,paymentLinkId:orderId,paymentMode:['sbp','card'],redirectUrl:`${env.PUBLIC_ORIGIN}/payment-success.html?order=${encodeURIComponent(orderId)}`,failRedirectUrl:`${env.PUBLIC_ORIGIN}/payment-failed.html?order=${encodeURIComponent(orderId)}`,callbackUrl:`${env.PUBLIC_ORIGIN}/api/payments/v1/tochka/webhook`,taxSystemCode:'usn_income',Client:{email},Items:[{name:`Информационно-технологическая услуга «Сделает» — ${plan.name}`,amount:plan.amount,quantity:1,vatType:'none',paymentMethod:'full_payment',paymentObject:'service',measure:'шт.'}]};
 const r=await fetch(`${base}/acquiring/v1.0/payments_with_receipt`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json; charset=utf-8',accept:'application/json'},body:JSON.stringify({Data}),signal:AbortSignal.timeout(10000)});
 const response=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(response?.message||`TOCHKA_HTTP_${r.status}`),{status:502,detail:response});
 const d=response?.Data||response?.data||response,url=d?.paymentLink||d?.paymentUrl||d?.url;if(!url)throw Object.assign(new Error('TOCHKA_PAYMENT_URL_MISSING'),{status:502,detail:response});
 return {provider:'tochka',url,operationId:d?.operationId||'',consumerId:d?.consumerId||'',raw:d};
}


export async function getTochkaPaymentInfo(env,{operationId}){
 const token=required(env,'TOCHKA_JWT_TOKEN'),id=String(operationId||'').trim();
 if(!id)throw Object.assign(new Error('TOCHKA_OPERATION_ID_REQUIRED'),{status:400});
 const base=String(env.TOCHKA_BASE_URL||PROD).replace(/\/$/,'');
 const r=await fetch(`${base}/acquiring/v1.0/payments/${encodeURIComponent(id)}`,{headers:{authorization:`Bearer ${token}`,accept:'application/json'},signal:AbortSignal.timeout(5000)});
 const response=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(new Error(response?.message||`TOCHKA_STATUS_HTTP_${r.status}`),{status:502,detail:response});
 const d=response?.Data||response?.data||response;
 const op=Array.isArray(d?.Operation)&&d.Operation.length?d.Operation[0]:d;
 return {status:String(op?.status||d?.status||'').trim(),operationId:String(op?.operationId||d?.operationId||id),paymentLinkId:String(op?.paymentLinkId||d?.paymentLinkId||''),paidAt:op?.paidAt||d?.paidAt||null,amount:op?.amount??d?.amount};
}

// A positive order match can recover a lost create response. A missing match
// is not proof that the bank did not accept the original request.
export async function findTochkaPayment(env,order){
 const token=required(env,'TOCHKA_JWT_TOKEN'),base=String(env.TOCHKA_BASE_URL||PROD).replace(/\/$/,'');
 const created=Date.parse(order.createdAt);
 if(!Number.isFinite(created))return null;
 const day=86400000;
 const query=new URLSearchParams({
  customerCode:required(env,'TOCHKA_CUSTOMER_CODE'),
  fromDate:new Date(created-day).toISOString().slice(0,10),
  toDate:new Date(Math.min(created+day,Date.now())).toISOString().slice(0,10)
 });
 const r=await fetch(base+'/acquiring/v1.0/payments?'+query,{
  headers:{authorization:'Bearer '+token,accept:'application/json'},signal:AbortSignal.timeout(5000)
 });
 if(!r.ok)throw new Error('TOCHKA_RECONCILIATION_HTTP_'+r.status);
 const response=await r.json();
 const entries=response?.Data?.Operation;
 if(!Array.isArray(entries))throw new Error('TOCHKA_RECONCILIATION_INVALID_RESPONSE');
 const matches=entries.filter(entry=>entry.paymentLinkId===order.id);
 if(matches.length>1)throw new Error('TOCHKA_RECONCILIATION_MULTIPLE_MATCHES');
 const match=matches[0];
 if(!match)return null;
 if(match.amount==null||Number(match.amount)!==Number(order.amount))throw new Error('PAYMENT_AMOUNT_MISMATCH');
 return {paymentLinkId:match.paymentLinkId,operationId:match.operationId,status:match.status,
  amount:match.amount,paidAt:match.paidAt,paymentUrl:match.paymentLink};
}
