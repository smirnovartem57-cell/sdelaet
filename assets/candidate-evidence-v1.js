/** Progressive disclosure of already-collected public evidence; never grants access. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.sdCandidateEvidence=api;})(typeof window==='undefined'?null:window,function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function url(v){try{var u=new URL(String(v||''));return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function host(v){try{return new URL(url(v)).hostname.replace(/^www\./,'');}catch{return '';}}
function legalMatches(candidate,legal){
 if(!legal?.inn)return false;
 var site=host(candidate.website),source=host(legal.sourceUrl);
 var platform=/(?:^|\.)(?:yandex\.(?:ru|com)|2gis\.ru|avito\.ru)$/;
 if(site&&source&&!platform.test(site)&&(source===site||source.endsWith('.'+site)))return true;
 return legal.discoveredVia==='legal_identity_discovery'&&legal.matchSignals?.includes('domain')&&legal.matchSignals.some(s=>['phone','address'].includes(s));
}
function fnsMatches(candidate,e){return e?.fnsProfile?.available===true&&!!e.legalIdentity?.inn&&String(e.fnsProfile.inn)===String(e.legalIdentity.inn)&&legalMatches(candidate,e.legalIdentity);}
function money(n){return n!==null&&n!==undefined&&Number.isFinite(Number(n))?Number(n).toLocaleString('ru-RU')+' ₽':'';}
function render(candidate){
 var e=candidate?.evidence;if(!e||e.version!==1)return '';
 var sources=Array.isArray(e.sources)?e.sources.filter(s=>url(s.url)):[],facts=Array.isArray(e.facts)?e.facts:[],legal=e.legalIdentity,f=e.fnsProfile,domain=e.history?.domain,experience=e.history?.claimedExperience,parts=[];
 if(legal){parts.push('<div class="sj-evidence-cell"><b>Реквизиты из источника</b><p>'+esc([legal.legalForm,legal.legalName].filter(Boolean).join(' '))+'</p>'+(legal.inn?'<p>ИНН: '+esc(legal.inn)+'</p>':'')+(url(legal.sourceUrl)?'<a href="'+esc(url(legal.sourceUrl))+'" target="_blank" rel="noopener noreferrer">Источник реквизитов ↗</a>':'')+(!legalMatches(candidate,legal)?'<p class="sj-evidence-warning">Связь реквизитов с исполнителем требует проверки.</p>':'')+'</div>');}
 if(domain?.domain)parts.push('<div class="sj-evidence-cell"><b>Текущий домен</b><p>'+esc(domain.domain)+'</p>'+(domain.createdAt?'<p>Регистрация: '+esc(domain.createdAt.slice(0,10))+'</p>':'')+'</div>');
 if(experience?.sinceYear||experience?.claimedYears)parts.push('<div class="sj-evidence-cell"><b>Исполнитель заявляет</b><p>'+esc(experience.sinceYear?'Работает с '+experience.sinceYear+' года':'Опыт: '+experience.claimedYears+' лет')+'</p></div>');
 if(fnsMatches(candidate,e)){
  var status=f.statusLabel||(f.active===true?'Организация действует':f.active===false?'Организация не действует':'Статус не подтверждён'),lines=['<p>'+esc(status)+'</p>'];
  if(f.registeredAt)lines.push('<p>Регистрация юрлица: '+esc(f.registeredAt.slice(0,10))+'</p>');
  if(f.capital?.amount!=null)lines.push('<p>Уставный капитал: '+esc(money(f.capital.amount))+'</p>');
  if(f.employees?.count!=null)lines.push('<p>Сотрудники: '+esc(f.employees.count)+(f.employees.year?' · '+esc(f.employees.year):'')+'</p>');
  if(f.finance?.income!=null)lines.push('<p>Доходы: '+esc(money(f.finance.income))+(f.finance.year?' · '+esc(f.finance.year):'')+'</p>');
  if(f.msp?.label)lines.push('<p>МСП: '+esc(f.msp.label)+'</p>');
  if(f.debt?.amount>0)lines.push('<p class="sj-evidence-warning">Опубликованная задолженность: '+esc(money(f.debt.amount))+' · '+esc([f.debt.period,f.debt.year].filter(Boolean).join('.'))+'</p>');
  if(f.dataDate)lines.push('<p class="sj-muted">'+(f.cacheStatus==='stale'?'Последняя успешная проверка: ':'Дата данных: ')+esc(f.dataDate.slice(0,10))+'</p>');
  if(url(f.sourceUrl))lines.push('<a href="'+esc(url(f.sourceUrl))+'" target="_blank" rel="noopener noreferrer">Данные ФНС ↗</a>');
  parts.push('<div class="sj-evidence-cell"><b>ФНС · сведения о юрлице</b>'+lines.join('')+'</div>');
 }else if(f)parts.push('<div class="sj-evidence-cell"><b>Данные ФНС</b><p>Сведения не показаны как подтверждённые: требуется проверка доступности данных и связи юрлица с исполнителем.</p></div>');
 if(facts.length)parts.push('<div class="sj-evidence-cell sj-evidence-facts"><b>Что найдено в источниках</b>'+facts.map(f=>'<p>'+esc(({claimed:'Заявлено: ',risk:'Требует внимания: ',unknown:'Не удалось подтвердить: '})[f.status]||'')+esc(f.label)+'</p>').join('')+'</div>');
 if(sources.length)parts.push('<div class="sj-evidence-cell sj-evidence-sources"><b>Источники</b>'+sources.map(s=>'<a href="'+esc(url(s.url))+'" target="_blank" rel="noopener noreferrer">'+esc(s.label||s.host||host(s.url))+' ↗</a>').join('')+'</div>');
 if(!parts.length)return '';
 return '<details class="sj-candidate-evidence" id="candidate-evidence-'+esc(encodeURIComponent(candidate.id||''))+'"><summary>Источники и проверки</summary><div class="sj-evidence-grid">'+parts.join('')+'</div></details>';
}
return Object.freeze({render,legalMatches,fnsMatches,safeUrl:url});
});
