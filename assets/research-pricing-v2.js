/* One presentation contract for both entry points. Server grants all entitlements. */
(function (host, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (host) host.sdResearchPricing = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var LIMITS = Object.freeze({find:5,choice:15});
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function count(v) { if(typeof v==='string'&&/^\d+$/.test(v.trim())) v=Number(v); return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:null; }
  function money(v) { return Number(v).toLocaleString('ru-RU')+' ₽'; }
  function noun(n) { return n%100>=11&&n%100<=14?'кандидатов':n%10===1?'кандидат':n%10>=2&&n%10<=4?'кандидата':'кандидатов'; }
  function positive(v,fallback) { var n=count(v);return n!==null&&n>0?n:fallback; }
  function buildModel(input) {
    input=input||{};
    var n=count(input.count),pricing=input.pricing||{},tariffs=pricing.tariffs||{};
    var m={count:n,ready:n!==null&&n>0,sourceCount:count(input.sourceCount),strongCount:count(input.strongCount),plans:{},
      title:n===null?'Результат пока не подтверждён':n===0?'Подходящих кандидатов пока нет':'Подбор подготовлен',
      lead:n===null?'Обновите результат исследования перед оплатой.':n===0?'Уточните задачу или параметры поиска. Оплачивать пустой подбор не нужно.':'Выберите объём подбора и сколько работы поручить сервису.'};
    if(m.strongCount!==null&&(n===null||m.strongCount>n))m.strongCount=null;
    ['find','choice'].forEach(function(id){
      var t=tariffs[id]||{},limit=LIMITS[id],base=id==='find'?990:2590;
      var p={id:id,name:id==='find'?'Подбор':'До выбора',limit:limit,available:m.ready?Math.min(n,limit):0,
        amount:positive(t.amount,base),regularAmount:positive(t.regularAmount,base),
        candidateCopy:'До '+limit+' уникальных исполнителей',
        note:id==='find'?'1 дополнительный поиск в рамках задачи.':'Повторный поиск в рамках задачи, пока выбираете.',
        features:id==='find'?['Контакты и причины соответствия задаче','Источники, проверки и найденные риски','Готовое задание и текст обращения']:['Всё из «Подбора»','Соберём и структурируем ответы','Уточним пропуски и возможные доплаты','Сравним цену, работы, материалы, сроки и гарантии']};
      p.repeat=p.amount<p.regularAmount&&(t.priceType==='repeat'||!!pricing.repeatDiscount?.eligible);
      if(!p.repeat&&p.amount<p.regularAmount)p.regularAmount=p.amount;
      if(!m.ready)p.availability='Ждём результат исследования';
      else if(id==='find')p.availability=n<=limit?'На первом этапе найдено '+n+' '+noun(n)+'. Можно открыть все найденные варианты.':'На первом этапе найдено '+n+'. По тарифу откроем до '+limit+' исполнителей.';
      else p.availability=n<limit?'На первом этапе найдено '+n+' '+noun(n)+'. Продолжим поиск и сможем расширить подбор до '+limit+'.':'На первом этапе найдено '+n+'. Тариф включает работу с подбором до '+limit+' исполнителей.';
      if(m.ready&&id==='choice'&&n<limit)p.note='Поиск не ограничен текущими '+n+': в рамках задачи можем расширить подбор до 15 подходящих исполнителей.';
      m.plans[id]=p;
    });
    return m;
  }
  function features(p){return '<ul class="rp-features">'+p.features.map(function(s){return '<li>'+esc(s)+'</li>';}).join('')+'</ul>';}
  function planBody(p){return '<div class="tariff-card-head"><strong>'+(p.repeat?'<s>'+esc(money(p.regularAmount))+'</s>':'')+esc(money(p.amount))+'</strong></div><p class="rp-candidate-copy">'+esc(p.candidateCopy)+'</p><p class="rp-availability">'+esc(p.availability)+'</p>'+features(p)+'<div class="tariff-limit">'+esc(p.note)+'</div>';}
  function cards(input,mode,selected){
    var m=buildModel(input);if(!m.ready)return '<div class="rp-empty" role="status"><b>'+esc(m.title)+'</b><p>'+esc(m.lead)+'</p></div>';
    return ['find','choice'].map(function(id){var p=m.plans[id];
      if(mode==='account')return '<section class="rp-plan account-price-card '+(id==='choice'?'choice':'')+'" data-rp-plan="'+id+'"><h3>'+esc(p.name)+'</h3>'+planBody(p)+'<button type="button" class="'+(id==='choice'?'account-primary':'account-secondary')+'" data-buy-plan="'+id+'">Выбрать тариф</button></section>';
      return '<label class="tariff-card '+(id===selected?'selected':'')+'" data-tariff-card="'+id+'"><div class="rp-radio-title"><input type="radio" name="checkoutTariff" value="'+id+'" '+(id===selected?'checked':'')+'><b>'+esc(p.name)+'</b></div>'+planBody(p)+'</label>';
    }).join('');
  }
  function renderAccount(input){var m=buildModel(input);return '<div class="rp-account-pricing"><div class="rp-section-head"><h3>Какую помощь вы выбираете?</h3><p>'+esc(m.lead)+'</p></div><div class="account-pricing rp-cards">'+cards(input,'account')+'</div><p class="rp-send-policy">Количество найденных кандидатов — не весь рынок. Обращения — только после вашего подтверждения.</p></div>';}
  return Object.freeze({buildModel:buildModel,cards:cards,renderAccount:renderAccount,escapeHtml:esc,normalizeCount:count,money:money,noun:noun,LIMITS:LIMITS});
});
