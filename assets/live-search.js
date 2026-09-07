(function(){
const API_URL=window.SDELAET_SEARCH_API||'https://api.onsdelaet.ru/v1/candidates/search';
const task=readTask();
const state={all:[],filter:'all',live:false};
function readTask(){try{return JSON.parse(localStorage.getItem('sdelaet.task.v2')||'null')||{}}catch{return{}}}
function saveTask(v){localStorage.setItem('sdelaet.task.v2',JSON.stringify(v));}
function track(name,extra){window.dataLayer=window.dataLayer||[];window.dataLayer.push(Object.assign({event:name},extra||{}));}
function hostOf(url){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return''}}
function platform(url){const h=hostOf(url);return ['yandex.ru','yandex.com','uslugi.yandex.ru','2gis.ru','otzovik.com','rmnt.ru'].some(x=>h===x||h.endsWith('.'+x));}
function outbound(url,id,placement){try{const u=new URL(url);if(platform(url))return u.href;u.searchParams.set('utm_source','onsdelaet.ru');u.searchParams.set('utm_medium','referral');u.searchParams.set('utm_campaign','candidate_outbound');u.searchParams.set('utm_content',(id||'candidate')+'_'+(placement||'website'));return u.href}catch{return url}}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function toast(msg,ok){let w=document.getElementById('toastWrap');if(!w){w=document.createElement('div');w.id='toastWrap';w.className='toast-wrap';document.body.appendChild(w)}const e=document.createElement('div');e.className='toast '+(ok?'ok':'warn');e.innerHTML='<b>'+(ok?'Готово':'Не удалось выполнить поиск')+'</b><span>'+esc(msg)+'</span>';w.appendChild(e);setTimeout(()=>e.remove(),4500)}

const FALLBACK=[
{id:'mosbalkon',name:'МосБалкон',type:'company',geo:'Москва / МО',website:'https://www.mosbalkon.ru/',matchLevel:'Высокое',rankReasons:['Профильные работы по балконам.','Есть собственный сайт и контакты.'],facts:[{status:'confirmed',label:'На сайте указаны услуги по утеплению и отделке балконов.',sourceId:'m1'},{status:'unknown',label:'Минимальный объём заказа нужно уточнить.'}],sources:[{id:'m1',kind:'official_site',label:'Официальный сайт',url:'https://www.mosbalkon.ru/',host:'mosbalkon.ru'}]},
{id:'otdelka',name:'Отделка балконов',type:'company',geo:'Москва / МО',website:'https://balkonotdelka.ru/',matchLevel:'Высокое',rankReasons:['Профильная услуга по балконам.'],facts:[{status:'confirmed',label:'Компания найдена по профильному сайту.',sourceId:'o1'},{status:'unknown',label:'Локальный объём одной стены нужно подтвердить.'}],sources:[{id:'o1',kind:'official_site',label:'Официальный сайт',url:'https://balkonotdelka.ru/',host:'balkonotdelka.ru'}]},
{id:'balkony',name:'Балконы Цены',type:'company',geo:'Москва / МО',website:'https://balkony-tseny.ru/',matchLevel:'Среднее',rankReasons:['Подходит как дополнительный расчёт.'],facts:[{status:'confirmed',label:'На сайте есть балконные работы и отделка.',sourceId:'b1'}],sources:[{id:'b1',kind:'official_site',label:'Сайт компании',url:'https://balkony-tseny.ru/',host:'balkony-tseny.ru'}]},
{id:'roman-pavlenko',name:'Роман Павленко',type:'private',geo:'Мытищи',matchLevel:'Высокое',rankReasons:['Профиль найден в Яндекс Исполнителях по нужной услуге.'],facts:[{status:'confirmed',label:'Профиль найден в Яндекс Исполнителях.',sourceId:'r1'}],sources:[{id:'r1',kind:'yandex_services',label:'Яндекс Исполнители',url:'https://uslugi.yandex.ru/10740-mytischi/category?text=%D1%83%D1%82%D0%B5%D0%BF%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%B1%D0%B0%D0%BB%D0%BA%D0%BE%D0%BD%D0%B0',host:'uslugi.yandex.ru'}]},
{id:'evgeniy-u',name:'Евгений Сергеевич У.',type:'private',geo:'Москва / МО',matchLevel:'Высокое',rankReasons:['Профиль найден в Яндекс Исполнителях по утеплению балконов.'],facts:[{status:'confirmed',label:'Профиль найден в Яндекс Исполнителях.',sourceId:'e1'}],sources:[{id:'e1',kind:'yandex_services',label:'Яндекс Исполнители',url:'https://uslugi.yandex.ru/213-moscow/category/remont-i-stroitelstvo/okna-i-balkonyi/uteplenie-balkonov-i-lodzhij--1728',host:'uslugi.yandex.ru'}]}
];

function sourceById(c,id){return (c.sources||[]).find(s=>s.id===id)}
function factIcon(s){return s==='confirmed'?'✓':s==='claimed'?'◐':s==='risk'?'⚠':'?'}
function factClass(s){return s==='confirmed'?'ok':s==='claimed'?'claim':s==='risk'?'risk':'unknown'}
function kindLabel(k){return ({official_site:'Официальный сайт',web_search:'Веб-поиск',yandex_services:'Яндекс Исполнители','2gis':'2ГИС',yandex_maps:'Яндекс Карты'}[k]||'Источник')}
function renderCard(c,index){
  const facts=(c.facts||[]).map(f=>{const s=sourceById(c,f.sourceId);return `<div class="fact-row ${factClass(f.status)}"><div class="fact-icon">${factIcon(f.status)}</div><div><div>${esc(f.label)}</div>${s?`<a href="${esc(platform(s.url)?s.url:outbound(s.url,c.id,'fact'))}" target="_blank" rel="noopener">Источник: ${esc(s.label||kindLabel(s.kind))} · ${esc(s.host||hostOf(s.url))} ↗</a>`:''}</div></div>`}).join('');
  const sources=(c.sources||[]).map(s=>`<a class="source-pill" href="${esc(platform(s.url)?s.url:outbound(s.url,c.id,'source'))}" target="_blank" rel="noopener"><b>${esc(s.label||kindLabel(s.kind))}</b><span>${esc(s.host||hostOf(s.url))}</span></a>`).join('');
  const why=(c.rankReasons||[]).map(x=>`<li>${esc(x)}</li>`).join('');
  return `<article class="candidate" data-type="${esc(c.type)}"><div class="candidate-head"><div class="avatar">${esc(c.name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase())}</div><div class="candidate-title"><div class="rank-line"><span class="rank-no">#${index+1}</span><span class="type-badge ${c.type==='private'?'private':''}">${c.type==='private'?'Частный мастер':'Компания'}</span></div><h2>${esc(c.name)}</h2><div class="candidate-meta">${esc(c.geo||task.city||'')}</div></div><div class="match-badge"><small>Соответствие задаче</small><b>${esc(c.matchLevel||'Среднее')}</b></div></div><div class="candidate-grid"><section><h3>Почему выше в списке</h3><ul>${why||'<li>Найден по профильному запросу.</li>'}</ul></section><section><h3>Факты и происхождение</h3><div class="facts">${facts}</div></section></div><div class="source-caption">Все использованные источники</div><div class="source-list">${sources}</div><div class="actions"><a class="btn primary" href="requests.html?candidate=${encodeURIComponent(c.id)}">Подготовить запрос</a>${c.website?`<a class="btn secondary" href="${esc(outbound(c.website,c.id,'website'))}" target="_blank" rel="noopener">Сайт исполнителя ↗</a>`:''}</div></article>`;
}
function render(){const list=document.getElementById('candidateList');const visible=state.all.filter(c=>state.filter==='all'||c.type===state.filter);list.innerHTML=visible.map(renderCard).join('')||'<div class="empty">По выбранному фильтру кандидатов пока нет.</div>';document.getElementById('countTitle').textContent=`Найдено ${visible.length} ${state.filter==='company'?'компаний':state.filter==='private'?'частных мастеров':'кандидатов'}`;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===state.filter));list.querySelectorAll('a[target="_blank"]').forEach(a=>a.addEventListener('click',()=>track('candidate_source_click',{url:a.href})));}
function setupFilters(){document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render();track('candidate_type_filter',{contractor_type:state.filter})});}
function setupPreference(){const box=document.getElementById('preference');const current=task.executorPreference;if(current){box.classList.add('hidden');state.filter=current==='company'?'company':current==='private'?'private':'all';runSearch();return}box.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{task.executorPreference=b.dataset.choice;saveTask(task);state.filter=b.dataset.choice==='company'?'company':b.dataset.choice==='private'?'private':'all';box.classList.add('hidden');track('contractor_type_selected',{contractor_type:b.dataset.choice});runSearch();});}
async function runSearch(){
  const status=document.getElementById('searchStatus'),list=document.getElementById('candidateList'),filters=document.getElementById('filters');
  status.className='search-status loading';status.innerHTML='<div class="spinner"></div><div><b>Ищем новых исполнителей</b><span>Проверяем несколько источников и объединяем дубли…</span></div>';list.innerHTML='';filters.classList.add('hidden');
  const payload={categoryId:task.categoryId||'balcony-insulation',category:task.category||'',city:task.city||'',description:task.description||'',scope:task.scope||'',goal:task.goal||'',executorPreference:task.executorPreference||'any',limit:10};
  track('live_search_started',{category:payload.category,city:payload.city,contractor_type:payload.executorPreference});
  try{
    const r=await fetch(API_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok)throw new Error(j.message||'Search API недоступен');
    state.all=Array.isArray(j.candidates)?j.candidates:[];state.live=true;
    status.className='search-status ok';status.innerHTML=`<div class="status-dot">✓</div><div><b>Автоматический поиск завершён</b><span>${esc(String(j.count||state.all.length))} кандидатов · источники: ${j.providers?.yandexSearch?'Яндекс Поиск':''}${j.providers?.yandexSearch&&j.providers?.dgis?' + ':''}${j.providers?.dgis?'2ГИС':''}</span></div>`;
    track('live_search_completed',{count:state.all.length,providers:Object.keys(j.providers||{}).filter(k=>j.providers[k]).join(',')});
  }catch(e){
    state.all=FALLBACK.slice();state.live=false;
    status.className='search-status warn';status.innerHTML='<div class="status-dot">!</div><div><b>Живой поиск пока не подключён</b><span>Показана резервная подборка. После подключения ключей поиск будет находить новых исполнителей автоматически.</span></div>';
    track('live_search_failed',{reason:String(e&&e.message||e)});toast(String(e&&e.message||e),false);
  }
  filters.classList.remove('hidden');setupFilters();render();
}
document.addEventListener('DOMContentLoaded',()=>{if(!task||!task.city){location.href='create-task.html';return}setupPreference();});
})();
