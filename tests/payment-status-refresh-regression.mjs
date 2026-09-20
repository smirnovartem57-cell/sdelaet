import fs from 'node:fs';
import {getTochkaPaymentInfo} from '../payment-api/tochka.mjs';
function ok(v,m){if(!v)throw new Error(m)}
const oldFetch=globalThis.fetch;
globalThis.fetch=async (url,opts)=>({ok:true,status:200,json:async()=>({Data:{status:'APPROVED',operationId:'op-1',paymentLinkId:'SD-1',paidAt:'2026-09-20T02:54:21+03:00'}})});
const info=await getTochkaPaymentInfo({TOCHKA_JWT_TOKEN:'test',TOCHKA_BASE_URL:'https://example.test/uapi'},{operationId:'op-1'});
globalThis.fetch=oldFetch;
ok(info.status==='APPROVED','Tochka APPROVED status must parse');
ok(info.paymentLinkId==='SD-1','paymentLinkId must parse');
ok(info.paidAt,'paidAt must parse');
const server=fs.readFileSync('payment-api/server.mjs','utf8');
ok(server.includes('refreshPendingOrder(order)'),'pending order refresh helper must exist');
ok(server.includes("order&&order.status==='pending'"),'GET payment route must refresh pending order');
ok(server.includes("providerStatus==='APPROVED'"),'APPROVED must map to paid');const page=fs.readFileSync('payment-success.html','utf8');
ok(page.includes("pollTimer=setTimeout(()=>check(false),2200)"),'success page must auto-poll');
ok(page.includes("location.replace(next)"),'success page must auto-redirect');
ok(page.includes("Оплата получена"),'success state must be explicit');
ok(page.includes("Повторно оплачивать заказ не нужно"),'pending state must prevent duplicate payment confusion');
console.log('PAYMENT STATUS REFRESH REGRESSION: PASS');