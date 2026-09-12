(function(){
  function money(v){if(v==null||v==='')return null;var n=Number(String(v).replace(/[^0-9.,]/g,'').replace(',','.'));return isFinite(n)?Math.round(n):null}
  function bool(v){if(v===true||v==='yes'||v==='included')return true;if(v===false||v==='no'||v==='excluded')return false;return null}
  function text(v){return String(v||'').toLowerCase().replace(/ё/g,'е')}
  function includesAny(s,list){return list.some(function(x){return s.indexOf(x)>=0})}
  function normalize(raw,task){raw=raw||{};task=task||{};var responseText=text(raw.rawResponse);var isFromPrice=raw.isFromPrice===true||raw.priceType==='from'||/(?:^|\s)от\s*\d|цена\s+от|стоимость\s+от/.test(responseText);var o={candidateId:raw.candidateId||'',candidateName:raw.candidateName||'',rawResponse:raw.rawResponse||'',totalPrice:money(raw.totalPrice),workPrice:money(raw.workPrice),materialsPrice:money(raw.materialsPrice),materialsIncluded:bool(raw.materialsIncluded),worksIncluded:Array.isArray(raw.worksIncluded)?raw.worksIncluded:[],materialsSystem:raw.materialsSystem||'',profileSystem:raw.profileSystem||'',glassUnit:raw.glassUnit||'',hardware:raw.hardware||'',finishSystem:raw.finishSystem||'',preparationIncluded:raw.preparationIncluded===true?true:(raw.preparationIncluded===false?false:null),floorBaseIncluded:raw.floorBaseIncluded===true?true:(raw.floorBaseIncluded===false?false:null),diagnosis:raw.diagnosis||'',repairType:raw.repairType||'',visitCost:money(raw.visitCost),diagnosticsIncluded:bool(raw.diagnosticsIncluded),partsIncluded:bool(raw.partsIncluded),sill:raw.sill===true?true:(raw.sill===false?false:null),reveals:raw.reveals===true?true:(raw.reveals===false?false:null),flashing:raw.flashing===true?true:(raw.flashing===false?false:null),openingScheme:raw.openingScheme||'',parapetReinforcement:raw.parapetReinforcement===true?true:(raw.parapetReinforcement===false?false:null),externalElements:raw.externalElements===true?true:(raw.externalElements===false?false:null),finishIncluded:bool(raw.finishIncluded),demolitionIncluded:bool(raw.demolitionIncluded),wasteRemovalIncluded:bool(raw.wasteRemovalIncluded),electricsIncluded:bool(raw.electricsIncluded),warmFloorIncluded:bool(raw.warmFloorIncluded),measurement:raw.measurement||'',leadTime:raw.leadTime||'',warranty:raw.warranty||'',extraCosts:Array.isArray(raw.extraCosts)?raw.extraCosts:[],exclusions:Array.isArray(raw.exclusions)?raw.exclusions:[],unknowns:Array.isArray(raw.unknowns)?raw.unknowns:[],isFromPrice:isFromPrice};
    var gaps=[];if(o.totalPrice==null)gaps.push('Не указана итоговая стоимость');if(o.materialsIncluded==null&&task.serviceCode!=='WINDOW_REPAIR')gaps.push('Неясно, входят ли материалы');if(!o.worksIncluded.length)gaps.push('Не раскрыт состав работ');if(!o.leadTime)gaps.push('Не указан срок');if(!o.warranty)gaps.push('Не указана гарантия');if(isFromPrice)gaps.push('Указана цена «от», итоговая стоимость не подтверждена');
    var includedText=text((o.worksIncluded||[]).join(' ')+' '+o.rawResponse),excludedText=text((o.exclusions||[]).join(' '));var taskGoal=text(task.goal);var missingCritical=[];
    function missing(label,includedTerms,excludedTerms){if(includesAny(excludedText,excludedTerms||includedTerms)||!includesAny(includedText,includedTerms))missingCritical.push(label)}
    if(task.serviceCode==='BALCONY_GLAZING'){
      var warm=/тепл|зим|круглогод/.test(taskGoal+' '+text(task.scope));
      if(!o.profileSystem)missingCritical.push('профильная система');
      if(warm&&!o.glassUnit)missingCritical.push('стеклопакет / заполнение');
      missing('монтаж остекления',['монтаж','установк']);
      if(/стар|замен/.test(text(task.currentGlazing||'')+' '+text(task.scope)))missing('демонтаж старого остекления',['демонтаж']);
      if(/вынос|расшир/.test(text(task.scope)+' '+text(task.description)))missingCritical.push('проверка допустимости выноса / изменения геометрии');
      if(o.parapetReinforcement===true&&!includesAny(includedText,['усилен','укреп','парапет']))missingCritical.push('усиление парапета');
      if(o.externalElements===false||includesAny(excludedText,['козыр','отлив','водоотвод','нащельник','добор']))missingCritical.push('наружные элементы / водоотвод');
    }else if(task.serviceCode==='WINDOW_REPLACEMENT'){
      if(!o.profileSystem)missingCritical.push('профильная система');
      if(!o.glassUnit)missingCritical.push('стеклопакет');
      if(!o.hardware)missingCritical.push('фурнитура');
      missing('монтаж окна',['монтаж','установк']);
      if(/замен|стар/i.test(taskGoal+' '+text(task.scope)))missing('демонтаж старого окна',['демонтаж']);
      if(o.sill!==true)missingCritical.push('подоконник');
      if(o.reveals!==true)missingCritical.push('откосы');
      if(o.flashing!==true)missingCritical.push('отлив');
    }else if(task.serviceCode==='BALCONY_FINISHING'){
      if(!o.finishSystem)missingCritical.push('система / материал чистовой отделки');
      if(/стар|передел/i.test(text(task.currentState||'')+' '+taskGoal+' '+text(task.scope))&&!includesAny(includedText,['демонтаж']))missingCritical.push('демонтаж старой отделки');
      if(o.preparationIncluded!==true)missingCritical.push('подготовка основания');
      if(/пол/i.test(text(task.scope)+' '+text(task.surfaces||'')+' '+responseText)&&o.floorBaseIncluded!==true)missingCritical.push('основание / подготовка пола');
      var wetText=text(task.currentState||'')+' '+text(task.description||'');if(/сыр|мокр|плес|протеч/i.test(wetText)&&!/без\s+(?:сыр|влаг|плес|протеч)|(?:сыр|влаг|плес|протеч)[^\s,.;]*\s+нет/i.test(wetText))missingCritical.push('устранение причины влаги до отделки');
    }else if(task.serviceCode==='WINDOW_REPAIR'){
      if(!o.diagnosis)missingCritical.push('диагноз / причина неисправности после осмотра');
      if(!o.repairType)missingCritical.push('конкретный вид ремонта');
      if(o.partsIncluded==null&&/фурнитур|уплотн|стеклопак|детал|запчаст/.test(responseText))missingCritical.push('входят ли детали / запчасти');
      if(o.visitCost==null&&!o.diagnosticsIncluded)missingCritical.push('стоимость выезда / диагностики');
      if(/конден|запот/.test(taskGoal+' '+text(task.scope)+' '+text(task.description))&&!/(вентиляц|влажност|температур|диагност|причин)/.test(responseText))missingCritical.push('диагностика причины конденсата');
    }else{
      var fullContour=/зим|круглогод|под ключ/.test(taskGoal)||/полный т[её]плый контур/.test(text(task.scope));
      if(fullContour){missing('пол',['пол']);missing('потолок',['потол']);missing('стены/парапет',['стен','парапет']);missing('герметизация/примыкания',['гермет','примыкан','шов']);}
      if(task.window&&/оцен|сохран|не знаю/i.test(task.window))missing('оценка остекления',['остеклен','окн','стеклопак','профил']);
    }
    var comparable=o.totalPrice;if(o.materialsIncluded===false&&o.materialsPrice!=null)comparable=(comparable||0)+o.materialsPrice;if(o.materialsIncluded===false&&o.materialsPrice==null)comparable=null;if(isFromPrice)comparable=null;if(missingCritical.length)comparable=null;
    var completeness=100-gaps.length*12-o.unknowns.length*5-o.exclusions.length*3-missingCritical.length*12;completeness=Math.max(0,Math.min(100,completeness));
    var flags=[];if(o.materialsIncluded===false&&o.materialsPrice==null)flags.push('Цена без материалов — нельзя напрямую сравнивать с полной сметой');if(isFromPrice)flags.push('Цена «от» — нужна подтверждённая итоговая стоимость');if(missingCritical.length)flags.push('В составе не подтверждены критичные позиции: '+missingCritical.join(', '));if(o.extraCosts.length)flags.push('Есть возможные дополнительные расходы');if(o.exclusions.length)flags.push('Есть исключения из стоимости');
    return Object.assign(o,{comparableTotalPrice:comparable,completenessScore:completeness,gaps:gaps,flags:flags,missingCriticalWorks:missingCritical,comparable:comparable!=null&&gaps.indexOf('Неясно, входят ли материалы')<0&&!missingCritical.length&&!isFromPrice});
  }
  function rank(list,task){var n=(list||[]).map(function(x){return normalize(x,task)});var comparable=n.filter(function(x){return x.comparable&&x.comparableTotalPrice!=null});var min=comparable.length?Math.min.apply(null,comparable.map(function(x){return x.comparableTotalPrice})):null;n.forEach(function(x){var notes=[];if(x.comparable&&min!=null&&x.comparableTotalPrice===min)notes.push('Минимальная сопоставимая цена');if(x.completenessScore>=85)notes.push('Высокая полнота предложения');if(x.flags.length)notes=notes.concat(x.flags);x.explanation=notes.join('. ');});return n.sort(function(a,b){if(a.comparable!==b.comparable)return a.comparable?-1:1;if(a.comparableTotalPrice!=null&&b.comparableTotalPrice!=null&&a.comparableTotalPrice!==b.comparableTotalPrice)return a.comparableTotalPrice-b.comparableTotalPrice;return b.completenessScore-a.completenessScore})}
  window.sdOfferNormalizer={normalize:normalize,rank:rank};
})();