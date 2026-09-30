/* Visual feedback only. No fabricated progress, network retries or paid grants. */
(function(host,factory){'use strict';var api=factory(host);if(typeof module==='object'&&module.exports)module.exports=api;if(host)host.sdMotion=api;})(typeof window!=='undefined'?window:null,function(win){
'use strict';
var labels=Object.freeze({starting:'Запускаем исследование',working:'Исследуем рынок',ready:'Подбор подготовлен',empty:'Подходящих кандидатов пока нет',error:'Не удалось завершить действие',offline:'Связь прервалась',pending:'Ожидаем подтверждение',saved:'Сохранено'});
var busyStates=new Set(['starting','working','pending']),locks=new Map(),operations=new Set();
var runningAnimations=new Set(),elementAnimations=new WeakMap(),detailStates=new WeakMap();
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function isBusy(s){return busyStates.has(s);}
function reduce(){return !!(win&&win.matchMedia&&win.matchMedia('(prefers-reduced-motion: reduce)').matches);}
function once(key,fn){if(locks.has(key))return locks.get(key);var p=Promise.resolve().then(fn);locks.set(key,p);p.finally(()=>{if(locks.get(key)===p)locks.delete(key);}).catch(()=>{});return p;}
// Every state/data update is synchronous. Animation never waits before performing work.
function play(el,frames,options){
 if(!el||reduce()||!el.animate||win?.document.hidden)return null;
 var previous=elementAnimations.get(el);if(previous)previous.cancel();
 var a=el.animate(frames,Object.assign({duration:260,easing:'cubic-bezier(.2,.7,.2,1)'},options||{}));
 elementAnimations.set(el,a);runningAnimations.add(a);
 a.finished.catch(()=>{}).finally(()=>{runningAnimations.delete(a);if(elementAnimations.get(el)===a)elementAnimations.delete(el);});return a;
}
function animate(el,options){return play(el,[{opacity:.55,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],options);}
function reveal(root){
 if(!root)return;animate(root,{duration:300});
 var cards=Array.from(root.querySelectorAll('.candidate,.account-mini-card,.demo-offer,.account-price-card'));
 cards.slice(0,6).forEach((el,i)=>animate(el,{duration:260,delay:Math.min(i,3)*35}));
}
function text(el,value){if(!el)return false;var v=String(value??'');if(el.textContent===v)return false;el.textContent=v;play(el,[{opacity:.55},{opacity:1}],{duration:140});return true;}
function layout(root,change){
 if(!root||reduce()){change();return;}
 var positions=new Map(Array.from(root.children).filter(n=>n.getClientRects().length).map(n=>[n,n.getBoundingClientRect().top]));change();
 positions.forEach((top,n)=>{if(!n.isConnected||!n.getClientRects().length)return;var dy=top-n.getBoundingClientRect().top;if(Math.abs(dy)>1&&Math.abs(dy)<500)play(n,[{transform:'translateY('+dy+'px)'},{transform:'translateY(0)'}],{duration:300});});
}
function pulse(el){if(!el)return;play(el,[{boxShadow:'0 0 0 2px rgba(71,132,216,.22)'},{boxShadow:'0 0 0 0 rgba(71,132,216,0)'}],{duration:650});}
function successMark(el){if(!el)return;el.classList.add('sj-success-mark');el.innerHTML='<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><path d="M6 14.5 11.2 20 22 8" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/></svg>';animate(el,{duration:260});}
function loading(el,label){
 if(!el)return;el.classList.add('sj-loading-placeholder');el.setAttribute('role','status');el.setAttribute('aria-live','polite');
 el.innerHTML='<span>'+esc(label||'Загружаем задачу…')+'</span><div class="sj-skeleton-lines" aria-hidden="true"><i></i><i></i><i></i></div>';
}
function toggleDetails(d){
 var old=detailStates.get(d),next=old?!old.next:!d.open,start=d.getBoundingClientRect().height;
 if(old){old.animation?.cancel();d.style.height=old.height;d.style.overflow=old.overflow;}
 var height=d.style.height,overflow=d.style.overflow;
 var token={next:next,animation:null,height:height,overflow:overflow};detailStates.set(d,token);
 // Measure the native open/closed layout, including padding, without wrapping content.
 d.open=next;var end=d.getBoundingClientRect().height;
 var summary=d.querySelector(':scope > summary');if(summary)summary.setAttribute('aria-expanded',String(next));
 if(reduce()||Math.abs(start-end)<1){detailStates.delete(d);return;}
 if(!next)d.open=true;
 d.style.height=start+'px';d.style.overflow='clip';
 token.animation=play(d,[{height:start+'px'},{height:end+'px'}],{duration:260});
 function finish(){if(detailStates.get(d)!==token)return;d.open=next;d.style.height=height;d.style.overflow=overflow;detailStates.delete(d);}
 if(token.animation)token.animation.finished.then(finish,finish);else finish();
}

function statusHtml(state,title,note){return '<div class="sj-signal" data-state="'+esc(state)+'"><span class="sj-mark" aria-hidden="true"><i></i><i></i><i></i></span><div><b class="sj-status-title">'+esc(title||labels[state]||state)+'</b><p class="sj-status-note">'+esc(note||'')+'</p><p class="sj-elapsed" hidden></p></div></div>';}
function operation(el,options){
 options=options||{};var state='',started=Date.now(),timer=null,disposed=false,buttons=options.buttons||[],oldButtons=buttons.map(b=>({b:b,disabled:b.disabled}));
 function set(next,title,note){
  if(disposed)return;if(!labels[next])throw new TypeError('Unknown state');
  if(timer){win.clearTimeout(timer);timer=null;}var was=state;state=next;
  el.hidden=false;el.dataset.flowState=state;el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.setAttribute('aria-atomic','true');
  el.innerHTML=statusHtml(state,title,note);el.dataset.pending=String(isBusy(state));el.removeAttribute('aria-busy');
  oldButtons.forEach(x=>{x.b.disabled=isBusy(state)||x.disabled;x.b.classList.toggle('sj-busy',isBusy(state));if(isBusy(state))x.b.setAttribute('aria-busy','true');else x.b.removeAttribute('aria-busy');});
  if(was!==state)animate(el);
  if(isBusy(state))timer=win.setTimeout(function(){if(disposed||!isBusy(state))return;var n=el.querySelector('.sj-elapsed');if(n){n.hidden=false;n.textContent='Ответ занимает больше обычного. Статус пока не подтверждён.';}},Math.max(0,15000-(Date.now()-started)));
 }
 function dispose(){if(disposed)return;disposed=true;if(timer)win.clearTimeout(timer);oldButtons.forEach(x=>{x.b.disabled=x.disabled;x.b.classList.remove('sj-busy');x.b.removeAttribute('aria-busy');});operations.delete(api);}
 var api={set:set,dispose:dispose,get state(){return state;}};operations.add(api);set(options.state||'starting',options.title,options.note);return api;
}
function button(b,label){if(!b)return function(){};var txt=b.textContent,disabled=b.disabled;b.disabled=true;b.textContent=label;b.setAttribute('aria-busy','true');b.classList.add('sj-busy');return function(){if(!b.isConnected)return;b.disabled=disabled;b.textContent=txt;b.removeAttribute('aria-busy');b.classList.remove('sj-busy');};}
function reconcile(root,html){
 if(root.__sjHtml===html)return false;root.__sjHtml=html;
 var doc=root.ownerDocument,temp=doc.createElement('div');temp.innerHTML=html;
 var active=doc.activeElement,focus=active&&root.contains(active)?{id:active.id,buy:active.dataset?.buyPlan,send:active.dataset?.sendOutreach}:null;
 var opened=new Map();root.querySelectorAll('details').forEach((d,i)=>opened.set(d.id||'details-'+i,d.open));
 var current=Array.from(root.children),next=Array.from(temp.children),used=new Set(),desired=[];
 next.forEach(function(n,i){var existing=n.id?current.find(x=>x.id===n.id):current[i];
   if(existing&&used.has(existing))existing=null;
   if(existing)used.add(existing);
   if(existing&&existing.outerHTML===n.outerHTML)desired.push(existing);
   else{desired.push(n);}
 });
 // Keep unchanged elements connected (focus, scroll, disclosure state and listeners).
 var added=[];desired.forEach((node,i)=>{var at=root.children[i];if(at!==node)root.insertBefore(node,at||null);if(!current.includes(node))added.push(node);});
 Array.from(root.children).forEach(node=>{if(!desired.includes(node))node.remove();});
 root.querySelectorAll('details').forEach((d,i)=>{var k=d.id||'details-'+i;if(opened.has(k)){d.open=opened.get(k);var summary=d.querySelector(':scope > summary');if(summary&&summary.hasAttribute('aria-expanded'))summary.setAttribute('aria-expanded',String(d.open));}});
 if(focus){var target=focus.id?doc.getElementById(focus.id):focus.buy?root.querySelector('[data-buy-plan="'+focus.buy+'"]'):focus.send?Array.from(root.querySelectorAll('[data-send-outreach]')).find(b=>b.dataset.sendOutreach===focus.send):null;if(target)target.focus({preventScroll:true});}
 added.forEach(n=>{reveal(n);if(n.id==='responses'||n.id==='comparison')pulse(n);});
 return true;
}
function dialog(content,label){
 var doc=win.document;doc.querySelectorAll('.sj-dialog-overlay[aria-hidden="true"]').forEach(el=>{el.__sjClosing?.cancel();el.remove();});var wrap=doc.createElement('div');wrap.className='sj-dialog-overlay';wrap.innerHTML='<section class="sj-dialog" role="dialog" aria-modal="true" tabindex="-1" aria-label="'+esc(label)+'">'+content+'</section>';doc.body.appendChild(wrap);return trap(wrap);
}
function trap(wrap,options){
 var doc=wrap.ownerDocument,previous=options?.returnFocus||doc.activeElement,savedOverflow=doc.body.style.overflow,background=[];
 var epoch=(wrap.__sjDialogEpoch||0)+1;wrap.__sjDialogEpoch=epoch;
 if(wrap.__sjClosing)wrap.__sjClosing.cancel();wrap.hidden=false;wrap.inert=false;wrap.classList.remove('sj-exit');wrap.removeAttribute('aria-hidden');wrap.style.pointerEvents='';
 Array.from(doc.body.children).forEach(el=>{if(el!==wrap&&!el.contains(wrap)&&!['SCRIPT','STYLE','LINK'].includes(el.tagName)){background.push({el:el,inert:el.inert});el.inert=true;}});
 doc.body.style.overflow='hidden';wrap.classList.add('open');var panel=wrap.querySelector('[role="dialog"]')||wrap;panel.focus({preventScroll:true});animate(panel,{duration:300});var closed=false,closing=Promise.resolve();
 function close(){
  if(closed)return closing;closed=true;wrap.removeEventListener('keydown',key);
  background.forEach(x=>x.el.inert=x.inert);doc.body.style.overflow=savedOverflow;
  wrap.inert=true;wrap.style.pointerEvents='none';wrap.classList.remove('open');wrap.classList.add('sj-exit');
  if(previous?.isConnected&&!wrap.contains(previous))previous.focus({preventScroll:true});
  if(wrap.contains(doc.activeElement)){var tab=doc.body.getAttribute('tabindex');doc.body.setAttribute('tabindex','-1');doc.body.focus({preventScroll:true});if(tab===null)doc.body.removeAttribute('tabindex');else doc.body.setAttribute('tabindex',tab);}
  wrap.setAttribute('aria-hidden','true');
  var a=play(wrap,[{opacity:1},{opacity:0}],{duration:140});wrap.__sjClosing=a;
  function finish(){if(wrap.__sjDialogEpoch!==epoch)return;wrap.classList.remove('open','sj-exit');wrap.hidden=true;wrap.__sjClosing=null;}
  if(a)closing=a.finished.then(finish,finish);else finish();return closing;
 }
 function key(e){if(e.key!=='Tab')return;var items=Array.from(panel.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')).filter(n=>n.getClientRects().length&&!n.closest('[inert]'));var first=items[0],last=items.at(-1);if(!first){e.preventDefault();panel.focus();}else if(e.shiftKey&&(doc.activeElement===first||doc.activeElement===panel)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(doc.activeElement===last||doc.activeElement===panel)){e.preventDefault();first.focus();}}
 wrap.addEventListener('keydown',key);return {wrap:wrap,close:close};
}
function confirmMessage(title,message,recipient){return new Promise(function(resolve){
 var d=dialog('<button type="button" class="sj-dialog-close" data-cancel aria-label="Закрыть">×</button><div class="eyebrow">Подтверждение отправки</div><h2>'+esc(title)+'</h2><p>Получатель: <b>'+esc(recipient)+'</b></p><pre>'+esc(message)+'</pre><p class="sj-muted">Письмо будет отправлено реально. Ответ появится в этой задаче.</p><div class="sj-actions"><button class="btn primary" type="button" data-confirm>Подтвердить отправку</button><button class="btn secondary" type="button" data-cancel>Отмена</button></div>','Подтверждение отправки');
 var done=false;function finish(v){if(done)return;done=true;d.close().then(()=>d.wrap.remove());resolve(v);}
 d.wrap.addEventListener('click',e=>{if(e.target.closest('[data-confirm]'))finish(true);else if(e.target===d.wrap||e.target.closest('[data-cancel]'))finish(false);});d.wrap.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finish(false);}});
 });}
function boot(){if(!win||win.__sjMotionBooted)return;win.__sjMotionBooted=true;var doc=win.document;
 doc.documentElement.classList.add('sj-motion');
 function init(){doc.querySelectorAll('.account-loading').forEach(el=>loading(el,el.textContent));
  doc.querySelectorAll('.app-content,.account-content,.payment-result,.demo-content').forEach(reveal);
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
 // Native navigation, middle-click, modified clicks and Back/Forward remain untouched.
 doc.addEventListener('click',e=>{var a=e.target.closest?.('a[href]');if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank'||a.hasAttribute('download'))return;try{var u=new URL(a.href,win.location.href);if(u.origin!==win.location.origin||u.pathname===win.location.pathname&&u.search===win.location.search)return;a.classList.add('sj-link-pending');}catch{}});
 // Preserve native disclosures when JS is absent; otherwise animate both directions.
 doc.addEventListener('click',e=>{var summary=e.target.closest?.('summary');if(!summary||e.defaultPrevented||e.button!==0)return;var d=summary.parentElement;if(d?.tagName!=='DETAILS'||!d.closest('.app-shell,.account-shell,.modal,.sj-dialog,.demo-shell'))return;if(e.target!==summary&&e.target.closest('a,button,input,select,textarea'))return;e.preventDefault();toggleDetails(d);});
 var preference=win.matchMedia?.('(prefers-reduced-motion: reduce)');preference?.addEventListener?.('change',e=>{if(e.matches)runningAnimations.forEach(a=>a.cancel());});
 win.addEventListener('pageshow',()=>doc.querySelectorAll('.sj-link-pending').forEach(el=>el.classList.remove('sj-link-pending')));
 win.addEventListener('pagehide',()=>{operations.forEach(op=>op.dispose());runningAnimations.forEach(a=>a.cancel());});
}
return Object.freeze({labels:labels,isBusy:isBusy,once:once,operation:operation,button:button,animate:animate,reveal:reveal,layout:layout,text:text,pulse:pulse,successMark:successMark,loading:loading,toggleDetails:toggleDetails,reconcile:reconcile,confirmMessage:confirmMessage,trap:trap,boot:boot,escapeHtml:esc,reduced:reduce,statusHtml:statusHtml});
});
