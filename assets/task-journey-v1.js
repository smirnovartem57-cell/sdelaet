/* Sdelaet task journey. Network states are evidence-bound, never advanced by a timer. */
(function(host,factory){'use strict';var exports=factory(host);if(typeof module==='object'&&module.exports)module.exports=exports;if(host)host.sdJourney=exports;})(typeof window!=='undefined'?window:null,function(win){
'use strict';
var API='https://api.onsdelaet.ru',RESUME='sdelaet.journey.resume.v1',CONTACT='sdelaet.checkout.contact';
var fallbackStores={};
function storage(kind){try{return win[kind];}catch{if(!fallbackStores[kind]){var data=new Map();fallbackStores[kind]={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}return fallbackStores[kind];}}
var seenSignals=new Set();
var adapters={},checkoutState=null,checkoutTrap=null,checkoutEpoch=0,workspace=null,researchBusy=false;
function configure(value){adapters=Object.assign({},adapters,value||{});}
function esc(s){return win.sdResearchPricing.escapeHtml(s);}
function readStorage(store,key){try{return JSON.parse(store.getItem(key)||'null');}catch{return null;}}
function writeStorage(store,key,value){try{store.setItem(key,JSON.stringify(value));}catch{}}
function track(name,p){if(adapters.track)adapters.track(name,p);else if(win.sdTrack)win.sdTrack(name,p||{});}
function request(path,options){
 if(adapters.request)return adapters.request(path,options||{});
 return (async function(){var options2=Object.assign({credentials:'include',headers:{'content-type':'application/json'}},options||{});
 var isRead=!options2.method||options2.method==='GET',controller=new AbortController(),timer=win.setTimeout(()=>controller.abort(),isRead?15000:60000);
 if(controller)options2.signal=controller.signal;
 try{var r=await win.fetch(path.startsWith('/api/payments/')?path:API+path,options2);var d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false){var e=new Error(d.error||d.message||'REQUEST_FAILED');e.status=r.status;throw e;}return d;}
 finally{if(timer)win.clearTimeout(timer);}})();
}
function post(path,body){return request(path,{method:'POST',body:JSON.stringify(body)});}
function safeExternalUrl(value){try{var u=new URL(String(value||''));return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function taskUrl(id,hash){return '/task.html?task='+encodeURIComponent(id)+(hash||'');}
function safeReturn(path){if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||/[\\\r\n]/.test(path))return '/my-tasks.html';try{var u=new URL(path,'https://onsdelaet.ru');return u.origin==='https://onsdelaet.ru'?u.pathname+u.search+u.hash:'/my-tasks.html';}catch{return '/my-tasks.html';}}
function resumeValid(value,now){return !!(value&&typeof value.taskId==='string'&&value.taskId.length>0&&['find','choice'].includes(value.plan)&&Number.isFinite(value.at)&&now>=value.at&&now-value.at<1800000&&safeReturn(value.returnPath)===value.returnPath);}
function navigate(url,bank){
 if(adapters.navigate)return adapters.navigate(url);
 var u=new URL(url,win.location.href);if(!bank&&u.origin!==win.location.origin)throw new Error('INVALID_RETURN_ORIGIN');if(bank&&u.protocol!=='https:')throw new Error('INVALID_PAYMENT_URL');
 win.location.assign(u.href);
}
function updateStage(active){
 if(!win)return;
 var stages=win.document.querySelectorAll('.progress3 .stage');stages.forEach((el,i)=>{var newlyActive=i===active&&!el.classList.contains('active');el.classList.toggle('done',i<active);el.classList.toggle('active',i===active);var n=el.querySelector('.n');if(n)n.textContent=i<active?'✓':String(i+1);if(i===active)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');if(newlyActive)win.sdMotion.animate(el,{duration:180});});
 win.document.querySelectorAll('.progress3 .progress-line').forEach((el,i)=>el.classList.toggle('done',i<active));
 var demo=win.document.getElementById('demoSteps');if(demo){
  if(!demo.querySelector('[data-journey-stage]'))demo.innerHTML=['Задание','Подбор','Выбор'].map((name,i)=>'<span data-journey-stage="'+i+'">'+String(i+1).padStart(2,'0')+' · '+name+'</span>').join('<span aria-hidden="true">→</span>');
  demo.querySelectorAll('[data-journey-stage]').forEach((el,i)=>{var newlyActive=i===active&&!el.classList.contains('is-active');el.classList.toggle('is-done',i<active);el.classList.toggle('is-active',i===active);if(i===active)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');if(newlyActive)win.sdMotion.animate(el,{duration:180});});
 }
}
function stateBox(id,anchor){var el=win.document.getElementById(id);if(!el){el=win.document.createElement('div');el.id=id;el.className='sj-inline-state';anchor.insertAdjacentElement('afterend',el);}return el;}
function pricingInput(c){return {count:c.research?.candidateCount??c.research?.count,sourceCount:c.research?.sourceCount,strongCount:c.research?.strongCount,pricing:c.pricing||{}};}
function normalizeContext(c){
 if(!c||!String(c.taskId||c.task?.taskId||c.task?.id||''))throw new TypeError('Task identity is required');
 return {taskId:String(c.taskId||c.task?.taskId||c.task?.id),task:c.task||{},research:c.research||{},pricing:c.pricing||{},plan:['find','choice'].includes(c.plan)?c.plan:'find',returnPath:safeReturn(c.returnPath||win.location.pathname+win.location.search+win.location.hash),title:c.title||c.task?.title||c.task?.category||'Ваша задача',region:c.region||c.task?.region||c.task?.city||'',trigger:c.trigger||win.document.activeElement};
}
function checkoutMarkup(){return '<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="researchPricingTitle" tabindex="-1"><button class="rp-close" type="button" data-checkout-close aria-label="Закрыть выбор тарифа">×</button><header class="rp-header"><p class="rp-task-context" id="checkoutTaskContext"></p><div class="eyebrow">Бесплатное исследование завершено</div><h2 id="researchPricingTitle">Результат исследования готов</h2><p class="lead" id="checkoutLead"></p><p class="sj-pay-explain"><b>Исследование рынка было бесплатным.</b> Оплата нужна только если хотите открыть контакты, проверки и продолжить работу сервиса с найденными исполнителями.</p></header><div class="paywall-preview" id="shortlistPreview"><div class="preview-stat"><b id="previewCount">—</b><span id="previewCountLabel">найдено на первом этапе</span></div><div class="preview-stat"><b id="previewSources">—</b><span id="previewSourcesLabel">источников</span></div><div class="preview-stat" id="previewStrongStat"><b id="previewStrong">—</b><span id="previewStrongLabel">прошли квалификацию</span></div></div><div class="rp-checkout-grid"><section class="rp-tariff-area" aria-label="Выбор тарифа"><div class="tariff-section-title"><b>Какую помощь вы выбираете?</b></div><div class="tariff-selector" role="radiogroup" aria-label="Тариф для этой задачи"></div></section><aside class="checkout-contact-box"><h3>Данные для заказа</h3><p class="checkout-contact-note">Email будет взят из вашего аккаунта.</p><div class="checkout-fields"><label class="checkout-field"><span>Имя *</span><input id="checkoutName" autocomplete="name" placeholder="Ваше имя" maxlength="100"></label><label class="checkout-field"><span>Email аккаунта</span><input id="checkoutEmail" autocomplete="email" type="email" readonly placeholder="Подтвердим после входа"></label></div><details class="rp-contact-extra"><summary>Телефон и уведомления</summary><label class="checkout-field"><span>Контактный телефон</span><input id="checkoutPhone" autocomplete="tel" type="tel" maxlength="50" placeholder="+7 999 000-00-00"></label><div class="notification-channel-field"><span class="checkout-label" id="notificationLabel">Уведомления по задаче</span><div class="notification-channel-options" role="radiogroup" aria-labelledby="notificationLabel"><label><input type="radio" name="notificationChannel" value="email" checked><span>Email</span></label><label><input type="radio" name="notificationChannel" value="telegram"><span>Telegram</span></label><label><input type="radio" name="notificationChannel" value="both"><span>Email + Telegram</span></label></div><p class="rp-note-small">Для Telegram требуется привязка аккаунта.</p></div></details><div class="paywall-note" id="checkoutPricingNote" role="status"></div></aside></div><footer class="rp-footer"><p class="rp-send-policy"><b>Ничего не отправляем без вашего подтверждения.</b><br>После оплаты вы сначала изучите подбор. Проверки не гарантируют качество будущих работ.</p><div class="paywall-actions"><button class="btn primary large" id="journeyPay" type="button">Перейти к оплате</button><button class="btn secondary large" type="button" data-checkout-close>Вернуться к задаче</button></div></footer><div id="checkoutProgress" class="sj-inline-state" hidden></div><div class="payment-error hidden" id="checkoutError" role="alert"></div></div>';}
function checkoutRoot(){
 var doc=win.document,el=doc.getElementById('paywall');
 if(!el){el=doc.createElement('div');el.id='paywall';el.className='modal rp-checkout';doc.body.appendChild(el);}
 if(el.dataset.journeyBound)return el;
 el.classList.add('rp-checkout');el.innerHTML=checkoutMarkup();el.dataset.journeyBound='1';
 el.querySelectorAll('[data-checkout-close]').forEach(b=>b.addEventListener('click',closeCheckout));
 el.addEventListener('click',e=>{if(e.target===el)closeCheckout();});
 el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeCheckout();}});
 el.addEventListener('change',e=>{if(e.target.name==='checkoutTariff'&&checkoutState){if(checkoutState.submitting){updateCheckoutSelection();return;}checkoutState.plan=e.target.value;persistSelection();updateCheckoutSelection();}});
 el.querySelector('#journeyPay').addEventListener('click',function(){submitCheckout().catch(()=>{});});return el;
}
function selectionKey(id){return 'sdelaet.journey.selection.v1.'+encodeURIComponent(id);}
function persistSelection(needsAuth){if(!checkoutState)return;var value={taskId:checkoutState.taskId,plan:checkoutState.plan,returnPath:checkoutState.returnPath,at:Date.now(),needsAuth:!!needsAuth};writeStorage(storage('sessionStorage'),RESUME,value);writeStorage(storage('sessionStorage'),selectionKey(value.taskId),value);}
function contactSave(){var root=checkoutRoot();var old=readStorage(storage('localStorage'),CONTACT)||{};old.name=root.querySelector('#checkoutName').value.trim();old.phone=root.querySelector('#checkoutPhone').value.trim();old.notificationChannel=root.querySelector('input[name=notificationChannel]:checked')?.value||'email';delete old.tariffId;writeStorage(storage('localStorage'),CONTACT,old);}
function updateCheckoutSelection(){if(!checkoutState)return;var root=checkoutRoot(),m=win.sdResearchPricing.buildModel(pricingInput(checkoutState));root.querySelectorAll('[data-tariff-card]').forEach(el=>{el.classList.toggle('selected',el.dataset.tariffCard===checkoutState.plan);var r=el.querySelector('input');if(r)r.checked=el.dataset.tariffCard===checkoutState.plan;});var btn=root.querySelector('#journeyPay');win.sdMotion.text(btn,'Перейти к оплате — '+win.sdResearchPricing.money(m.plans[checkoutState.plan].amount));btn.disabled=!m.ready||!!checkoutState.submitting;}
function updateCheckout(){if(!checkoutState||checkoutState.submitting)return;var root=checkoutRoot(),input=pricingInput(checkoutState),m=win.sdResearchPricing.buildModel(input);
 root.querySelector('#checkoutTaskContext').textContent=checkoutState.title+(checkoutState.region?' · '+checkoutState.region:'');root.querySelector('#researchPricingTitle').textContent=m.title;root.querySelector('#checkoutLead').textContent=m.lead;
 [['previewCount',m.count],['previewSources',m.sourceCount],['previewStrong',m.strongCount]].forEach(([id,v])=>root.querySelector('#'+id).textContent=v===null?'—':String(v));
 var countLabel=root.querySelector('#previewCountLabel'),sourceLabel=root.querySelector('#previewSourcesLabel'),strongStat=root.querySelector('#previewStrongStat');
 if(countLabel)countLabel.textContent='найдено на первом этапе';
 if(sourceLabel&&m.sourceCount!==null)sourceLabel.textContent=m.sourceCount%100>=11&&m.sourceCount%100<=14?'источников':m.sourceCount%10===1?'источник':m.sourceCount%10>=2&&m.sourceCount%10<=4?'источника':'источников';
 if(strongStat)strongStat.hidden=m.strongCount===null||m.strongCount===0;
 root.querySelector('.tariff-selector').innerHTML=win.sdResearchPricing.cards(input,'checkout',checkoutState.plan);
 var p=m.plans[checkoutState.plan];root.querySelector('#checkoutPricingNote').textContent=p.repeat?'Повторная цена уже учтена.':checkoutState.pricingError?'Цену проверим перед переходом к оплате.':'';updateCheckoutSelection();}
async function openCheckout(context){
 var root=checkoutRoot();if(checkoutState?.submitting)return;var c=normalizeContext(context),epoch=++checkoutEpoch;
 if(checkoutTrap)checkoutTrap.close();checkoutState=c;
 var saved=readStorage(storage('sessionStorage'),selectionKey(c.taskId));if(!context.plan&&resumeValid(saved,Date.now())&&saved.taskId===c.taskId)c.plan=saved.plan;
 var contact=readStorage(storage('localStorage'),CONTACT)||{};root.querySelector('#checkoutName').value=contact.name||'';root.querySelector('#checkoutPhone').value=contact.phone||'';root.querySelectorAll('input[name=notificationChannel]').forEach(r=>r.checked=r.value===(contact.notificationChannel||'email'));root.querySelector('#checkoutEmail').value='';root.querySelector('#checkoutError').classList.add('hidden');root.querySelector('#checkoutProgress').hidden=true;
 updateCheckout();persistSelection();checkoutTrap=win.sdMotion.trap(root,{returnFocus:c.trigger});track('search_paywall_view',{task_id:c.taskId,count:win.sdResearchPricing.normalizeCount(pricingInput(c).count),shortlist_ready:true,surface:c.task.taskId?'task':'tz'});
 // Loading account/pricing never drives entitlement or fabricated research counts.
 var r=await Promise.allSettled([request('/v1/account/pricing?taskId='+encodeURIComponent(c.taskId)),request('/v1/auth/session')]);
 if(epoch!==checkoutEpoch||checkoutState!==c)return;
 if(r[0].status==='fulfilled'&&r[0].value.tariffs)c.pricing=r[0].value;else c.pricingError=true;
 if(c.pricing.repeatDiscount?.eligible&&!seenSignals.has('repeat:'+c.taskId)){seenSignals.add('repeat:'+c.taskId);track('repeat_discount_shown',{task_id:c.taskId,surface:'checkout'});}
 if(r[1].status==='fulfilled'&&r[1].value.authenticated)root.querySelector('#checkoutEmail').value=r[1].value.user?.email||'';
 updateCheckout();
}
function closeCheckout(){if(checkoutState?.submitting)return;contactSave();if(checkoutTrap){checkoutTrap.close();checkoutTrap=null;}checkoutEpoch++;checkoutState=null;}
function showCheckoutError(message){var box=checkoutRoot().querySelector('#checkoutError');box.textContent=message;box.classList.remove('hidden');}
function submitCheckout(){if(!checkoutState)return Promise.resolve(false);var c=checkoutState;return win.sdMotion.once('checkout:'+c.taskId,async function(){
 var root=checkoutRoot(),m=win.sdResearchPricing.buildModel(pricingInput(c));if(!m.ready)return false;
 var name=root.querySelector('#checkoutName').value.trim();if(!name){showCheckoutError('Укажите имя для заказа.');root.querySelector('#checkoutName').setAttribute('aria-invalid','true');root.querySelector('#checkoutName').focus();return false;}
 root.querySelector('#checkoutName').removeAttribute('aria-invalid');root.querySelector('#checkoutError').classList.add('hidden');c.submitting=true;
 var buttons=Array.from(root.querySelectorAll('button,input[name="checkoutTariff"]')),op=win.sdMotion.operation(root.querySelector('#checkoutProgress'),{state:'pending',title:'Проверяем аккаунт',note:'Сохраняем выбранный тариф для этой задачи.',buttons:buttons});var handedOff=false;
 try{
  persistSelection();contactSave();var session=await request('/v1/auth/session');
  if(!session.authenticated){persistSelection(true);navigate('/?login=1&return='+encodeURIComponent(c.returnPath));handedOff=true;return false;}
  root.querySelector('#checkoutEmail').value=session.user?.email||'';
  // If the server reused an order with a different amount, a second explicit
  // confirmation verifies that very order. It must not create another order.
  if(c.preparedPayment&&c.preparedPayment.tariffId===c.plan){
   var saved=c.preparedPayment.data,verified=await request('/api/payments/v1/payments/'+encodeURIComponent(saved.orderId)),order=verified.order||{};
   if(String(order.id||'')!==String(saved.orderId)||String(order.taskId||'')!==c.taskId||String(order.plan||'').replace(/_repeat$/,'')!==c.plan)throw new Error('ORDER_IDENTITY_MISMATCH');
   if(order.status==='paid'){op.set('saved','Оплата уже подтверждена','Проверьте доступ в вашей задаче. Повторный платёж не создаётся.');showCheckoutError('Заказ уже оплачен. Откройте эту задачу в «Моих задачах».');return false;}
   if(order.status!=='pending'){c.preparedPayment=null;throw new Error('ORDER_NOT_PENDING');}
   if(!Number.isFinite(Number(order.amount))||Number(order.amount)!==Number(saved.amount))throw new Error('ORDER_AMOUNT_CHANGED');
   track('payment_link_created',{task_id:c.taskId,tariff_id:c.plan,tariff:c.plan,price:Number(saved.amount),amount:Number(saved.amount),price_type:saved.priceType,currency:'RUB'});if(saved.priceType==='repeat')track('repeat_task_started',{task_id:c.taskId,tariff_id:c.plan});
   op.set('pending','Переходим к оплате','Вы подтвердили сумму '+win.sdResearchPricing.money(Number(saved.amount))+'.');navigate(saved.paymentUrl,true);handedOff=true;return true;
  }
  // A current server quote is mandatory before creating a payment link.
  var quote=await request('/v1/account/pricing?taskId='+encodeURIComponent(c.taskId));
  if(!quote.tariffs?.[c.plan]||!Number.isFinite(quote.tariffs[c.plan].amount))throw new Error('PRICING_UNAVAILABLE');
  var shown=m.plans[c.plan].amount,actual=quote.tariffs[c.plan].amount;c.pricing=quote;
  if(actual!==shown){op.set('saved','Цена обновлена','Проверьте сумму и подтвердите переход к оплате.');c.submitting=false;updateCheckout();showCheckoutError('Актуальная цена — '+win.sdResearchPricing.money(actual)+'. Нажмите «Продолжить», чтобы подтвердить.');return false;}
  if(c.task?.id&&win.sdAccountSaveTask&&!c.task?.taskId)await win.sdAccountSaveTask(c.task);
  var event={task_id:c.taskId,service:c.task?.categoryId||c.task?.serviceId||'',tariff_id:c.plan,tariff:c.plan,price:actual,currency:'RUB'};
  track('tariff_selected',event);track('payment_start',event);
  op.set('pending','Создаём ссылку на оплату','В банк будут переданы выбранный тариф и сумма.');
  var d=await post('/v1/account/payment',{taskId:c.taskId,tariffId:c.plan});
  if(!d.paymentUrl||!d.orderId||!Number.isFinite(d.amount)||d.amount<=0)throw new Error('PAYMENT_LINK_FAILED');
  writeStorage(storage('localStorage'),'sdelaet.payment.pending',{orderId:d.orderId,taskId:c.taskId,tariffId:c.plan,amount:d.amount,priceType:d.priceType,createdAt:new Date().toISOString()});
  if(d.amount!==actual){
   c.preparedPayment={tariffId:c.plan,data:d};c.pricing=Object.assign({},c.pricing,{tariffs:Object.assign({},c.pricing.tariffs,{[c.plan]:Object.assign({},c.pricing.tariffs[c.plan],{amount:d.amount,priceType:d.priceType||'regular'})})});
   op.set('saved','Уточнена сумма заказа','Подтвердите фактическую сумму перед переходом в банк.');c.submitting=false;updateCheckout();showCheckoutError('Сумма сохранённого заказа — '+win.sdResearchPricing.money(d.amount)+'. Нажмите «Продолжить», чтобы подтвердить её.');return false;
  }
  track('payment_link_created',Object.assign({},event,{price:d.amount,amount:d.amount,price_type:d.priceType}));if(d.priceType==='repeat')track('repeat_task_started',{task_id:c.taskId,tariff_id:c.plan});
  op.set('pending','Переходим к оплате','Результат платежа подтвердим после ответа сервера.');navigate(d.paymentUrl,true);handedOff=true;return true;
 }catch(e){op.set('error','Не удалось перейти к оплате','Сохранены задача и выбранный тариф.');var msg=e.message==='PRICING_UNAVAILABLE'?'Не удалось подтвердить актуальную цену. Попробуйте ещё раз.':e.message==='TASK_NOT_FOUND'||e.message==='FORBIDDEN'?'Задача ещё не привязана к аккаунту. Обновите страницу и повторите переход к оплате.':e.message==='PAYMENT_LINK_FAILED'?'Платёжный сервис не выдал ссылку на оплату. Повторно списание не создавалось. Попробуйте ещё раз.':'Не удалось создать или подтвердить платёжную ссылку. Деньги не списаны. Повторите попытку или вернитесь к задаче.';showCheckoutError(msg);return false;}
 finally{c.submitting=false;op.dispose();if(!handedOff&&checkoutState===c)updateCheckoutSelection();}
 });}
async function resumeCheckout(context){var r=readStorage(storage('sessionStorage'),RESUME);if(!(resumeValid(r,Date.now())&&r.needsAuth&&r.taskId===String(context.taskId)&&r.returnPath===safeReturn(win.location.pathname+win.location.search+win.location.hash)))return false;await openCheckout(Object.assign({},context,{plan:r.plan}));var session=await request('/v1/auth/session');if(!session.authenticated)return false;writeStorage(storage('sessionStorage'),RESUME,Object.assign({},r,{needsAuth:false,at:Date.now()}));return submitCheckout();}
function initResearch(task,options){
 options=options||{};var btn=win.document.getElementById('openPaywall');if(!btn)return;
 var box=stateBox('journeyResearch',btn.closest('.actions')||btn),latestResearch=null,surface=btn.closest('.page>section.card')||win.document.getElementById('demoDraft');
 async function saved(){try{var d=await post('/v1/shortlists/prepared',{task_id:task.id||''});return d.prepared&&Number(d.count)>0?d:null;}catch{return null;}}
 async function run(){if(researchBusy)return;researchBusy=true;if(surface)win.sdMotion.layout(surface,()=>surface.classList.add('sj-research-active'));var op=win.sdMotion.operation(box,{state:'starting',note:'Задание остаётся на этой странице.',buttons:[btn]});
 try{
  // A cached paid marker is never a grant. Use the authenticated server task.
  try{var server=await request('/v1/account/tasks/'+encodeURIComponent(task.id));if(server.task?.payment?.status==='paid'){op.set('ready','Открываем оплаченную задачу','Повторный поиск не запускается.');navigate(taskUrl(task.id,'#selection'));return;}}catch(e){if(e.status&&![401,403,404].includes(e.status))throw e;}
  if(win.sdAccountSaveTask){try{await win.sdAccountSaveTask(task);}catch(e){if(e.status!==401&&e.status!==403)throw e;}}
  var result=await saved();
  if(!result){updateStage(1);track('tz_confirmed',{task_id:task.id,category:task.category,city:task.city,version:task.version||1});op.set('working','Исследуем рынок','Ищем исполнителей под вашу задачу. Покажем результат после ответа сервера.');track('research_started',{task_id:task.id,service:task.categoryId||task.category||''});
   var payload={taskId:task.id||'',categoryId:task.categoryId||'universal-home-repair',category:task.category||'',city:task.city||task.locality||'',region:task.region||task.geo?.canonicalRegion||'',regionId:task.regionId||task.geo?.regionId||'',locality:task.locality||task.geo?.canonicalLocality||task.city||'',localityId:task.localityId||task.geo?.localityId||'',launchZone:task.launchZone||task.geo?.launchZone||'',description:task.description||'',scope:task.scope||'',goal:task.goal||'',executorPreference:'any',limit:12,attribution:win.sdAttributionForTask?win.sdAttributionForTask():null};
   var d=await post('/v1/candidates/search',payload);if(!d.runId)throw new Error('SHORTLIST_NOT_READY');result=await saved();
   if(!result){if(d.count===0||Array.isArray(d.candidates)&&d.candidates.length===0){op.set('empty','Подходящих кандидатов пока нет','Уточните задание и повторите поиск. Оплата не требуется.');return;}throw new Error('SHORTLIST_NOT_PERSISTED');}
   track('shortlist_prepared',{task_id:task.id,count:result.count,run_id:result.runId});track('result_ready',{task_id:task.id,service:task.categoryId||task.category||''});
  }
  latestResearch=result;updateStage(1);op.set('ready','Бесплатное исследование завершено','На первом этапе найдено '+result.count+' '+win.sdResearchPricing.noun(Number(result.count))+'. Теперь можно бесплатно вернуться к заданию или выбрать платный тариф для открытия контактов и продолжения работы сервиса.');
  track('result_viewed',{task_id:task.id,service:task.categoryId||task.category||''});
  await openCheckout({taskId:task.id,task:task,research:result,title:task.category,region:task.city,trigger:btn});
 }catch(e){op.set(win.navigator.onLine===false?'offline':'error','Не удалось завершить исследование','Задание не сброшено. Проверьте соединение и повторите запрос.');}
 finally{researchBusy=false;op.dispose();if(surface)win.sdMotion.layout(surface,()=>surface.classList.remove('sj-research-active'));btn.textContent=latestResearch?'Посмотреть бесплатный результат →':'Исследовать рынок бесплатно →';}}
 btn.onclick=run;
 // Resume only the matching task. It opens checkout, never submits a payment.
 var r=readStorage(storage('sessionStorage'),RESUME);if(resumeValid(r,Date.now())&&r.needsAuth&&r.taskId===String(task.id)&&r.returnPath===safeReturn(win.location.pathname+win.location.search+win.location.hash)){saved().then(x=>{if(x){latestResearch=x;return resumeCheckout({taskId:task.id,task:task,research:x,title:task.category,region:task.city});}}).catch(()=>{});}
 return {run:run};
}
function outreachLabel(status){var value=({prepared:'подготовлено',queued:'в очереди',sending:'отправляем',sent:'отправлено',delivered:'доставлено',replied:'получен ответ',failed:'ошибка отправки',cancelled:'отменено'})[status];return typeof value==='string'?value:'статус уточняется';}
function paymentLabel(status){var value=({pending:'Ожидает оплаты',paid:'Оплачено',failed:'Платёж не подтверждён',cancelled:'Отменён',canceled:'Отменён',expired:'Срок оплаты истёк',refunded:'Возвращён'})[status];return typeof value==='string'?value:'Статус уточняется';}
function pendingTask(t){
 if(!t||['completed','cancelled','archived'].includes(t.status?.code))return false;
 return t.status?.code==='researching'||!t.research&&t.status?.code==='research_ready'||t.status?.code==='waiting_replies'||(t.outreach||[]).some(a=>['sent','delivered','prepared','sending','queued'].includes(a.status));
}
function workspaceNotice(root,message,fn){var box=win.document.getElementById('journeyWorkspaceNotice');if(!box){box=win.document.createElement('div');box.id='journeyWorkspaceNotice';root.insertAdjacentElement('beforebegin',box);}box.className='sj-refresh-error';box.setAttribute('role','status');box.innerHTML=esc(message)+' <button type="button">Обновить статус</button>';box.querySelector('button').onclick=fn;}
function focusCandidate(root){
 var id=new URLSearchParams(win.location.search).get('candidate');if(!id||root.__sjFocusedCandidate===id)return;
 var card=Array.from(root.querySelectorAll('[data-candidate-id]')).find(el=>el.dataset.candidateId===id);if(!card)return;
 root.__sjFocusedCandidate=id;card.setAttribute('tabindex','-1');card.focus({preventScroll:true});card.scrollIntoView({block:'center',behavior:win.sdMotion.reduced()?'auto':'smooth'});win.sdMotion.pulse(card);
}
function mountWorkspace(root,task,render){
 updateStage(task.offers?.length||task.status?.code==='offers_ready'?2:task.research||task.payment?1:0);focusCandidate(root);
 if(workspace&&workspace.root===root&&!workspace.disposed){workspace.task=task;workspace.schedule();return workspace;}
 if(workspace)workspace.dispose();var timer=null,stopped=false,paused=false,started=Date.now(),readRevision=0,refreshing=false;
 var ws={root:root,task:task,render:render,refresh:refresh,schedule:schedule,dispose:dispose,disposed:false};workspace=ws;
 async function refresh(){if(stopped||paused||refreshing)return;refreshing=true;var revision=++readRevision;
  try{var d=await request('/v1/account/tasks/'+encodeURIComponent(ws.task.taskId));if(stopped||paused||revision!==readRevision)return;if(!d.task||String(d.task.taskId)!==String(ws.task.taskId))throw new Error('TASK_IDENTITY_MISMATCH');ws.task=d.task;render(d.task);win.document.getElementById('journeyWorkspaceNotice')?.remove();}
  catch(e){if(!stopped&&!paused&&revision===readRevision)workspaceNotice(root,e.status===401?'Сессия закончилась. Войдите, чтобы обновить задачу.':'Не удалось обновить статус. Показаны последние полученные данные.',()=>{if(e.status===401)navigate('/?login=1&return='+encodeURIComponent(safeReturn(win.location.pathname+win.location.search)));else refresh();});}
  finally{refreshing=false;schedule();}
 }
 function schedule(){if(timer)win.clearTimeout(timer);timer=null;if(stopped||paused||win.document.hidden||!pendingTask(ws.task))return;if(Date.now()-started>600000){workspaceNotice(root,'Автоматическое обновление приостановлено. Проверьте статус вручную.',()=>{started=Date.now();refresh();});return;}timer=win.setTimeout(refresh,ws.task.status?.code==='researching'?5000:15000);}
 function visibility(){if(win.document.hidden){if(timer)win.clearTimeout(timer);}else{started=Date.now();if(pendingTask(ws.task))refresh();}}
 function pagehide(e){if(e.persisted){paused=true;readRevision++;if(timer)win.clearTimeout(timer);}else dispose();}
 function pageshow(e){if(e.persisted&&!stopped){paused=false;started=Date.now();refresh();}}
 function dispose(){stopped=true;ws.disposed=true;readRevision++;if(timer)win.clearTimeout(timer);root.removeEventListener('click',click);win.document.removeEventListener('visibilitychange',visibility);win.removeEventListener('pagehide',pagehide);win.removeEventListener('pageshow',pageshow);}
 function click(e){var buy=e.target.closest('[data-buy-plan]');if(buy){e.preventDefault();openCheckout({taskId:ws.task.taskId,task:ws.task,research:ws.task.research,pricing:ws.task.pricing,plan:buy.dataset.buyPlan,title:ws.task.title,region:ws.task.region,trigger:buy}).catch(()=>{workspaceNotice(root,'Не удалось открыть тарифы. Обновите статус задачи.',refresh);});return;}
 var send=e.target.closest('[data-send-outreach]');if(send){e.preventDefault();sendOutreach(ws,send.dataset.sendOutreach,send).catch(()=>{});}}
 win.document.addEventListener('visibilitychange',visibility);win.addEventListener('pagehide',pagehide);win.addEventListener('pageshow',pageshow);root.addEventListener('click',click);
 schedule();return ws;
}
function outreachMessage(t){var j=t.taskJson||{},fields=Array.isArray(j.requestFields)&&j.requestFields.length?j.requestFields:['итоговую стоимость','что входит в работы и материалы','возможные доплаты','срок выполнения','гарантию'];return ['Добрый день!','',t.title||j.category||'Задача','','Задача:','— '+(t.description||j.description||j.scope||'Нужен расчёт по задаче'),t.region?'— Регион: '+t.region:'',j.goal?'— Желаемый результат: '+j.goal:'',j.timing?'— Сроки: '+j.timing:'',j.wallSize?'— Размеры: '+j.wallSize:'','','В ответе укажите:',...fields.map(x=>'— '+x),'','Ответьте, пожалуйста, обычным ответом на это письмо — сервис «Сделает» добавит предложение в сравнение.'].filter(x=>x!==null).join('\n');}
var unresolvedOutreach=new Set();
function outreachPendingKey(key){return 'sdelaet.journey.outreach-pending.v1.'+encodeURIComponent(key);}
function outreachUnresolved(key){return unresolvedOutreach.has(key)||!!readStorage(storage('sessionStorage'),outreachPendingKey(key));}
function markOutreachUnresolved(key){unresolvedOutreach.add(key);writeStorage(storage('sessionStorage'),outreachPendingKey(key),{pending:true,at:Date.now()});}
function sendOutreach(ws,candidateId,btn){var key=ws.task.taskId+':'+candidateId;return win.sdMotion.once('outreach:'+key,async function(){
 var c=(ws.task.candidates||[]).find(x=>x.id===candidateId);if(!c?.email||ws.task.payment?.status!=='paid')return false;
 if((ws.task.outreach||[]).some(a=>a.candidateId===candidateId)||outreachUnresolved(key)){await ws.refresh();workspaceNotice(ws.root,'Сначала проверьте статус предыдущего обращения. Повторное письмо не отправлено.',ws.refresh);return false;}
 var message=outreachMessage(ws.task),confirm=adapters.confirm||win.sdMotion.confirmMessage;
 if(!await confirm('Запрос для «'+(c.name||'исполнителя')+'»',message,c.email))return false;
 var finish=win.sdMotion.button(btn,'Отправляем…'),box=stateBox('outreachProgress-'+String(candidateId).replace(/[^a-z0-9_-]/gi,'_'),btn.closest('.account-mini-card')||btn),op=win.sdMotion.operation(box,{state:'pending',title:'Подготавливаем обращение',note:'Отправка подтверждена вами.'});
 markOutreachUnresolved(key);
 try{var auth=await post('/v1/account/tasks/'+encodeURIComponent(ws.task.taskId)+'/outreach-authorize',{candidateId:c.id,message:message,explicitConfirm:true,idempotencyKey:'task:'+key+':'+Date.now()});if(!auth.authorizationId)throw new Error('AUTHORIZATION_NOT_CONFIRMED');
  var prepared=await post('/v1/outreach/prepare',{taskId:ws.task.taskId,searchRunId:ws.task.research?.runId||'',authorizationId:auth.authorizationId,candidate:{id:c.id,name:c.name,type:c.type,email:c.email},channel:'email',recipient:c.email,subject:'Запрос по задаче в сервисе «Сделает»',message:message});
  if(!prepared.outreach?.requestId)throw new Error('PREPARE_NOT_CONFIRMED');op.set('pending','Передаём письмо','Проверим итоговый статус в этой задаче.');
  await post('/v1/outreach/email/send',{requestId:prepared.outreach.requestId,authorizationId:auth.authorizationId});
  await ws.refresh();var a=(ws.task.outreach||[]).find(x=>x.candidateId===c.id);
  if(a&&['sent','delivered','replied'].includes(a.status)){op.set('saved','Письмо отправлено','Ответ появится в этой задаче.');track('task_outreach_sent',{task_id:ws.task.taskId,candidate_id:c.id,channel:'email'});}
  else if(a?.status==='failed')op.set('error','Письмо не отправлено','Проверьте статус обращения.');
  else op.set('pending','Статус отправки уточняется','Повторное письмо не запускается автоматически.');return true;
 }catch(e){op.set('error','Статус отправки не подтверждён','Проверьте обращение в задаче перед повторным действием.');workspaceNotice(ws.root,'Соединение прервалось. Не отправляйте повторно, пока не проверен статус обращения.',ws.refresh);return false;}
 finally{op.dispose();finish();}
 });}
function initPaymentReturn(options){
 var doc=win.document,order=options?.order||new URLSearchParams(win.location.search).get('order')||'',title=doc.getElementById('title'),lead=doc.getElementById('lead'),box=doc.getElementById('status'),go=doc.getElementById('continueBtn'),retry=doc.getElementById('retryBtn');if(!title||!box)return;
 var done=false,timer=null,attempts=0,stopped=false,paused=false,returnRevision=0,tracked=false;var mark=doc.querySelector('.payment-mark');if(mark){mark.classList.remove('sj-success-mark');mark.textContent='…';}if(go)go.classList.add('hidden');
 if(win.sdAnalytics)win.sdAnalytics.paymentReturn({order_id:order,result_page:'success'});
 function check(){return win.sdMotion.once('payment-status:'+order,async function(){if(done||stopped||paused)return;var revision=returnRevision;if(timer){win.clearTimeout(timer);timer=null;}attempts++;var end=win.sdMotion.button(retry,'Проверяем…');
 try{var d=await request('/api/payments/v1/payments/'+encodeURIComponent(order));if(stopped||paused||revision!==returnRevision)return;var paid=d.order||{},s=paid.status;if(paid.id&&String(paid.id)!==String(order))throw new Error('ORDER_IDENTITY_MISMATCH');
  if(s==='paid'){
   if(!tracked){tracked=true;if(win.sdAnalytics)win.sdAnalytics.paymentStatus(s,{order_id:order,payment_id:paid.operationId||order,task_id:paid.taskId||'',tariff:paid.plan||'',price:Number(paid.paidAmount||paid.amount||0),currency:'RUB',ym_client_id:paid.ymClientId||'',intent_cluster:paid.attribution?.intent_cluster||''});}
   title.textContent='Оплата подтверждена';lead.textContent='Проверяем, что доступ к подбору открыт.';if(mark&&!mark.classList.contains('sj-success-mark'))win.sdMotion.successMark(mark);
   var pending=readStorage(storage('localStorage'),'sdelaet.payment.pending')||{},taskId=paid.taskId||(pending.orderId===order?pending.taskId:'');
   if(!taskId){box.innerHTML=win.sdMotion.statusHtml('pending','Проверяем привязку к задаче','Откройте «Мои задачи» и проверьте статус.');go.href='/my-tasks.html';go.textContent='Мои задачи';go.classList.remove('hidden');return;}
   var taskData=await request('/v1/account/tasks/'+encodeURIComponent(taskId));
   if(stopped||paused||revision!==returnRevision)return;
   if(taskData.task?.payment?.status==='paid'&&String(taskData.task.taskId)===String(taskId)){done=true;lead.textContent='Доступ открыт. Продолжайте в вашей задаче.';box.innerHTML=win.sdMotion.statusHtml('ready','Подбор доступен','Оплата, исполнители и ответы — в одной задаче.');go.href=taskUrl(taskId,'#selection');go.textContent='Открыть задачу →';go.classList.remove('hidden');retry.classList.add('hidden');try{storage('sessionStorage').removeItem(RESUME);storage('sessionStorage').removeItem(selectionKey(taskId));}catch{};win.sdMotion.reveal(box);win.sdMotion.animate(go,{duration:200});}
   else box.innerHTML=win.sdMotion.statusHtml('pending','Доступ обновляется','Оплата подтверждена. Повторно платить не нужно.');
  }else if(['failed','cancelled','canceled','expired'].includes(s)){done=true;title.textContent='Оплата не завершена';lead.textContent='Проверьте статус операции в банке перед повторной оплатой.';box.innerHTML=win.sdMotion.statusHtml('error','Платёж не подтверждён','Задача сохранена.');go.href='/my-tasks.html';go.textContent='Мои задачи';go.classList.remove('hidden');}
  else{title.textContent='Проверяем оплату';lead.textContent='Переход из банка сам по себе не подтверждает оплату.';box.innerHTML=win.sdMotion.statusHtml('pending','Ожидаем статус заказа','Не оплачивайте повторно, пока уточняется результат.');}
 }catch(e){if(stopped||paused||revision!==returnRevision)return;box.innerHTML=win.sdMotion.statusHtml('offline',e.status===401?'Войдите, чтобы проверить доступ':'Не удалось получить статус','Данные оплаты не подтверждены. Не запускайте повторный платёж.');if(e.status===401){go.href='/?login=1&return='+encodeURIComponent(safeReturn(win.location.pathname+win.location.search));go.textContent='Войти и проверить';go.classList.remove('hidden');}}
 finally{end();if(!done&&!stopped&&!paused&&!doc.hidden&&attempts<8)timer=win.setTimeout(check,3000);else if(!done&&!stopped&&!paused&&attempts>=8){var hint=doc.createElement('p');hint.textContent='Автоматическая проверка приостановлена. Нажмите «Проверить ещё раз».';box.appendChild(hint);}}
 });}
 retry.onclick=function(){attempts=0;check();};
 win.addEventListener('pagehide',e=>{returnRevision++;if(timer)win.clearTimeout(timer);if(e.persisted)paused=true;else stopped=true;});
 win.addEventListener('pageshow',e=>{if(e.persisted&&!stopped){paused=false;attempts=0;if(!done)check();}});
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden){if(timer)win.clearTimeout(timer);}else if(!done&&!stopped&&!paused){attempts=0;check();}});
 if(order)check();else{title.textContent='Номер заказа не найден';lead.textContent='Проверьте оплату в вашей задаче, не создавая новый платёж.';box.textContent='Номер заказа отсутствует.';retry.hidden=true;go.href='/my-tasks.html';go.textContent='Мои задачи';go.classList.remove('hidden');}
 return {check:check};
}
function autoBoot(){win.sdMotion.boot();}
if(win){if(win.document.readyState==='loading')win.document.addEventListener('DOMContentLoaded',autoBoot,{once:true});else autoBoot();}
return Object.freeze({configure:configure,openCheckout:openCheckout,closeCheckout:closeCheckout,submitCheckout:submitCheckout,resumeCheckout:resumeCheckout,initResearch:initResearch,mountWorkspace:mountWorkspace,sendOutreach:sendOutreach,initPaymentReturn:initPaymentReturn,safeReturn:safeReturn,resumeValid:resumeValid,pendingTask:pendingTask,outreachLabel:outreachLabel,safeExternalUrl:safeExternalUrl,paymentLabel:paymentLabel,outreachMessage:outreachMessage,request:request,taskUrl:taskUrl,updateStage:updateStage});
});
