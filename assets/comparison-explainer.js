(function(){
  function uniq(a){return Array.from(new Set((a||[]).filter(Boolean)))}
  function money(v){return v==null?'':Number(v).toLocaleString('ru-RU')+' ₽'}
  function explain(offers,task){offers=offers||[];task=task||{};var comparable=offers.filter(function(o){return o.comparable&&o.comparableTotalPrice!=null});if(!comparable.length)return{winner:null,reasons:[],checks:['Получить хотя бы одно сопоставимое предложение с понятной итоговой ценой и составом работ.'],summary:'Пока нельзя выбрать лучший вариант: предложения требуют уточнения.'};var winner=comparable[0],others=offers.filter(function(o){return o!==winner}),reasons=[];
    var cheaperHeadline=others.find(function(o){return o.totalPrice!=null&&winner.totalPrice!=null&&o.totalPrice<winner.totalPrice&&!o.comparable});if(cheaperHeadline)reasons.push('Есть более низкая заявленная цена ('+money(cheaperHeadline.totalPrice)+'), но это предложение пока нельзя сравнивать напрямую из-за неполного состава или неопределённой комплектации.');
    if(winner.materialsIncluded===true)reasons.push('Материалы включены в подтверждённую стоимость.');
    if((winner.criticalGaps||[]).length===0)reasons.push('По критичным работам для этой задачи нет выявленных пропусков.');
    if(winner.completenessScore>=85)reasons.push('Предложение подробно раскрывает состав работ и условия.');
    var higher=others.find(function(o){return o.comparable&&o.comparableTotalPrice>winner.comparableTotalPrice});if(higher)reasons.push('Это минимальная сопоставимая стоимость: '+money(winner.comparableTotalPrice)+' против '+money(higher.comparableTotalPrice)+' у следующего сопоставимого варианта.');
    reasons=uniq(reasons).slice(0,4);
    var checks=[];if(!winner.warranty)checks.push('Зафиксировать гарантию на работы до выбора исполнителя.');if(!winner.leadTime)checks.push('Подтвердить срок выполнения работ.');if((winner.extraCosts||[]).length)checks.push('Письменно уточнить, в каких случаях возникнут дополнительные расходы.');if((winner.exclusions||[]).length)checks.push('Проверить исключения из стоимости перед договорённостью.');if(/зим|круглогод/i.test(task.goal||''))checks.push('На замере подтвердить пригодность существующего остекления и примыканий для требуемого режима.');checks.push('Зафиксировать итоговый состав работ и цену после замера до начала работ.');checks=uniq(checks).slice(0,4);
    return{winner:winner,reasons:reasons,checks:checks,summary:'На текущих данных наиболее выгодным выглядит '+(winner.candidateName||'это предложение')+' — не из-за самой низкой цифры, а по подтверждённой сопоставимой комплектации.'};
  }
  window.sdComparisonExplainer={explain:explain};
})();