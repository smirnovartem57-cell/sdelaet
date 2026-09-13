const PROD='https://enter.tochka.com/uapi';

function required(env,name){
  const value=String(env[name]||'').trim();
  if(!value) throw Object.assign(new Error(`MISSING_${name}`),{status:503});
  return value;
}

export async function createTochkaPayment(env,{orderId,plan}){
  const token=required(env,'TOCHKA_JWT_TOKEN');
  const customerCode=required(env,'TOCHKA_CUSTOMER_CODE');
  const merchantId=required(env,'TOCHKA_MERCHANT_ID');
  const base=String(env.TOCHKA_BASE_URL||PROD).replace(/\/$/,'');
  const Data={customerCode,merchantId,amount:plan.amount,purpose:`Оплата тарифа «${plan.name}» сервиса «Сделает»`,paymentLinkId:orderId,paymentMode:['sbp','card'],redirectUrl:`${env.PUBLIC_ORIGIN}/payment-success.html?order=${encodeURIComponent(orderId)}`,failRedirectUrl:`${env.PUBLIC_ORIGIN}/payment-failed.html?order=${encodeURIComponent(orderId)}`,callbackUrl:`${env.PUBLIC_ORIGIN}/api/payments/v1/tochka/webhook`};
  const r=await fetch(`${base}/acquiring/v1.0/payments`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json; charset=utf-8','accept':'application/json'},body:JSON.stringify({Data})});
  const body=await r.json().catch(()=>({}));
  if(!r.ok) throw Object.assign(new Error(body?.message||`TOCHKA_HTTP_${r.status}`),{status:502,detail:body});
  const d=body?.Data||body?.data||body;
  const url=d?.paymentLink||d?.paymentUrl||d?.url;
  if(!url) throw Object.assign(new Error('TOCHKA_PAYMENT_URL_MISSING'),{status:502,detail:body});
  return {provider:'tochka',url,operationId:d?.operationId||'',consumerId:d?.consumerId||'',raw:d};
}
