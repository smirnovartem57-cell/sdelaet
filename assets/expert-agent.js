(function(){
  function arr(){return Array.prototype.slice.call(arguments).filter(Boolean)}
  function push(a,v){if(v&&a.indexOf(v)<0)a.push(v)}
  function text(task){return ((task.description||'')+' '+(task.goal||'')+' '+(task.currentState||'')+' '+(task.scope||'')+' '+(task.window||'')).toLowerCase().replace(/ё/g,'е')}

  function constructionExpert(task){
    task=task||{};
    var facts=[],observed=[],inferred=[],unknown=[],criticalMissing=[],inspection=[],risks=[],reviewReasons=[];
    var all=text(task);
    if(task.city&&task.city!=='Уточнить')push(facts,'Объект: '+task.city);else push(criticalMissing,'География объекта');
    if(task.goal&&task.goal!=='Цель уточнить')push(facts,'Цель: '+task.goal);else push(criticalMissing,'Цель использования балкона');
    if(task.window&&task.window!=='Остекление оценить')push(facts,'Остекление: '+task.window);else push(unknown,'Пригодность существующего остекления');
    if(task.currentState&&task.currentState!=='Состояние уточнить')push(facts,'Текущее состояние: '+task.currentState);else push(unknown,'Текущее состояние конструкций/отделки');
    if(task.wallSize&&task.wallSize.indexOf('Уточнить')<0)push(facts,'Примерный размер: '+task.wallSize);else push(inspection,'Точные размеры и геометрия');
    if(task.attachments&&task.attachments.length)push(observed,'Есть '+task.attachments.length+' вложений для визуальной оценки');

    var yearRound=/зим|круглогод|весь год|комнат|кабинет/.test(all);
    var moisture=/сыр|конден|промерз|плес|мокр/.test(all);
    var coldGlazing=/холодн.{0,20}(остеклен|алюмин)|алюминиев.{0,20}остеклен/.test(all);
    var glazingUnknown=/оценить|не знаю|уточнить/.test((task.window||'').toLowerCase());
    var existingFinish=/обшит|есть отделк|стар.{0,12}(утепл|отдел)|передел/.test(all);
    var mergeRoom=/объедин.{0,20}(лоджи|балкон).{0,20}(комнат|кухн)|убрат.{0,20}(блок|подокон)|демонтир.{0,20}(блок|подокон)/.test(all);
    var radiatorMove=/вынест.{0,20}(батар|радиатор)|перенест.{0,20}(батар|радиатор)|радиатор.{0,20}(лоджи|балкон)/.test(all);

    if(yearRound&&(glazingUnknown||/сохран/i.test(task.window||'')))push(risks,'Для зимнего/круглогодичного использования нужно проверить пригодность существующего остекления и монтажных примыканий.');
    if(yearRound&&coldGlazing){push(risks,'Холодное остекление не считаем автоматически пригодным для круглогодичного режима; требуется отдельное решение по остеклению.');push(unknown,'Требуемый объём работ с остеклением');}
    if(moisture)push(risks,'Причину сырости, конденсата, плесени или промерзания нельзя надёжно определить только по описанию; нужна диагностика/осмотр.');
    if(existingFinish){push(inspection,'Состав и состояние скрытых слоёв под существующей отделкой');push(risks,'При вскрытии существующей отделки могут обнаружиться дополнительные демонтажные или восстановительные работы.');}
    if(mergeRoom){push(reviewReasons,'Объединение лоджии/балкона с помещением требует отдельной технической и правовой проверки до включения в стандартный сценарий утепления.');push(risks,'Демонтаж оконно-дверного/подоконного блока нельзя автоматически считать допустимым решением.');}
    if(radiatorMove){push(reviewReasons,'Перенос радиатора/батареи на лоджию или балкон требует отдельной правовой и технической проверки.');push(risks,'Перенос радиатора центрального отопления не согласовывается сервисом автоматически.');}

    push(inspection,'Состояние скрытых оснований и существующего пирога');
    push(inspection,'Фактическое состояние швов, углов и примыканий');

    var scope=task.scope&&task.scope!=='Объём тёплого контура определить по задаче и фото'?task.scope:'Определить состав тёплого контура по цели, фото и осмотру';
    var separate=arr(task.finish&&/отдельной опцией/i.test(task.finish)?'Чистовую отделку':'','Электрику / освещение при необходимости','Электрический тёплый пол при необходимости','Работы с остеклением, если требуются');
    if(coldGlazing&&yearRound)push(separate,'Решение по замене / модернизации остекления отдельной строкой');
    if(existingFinish)push(separate,'Демонтаж существующей отделки и вскрытие скрытых слоёв отдельной строкой');
    var brief={title:'Утепление балкона / лоджии',object:task.city&&task.city!=='Уточнить'?task.city:'географию уточнить до отправки',goal:task.goal||'уточнить',currentState:arr(task.currentState),scope:arr(scope,'Оценить существующее остекление и примыкания','Указать состав предлагаемой системы утепления'),optionsSeparate:separate,responseRequirements:['Итоговая стоимость','Работы и материалы отдельно, если возможно','Что входит в цену','Что не входит в цену','Материалы и система утепления','Возможные дополнительные расходы','Срок выполнения','Условия замера','Гарантия']};
    var confidence=criticalMissing.length?'low':(unknown.length||risks.length?'medium':'high');
    return {serviceCode:task.serviceCode||'BALCONY_INSULATION',facts:facts,observed:observed,inferred:inferred,unknown:unknown,criticalMissing:criticalMissing,requiresSiteInspection:inspection,technicalRisks:risks,expertReviewReasons:reviewReasons,contractorBrief:brief,confidence:confidence};
  }

  function reviewer(task,expert){
    var issues=[],warnings=[],missing=(expert.criticalMissing||[]).slice(),unsupported=[],comparison=[],reviewReasons=(expert.expertReviewReasons||[]).slice();
    if(!expert.contractorBrief||!expert.contractorBrief.responseRequirements)push(issues,'Нет полноценного Contractor Brief');
    if(/зим|круглогод|весь год|кабинет/i.test((task.goal||'')+' '+(task.description||''))&&!/оцен|остеклен/i.test(JSON.stringify(expert.contractorBrief||{})))push(issues,'Для зимнего сценария не учтена проверка остекления');
    if(/сыр|конден|промерз|плес|мокр/i.test((task.description||'')+' '+(task.currentState||''))&&!expert.technicalRisks.length)push(issues,'Симптомы влаги/промерзания не отражены как риск');
    if(task.window&&/сохран/i.test(task.window))push(warnings,'Сохранение остекления — пожелание клиента; пригодность для требуемого режима должна быть проверена.');
    if(!task.wallSize||/Уточнить/i.test(task.wallSize))push(warnings,'Итоговая цена потребует замера; предварительные предложения сравнивать с этой оговоркой.');
    push(comparison,'Не считать предложение без материалов автоматически более выгодным, чем полная комплектация.');
    push(comparison,'Проверять одинаковый состав тёплого контура, отделки, демонтажа и сопутствующих работ.');
    var status='PASS';
    if(issues.length)status='FAIL';else if(reviewReasons.length)status='EXPERT_REVIEW_REQUIRED';else if(missing.length)status='NEEDS_DATA';else if(expert.technicalRisks.length||warnings.length)status='PASS_WITH_WARNINGS';
    return {status:status,issues:issues,warnings:warnings,missingCritical:missing,unsupportedClaims:unsupported,comparisonRisks:comparison,expertReviewReasons:reviewReasons,approvedContractorBrief:(status==='FAIL'||status==='EXPERT_REVIEW_REQUIRED')?null:expert.contractorBrief,reviewNote:status==='PASS'?'Готово к отправке исполнителям':status==='PASS_WITH_WARNINGS'?'Можно отправлять, сохраняя предупреждения и неопределённости':status==='NEEDS_DATA'?'Сначала получить критически недостающие данные':status==='EXPERT_REVIEW_REQUIRED'?'Стандартный сценарий остановлен: нужна отдельная техническая/правовая проверка':'ТЗ требует исправления'};
  }

  function run(task){var expert=constructionExpert(task),qa=reviewer(task,expert);return{expert:expert,qa:qa,agentVersion:'construction-domain-expert-v1.1',reviewerVersion:'technical-expert-reviewer-v1.1'}}
  window.sdExpertAgent={run:run,constructionExpert:constructionExpert,reviewer:reviewer};
})();