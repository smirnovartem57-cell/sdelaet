import fs from 'node:fs';

const createTask=fs.readFileSync('create-task.html','utf8');
const categoryEngine=fs.readFileSync('assets/category-engine.js','utf8');
const taskTz=fs.readFileSync('task-tz.html','utf8');
const payment=fs.readFileSync('payment-success.html','utf8');
const requests=fs.readFileSync('requests.html','utf8');

function ok(value,message){if(!value)throw new Error(message)}

ok(createTask.includes('function applyDetectedContext()'),'detected context normalizer must exist');
ok(createTask.includes("filter(function(q){return q.type!=='sizes'})"),'recognized photo geometry must remove sizes question');
ok(createTask.includes("filter(function(q){return q.id!=='city'})"),'confident region must remove city question');
ok(createTask.includes("https://ipwho.is/?fields=success,country_code,city,region"),'new task must resolve region by IP when no saved preference exists');
ok(createTask.includes('(editMode&&saved&&saved.geo)'), 'editing must prefer saved task geo over current IP');
ok(createTask.includes('await regionReady;await analyzeTaskInput'),'analysis must wait for region resolution');
ok(categoryEngine.includes("categoryId:'universal-home-repair'"),'unknown in-domain task must use universal category instead of dead-end');
ok(categoryEngine.includes("categoryStatus:'unclassified_in_domain'"),'universal task must preserve unclassified taxonomy status');
ok(categoryEngine.includes("id:'objectPlace'")&&categoryEngine.includes("id:'goal'"),'universal task must ask object/place and desired result');
ok(createTask.includes('/v1/taxonomy/signals'),'unclassified task must be recorded as taxonomy expansion signal');
ok(createTask.includes("category_status:'unclassified_in_domain'"),'taxonomy signal must retain unclassified in-domain status');

ok(taskTz.includes("function restoreCheckoutState()"),'checkout state must restore');
ok(taskTz.includes("task.categoryId||'universal-home-repair'"),'missing category must search via universal home-repair path');
ok(!taskTz.includes("task.categoryId||'balcony-insulation'"),'unknown task must never fall back to balcony insulation');
ok(taskTz.includes("sdelaet.payment.active.v1"),'paid entitlement must persist locally');
ok(taskTz.includes("checkExistingPaidOrder()"),'paid task must be checked before paywall');
ok(taskTz.includes("||await checkExistingPaidOrder()"),'paywall click must re-check payment to avoid race');
ok(taskTz.includes("openPaywallButton.textContent='Перейти к кандидатам →'"),'paid task CTA must go to candidates');
ok(taskTz.includes("content:'Выбрано'"),'selected tariff must be visually distinct');
ok(taskTz.includes("Выбор сохранится для этой задачи"),'tariff UI must explain persistence');

ok(payment.includes("sdelaet.payment.active.v1"),'payment success must persist entitlement');
ok(payment.includes("tariffName=pending.tariffId==='choice'?'До выбора':'Подбор'"),'success page must show actual tariff');
ok(payment.includes("location.replace('candidates.html')"),'successful payment must continue automatically to candidates');

ok(requests.includes('class="attachment-thumb"'),'request photos must render as compact thumbnails');
ok(requests.includes('function openAttachmentLightbox(src)'),'request photos must enlarge on click');
ok(requests.includes('cursor:zoom-in'),'photo thumbnails must communicate zoom');
ok(requests.includes('mail-appbar-logo"><img src="assets/logo-icon.svg"'),'mail app bar must use the service logo');
ok(requests.includes('mail-avatar"><img src="assets/logo-icon.svg"'),'mail sender avatar must use the service logo');

console.log('V20 FLOW REGRESSION: PASS');
