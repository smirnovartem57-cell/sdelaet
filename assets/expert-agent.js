(function(){
  function arr(){return Array.prototype.slice.call(arguments).filter(Boolean)}
  function push(a,v){if(v&&a.indexOf(v)<0)a.push(v)}

  function constructionExpert(task){
    task=task||{};
    var facts=[],observed=[],inferred=[],unknown=[],criticalMissing=[],inspection=[],risks=[];
    if(task.city&&task.city!=='Уточнить')push(facts,'Объект: '+task.city);else push(criticalMissing,'География объекта');
    if(task.goal&&task.goal!=='Цель уточнить')push(facts,'Цель: '+task.goal);else push(criticalMissing,'Цель использования балкона');
    if(task.window&&task.window!=='Остекление оценить')push(facts,'Остекление: '+task.window);else push(unknown,'Пригодность существующего остекления');
    if(task.currentState&&task.currentState!=='Состояние уточнить')push(facts,'Текущее состояние: '+task.currentState);else push(unknown,'Текущее состояние конструкций/отделки');
    if(task.wallSize&&task.wallSize.indexOf('Уточнить')<0)push(facts,'Примерный размер: '+task.wallSize);else push(inspection,'Точные размеры и геометрия');
    if(task.attachments&&task.attachments.length)push(observed,'Есть '+task.attachments.length+' вложений для визуальной оценки');

    var yearRound=/зим|круглогод/i.test(task.goal||'');
    var problem=/сыр|конден|промерз|плес|холод/i.test((task.goal||'')+' '+(task.currentState||'')+' '+(task.description||''));
    var glazingUnknown=/оценить|не знаю|уточнить/i.test(task.window||'');
    if(yearRound&&(glazingUnknown||/сохран/i.test(task.window||'')))push(risks,'Для зимнего/круглогодичного использования нужно проверить пригодность существующего остекления и монтажных примыканий.');
    if(problem)push(risks,'Причину сырости, конденсата или промерзания нельзя надёжно определить только по описанию; нужна диагностика/осмотр.');
    push(inspection,'Состояние скрытых оснований и существующего пирога');
    push(inspection,'Фактическое состояние швов, углов и примыканий');

    var title='Утепление балкона / лоджии';
    var scope=task.scope&&task.scope!=='Объём тёплого контура определить по задаче и фото'?task.scope:'Определить состав тёплого контура по цели, фото и осмотру';
    var brief={
      title:title,
      object:task.city&&task.city!=='Уточнить'?task.city:'географию уточнить до отправки',
      goal:task.goal||'уточнить',
      currentState:arr(task.currentState),
      scope:arr(scope,'Оценить существующее остекление и примыкания','Указать состав предлагаемой системы утепления'),
      optionsSeparate:arr(task.finish&&/отдельной опцией/i.test(task.finish)?'Чистовую отделку':'','Электрику / освещение при необходимости','Электрический тёплый пол при необходимости','Работы с остеклением, если требуются'),
      responseRequirements:['Итоговая стоимость','Работы и материалы отдельно, если возможно','Что входит в цену','Что не входит в цену','Материалы и система утепления','Возможные дополнительные расходы','Срок выполнения','Условия замера','Гарантия']
    };
    var confidence=criticalMissing.length?'low':(unknown.length||risks.length?'medium':'high');
    return {serviceCode:task.serviceCode||'BALCONY_INSULATION',facts:facts,observed:observed,inferred:inferred,unknown:unknown,criticalMissing:criticalMissing,requiresSiteInspection:inspection,technicalRisks:risks,contractorBrief:brief,confidence:confidence};
  }

  function reviewer(task,expert){
    var issues=[],warnings=[],missing=(expert.criticalMissing||[]).slice(),unsupported=[],comparison=[];
    if(!expert.contractorBrief||!expert.contractorBrief.responseRequirements)push(issues,'Нет полноценного Contractor Brief');
    if(/зим|круглогод/i.test(task.goal||'')&&!/оцен|остеклен/i.test(JSON.stringify(expert.contractorBrief||{})))push(issues,'Для зимнего сценария не учтена проверка остекления');
    if(/сыр|конден|промерз|плес/i.test((task.description||'')+' '+(task.currentState||''))&&!expert.technicalRisks.length)push(issues,'Симптомы влаги/промерзания не отражены как риск');
    if(task.window&&/сохран/i.test(task.window))push(warnings,'Сохранение остекления — пожелание клиента; пригодность для требуемого режима должна быть проверена.');
    if(!task.wallSize||/Уточнить/i.test(task.wallSize))push(warnings,'Итоговая цена потребует замера; предварительные предложения сравнивать с этой оговоркой.');
    push(comparison,'Не считать предложение без материалов автоматически более выгодным, чем полная комплектация.');
    push(comparison,'Проверять одинаковый состав тёплого контура, отделки, демонтажа и сопутствующих работ.');
    var status='PASS';
    if(issues.length)status='FAIL';else if(missing.length)status='NEEDS_DATA';else if(expert.technicalRisks.length||warnings.length)status='PASS_WITH_WARNINGS';
    return {status:status,issues:issues,warnings:warnings,missingCritical:missing,unsupportedClaims:unsupported,comparisonRisks:comparison,approvedContractorBrief:status==='FAIL'?null:expert.contractorBrief,reviewNote:status==='PASS'?'Готово к отправке исполнителям':status==='PASS_WITH_WARNINGS'?'Можно отправлять, сохраняя предупреждения и неопределённости':status==='NEEDS_DATA'?'Сначала получить критически недостающие данные':'ТЗ требует исправления'};
  }

  function run(task){var expert=constructionExpert(task),qa=reviewer(task,expert);return{expert:expert,qa:qa,agentVersion:'construction-domain-expert-v1',reviewerVersion:'technical-expert-reviewer-v1'}}
  window.sdExpertAgent={run:run,constructionExpert:constructionExpert,reviewer:reviewer};
})();