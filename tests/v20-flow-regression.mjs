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

const journey=fs.readFileSync('assets/task-journey-v1.js','utf8');
ok(taskTz.includes("assets/task-journey-v1.js"),'task TZ must use shared journey controller');
ok(journey.includes("RESUME='sdelaet.journey.resume.v1'"),'checkout resume state must be namespaced');
ok(journey.includes("selectionKey(id)"),'tariff selection must persist per task');
ok(journey.includes("resumeValid(value,now)"),'saved checkout state must be validated before resume');
ok(journey.includes("readStorage(storage('sessionStorage'),RESUME)"),'checkout state must restore from session storage');
ok(journey.includes("task.categoryId||'universal-home-repair'"),'missing category must search via universal home-repair path');
ok(!journey.includes("task.categoryId||'balcony-insulation'"),'unknown task must never fall back to balcony insulation');
ok(journey.includes("payment-status:"+""), 'payment journey module must be present');
ok(journey.includes("taskData.task?.payment?.status==='paid'"),'paid access must be confirmed from server task state');
ok(journey.includes("taskUrl(taskId,'#selection')"),'successful payment must continue in the same task');
ok(journey.includes("Repeat")||journey.includes("repeat"),'journey must retain repeat-pricing flow');
ok(journey.includes("selected"),'selected tariff must be visually distinct');
ok(journey.includes("persistSelection()"),'tariff choice must be persisted before auth/payment handoff');

ok(payment.includes("assets/task-journey-v1.js"),'payment success must use shared journey controller');
ok(payment.includes("sdJourney.initPaymentReturn()"),'payment return page must delegate to server-verified payment flow');
ok(!payment.includes("location.replace('candidates.html')"),'payment success must not leave the task-centric journey');

ok(requests.includes('class="attachment-thumb"'),'request photos must render as compact thumbnails');
ok(requests.includes('function openAttachmentLightbox(src)'),'request photos must enlarge on click');
ok(requests.includes('cursor:zoom-in'),'photo thumbnails must communicate zoom');
ok(requests.includes('mail-appbar-logo"><img src="assets/logo-icon.svg"'),'mail app bar must use the service logo');
ok(requests.includes('mail-avatar"><img src="assets/logo-icon.svg"'),'mail sender avatar must use the service logo');

console.log('V20 FLOW REGRESSION: PASS');
