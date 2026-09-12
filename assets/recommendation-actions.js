(function(){
  var MAP={
    RECOMMENDED:{title:'Следующий шаг',action:'Запросить финальный замер и зафиксировать итоговую комплектацию, цену, срок и гарантию до начала работ.',cta:'Подготовиться к выбору'},
    GOOD_ALTERNATIVE:{title:'Оставить как резерв',action:'Сохранить предложение как альтернативу и сравнить после финального замера или если условия рекомендованного варианта изменятся.',cta:'Оставить резервным'},
    NEEDS_CLARIFICATION:{title:'Нужно уточнить',action:'Запросить недостающие данные по цене, составу работ, материалам, сроку и гарантии, затем пересчитать сравнение.',cta:'Уточнить у исполнителя'},
    NOT_COMPARABLE:{title:'Сначала привести к сопоставимому виду',action:'Получить фиксированную цену и понятную комплектацию. До этого не использовать предложение для выбора победителя.',cta:'Получить полную смету'},
    HIGH_RISK:{title:'Не выбирать без дополнительной проверки',action:'Проверить договорные условия, предоплату, гарантию и критичные технические риски. При невозможности снять риск — исключить предложение.',cta:'Проверить риски'}
  };
  function build(statusResult,offer,task){var st=statusResult&&statusResult.status||'NEEDS_CLARIFICATION',base=MAP[st]||MAP.NEEDS_CLARIFICATION,steps=[];offer=offer||{};task=task||{};
    if(st==='RECOMMENDED'){steps.push('Назначить замер');steps.push('Попросить финальную смету после замера');steps.push('Зафиксировать цену и состав работ письменно');if(!offer.warranty)steps.push('Уточнить гарантию');if(/зим|круглогод/i.test(task.goal||''))steps.push('Подтвердить пригодность остекления и примыканий');}
    if(st==='GOOD_ALTERNATIVE'){steps.push('Не закрывать контакт до финального выбора');steps.push('Сравнить финальную цену после замера с рекомендованным вариантом');}
    if(st==='NEEDS_CLARIFICATION'){(offer.gaps||[]).slice(0,3).forEach(function(x){steps.push(x)});(offer.missingCriticalWorks||[]).slice(0,3).forEach(function(x){steps.push('Подтвердить: '+x)});}
    if(st==='NOT_COMPARABLE'){if(offer.isFromPrice)steps.push('Получить фиксированную цену вместо «от»');if(offer.materialsIncluded===false&&offer.materialsPrice==null)steps.push('Получить стоимость материалов');if(!offer.worksIncluded||!offer.worksIncluded.length)steps.push('Получить перечень работ');}
    if(st==='HIGH_RISK'){steps.push('Не вносить существенную предоплату без договора');steps.push('Проверить гарантию и порядок оплаты');if((offer.exclusions||[]).length)steps.push('Проверить критичные исключения');}
    return{status:st,title:base.title,action:base.action,cta:base.cta,steps:steps.slice(0,5)};
  }
  function buildAll(statusResults,offers,task){return(offers||[]).map(function(o,i){return build((statusResults||[])[i]||{},o,task)})}
  window.sdRecommendationActions={build:build,buildAll:buildAll};
})();