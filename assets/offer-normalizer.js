(function(){
  function money(v){if(v==null||v==='')return null;var n=Number(String(v).replace(/[^0-9.,]/g,'').replace(',','.'));return isFinite(n)?Math.round(n):null}
  function bool(v){if(v===true||v==='yes'||v==='included')return true;if(v===false||v==='no'||v==='excluded')return false;return null}
  function text(v){return String(v||'').toLowerCase().replace(/ё/g,'е')}
  function includesAny(s,list){return list.some(function(x){return s.indexOf(x)>=0})}
  function normalize(raw,task){raw=raw||{};task=task||{};var responseText=text(raw.rawResponse);var isFromPrice=raw.isFromPrice===true||raw.priceType==='from'||/(?:^|\s)от\s*\d|цена\s+от|стоимость\s+от/.test(responseText);var o={candidateId:raw.candidateId||'',candidateName:raw.candidateName||'',rawResponse:raw.rawResponse||'',totalPrice:money(raw.totalPrice),workPrice:money(raw.workPrice),materialsPrice:money(raw.materialsPrice),materialsIncluded:bool(raw.materialsIncluded),worksIncluded:Array.isArray(raw.worksIncluded)?raw.worksIncluded:[],materialsSystem:raw.materialsSystem||'',profileSystem:raw.profileSystem||'',glassUnit:raw.glassUnit||'',hardware:raw.hardware||'',finishSystem:raw.finishSystem||'',preparationIncluded:raw.preparationIncluded===true?true:(raw.preparationIncluded===false?false:null),floorBaseIncluded:raw.floorBaseIncluded===true?true:(raw.floorBaseIncluded===false?false:null),diagnosis:raw.diagnosis||'',repairType:raw.repairType||'',visitCost:money(raw.visitCost),diagnosticsCost:money(raw.diagnosticsCost),leakSource:raw.leakSource||'',diagnosticsIncluded:bool(raw.diagnosticsIncluded),partsIncluded:bool(raw.partsIncluded),sill:raw.sill===true?true:(raw.sill===false?false:null),reveals:raw.reveals===true?true:(raw.reveals===false?false:null),flashing:raw.flashing===true?true:(raw.flashing===false?false:null),openingScheme:raw.openingScheme||'',doorCount:raw.doorCount||null,doorType:raw.doorType||'',doorDemolitionIncluded:raw.doorDemolitionIncluded===true?true:(raw.doorDemolitionIncluded===false?false:null),doorBoxIncluded:raw.doorBoxIncluded===true?true:(raw.doorBoxIncluded===false?false:null),doorTrimIncluded:raw.doorTrimIncluded===true?true:(raw.doorTrimIncluded===false?false:null),doorExtensionsIncluded:raw.doorExtensionsIncluded===true?true:(raw.doorExtensionsIncluded===false?false:null),doorHingesIncluded:raw.doorHingesIncluded===true?true:(raw.doorHingesIncluded===false?false:null),doorLockHandleIncluded:raw.doorLockHandleIncluded===true?true:(raw.doorLockHandleIncluded===false?false:null),doorOpeningPrepIncluded:raw.doorOpeningPrepIncluded===true?true:(raw.doorOpeningPrepIncluded===false?false:null),wallArea:raw.wallArea||null,wallFinishType:raw.wallFinishType||'',wallDemolitionIncluded:raw.wallDemolitionIncluded===true?true:(raw.wallDemolitionIncluded===false?false:null),wallPrimerIncluded:raw.wallPrimerIncluded===true?true:(raw.wallPrimerIncluded===false?false:null),wallPuttyIncluded:raw.wallPuttyIncluded===true?true:(raw.wallPuttyIncluded===false?false:null),wallSandingIncluded:raw.wallSandingIncluded===true?true:(raw.wallSandingIncluded===false?false:null),wallFiberglassIncluded:raw.wallFiberglassIncluded===true?true:(raw.wallFiberglassIncluded===false?false:null),wallpaperInstallationIncluded:raw.wallpaperInstallationIncluded===true?true:(raw.wallpaperInstallationIncluded===false?false:null),wallPaintingIncluded:raw.wallPaintingIncluded===true?true:(raw.wallPaintingIncluded===false?false:null),floorArea:raw.floorArea||null,flooringType:raw.flooringType||'',flooringLayout:raw.flooringLayout||'',floorBasePreparationIncluded:raw.floorBasePreparationIncluded===true?true:(raw.floorBasePreparationIncluded===false?false:null),underlayIncluded:raw.underlayIncluded===true?true:(raw.underlayIncluded===false?false:null),vaporBarrierIncluded:raw.vaporBarrierIncluded===true?true:(raw.vaporBarrierIncluded===false?false:null),floorGlueIncluded:raw.floorGlueIncluded===true?true:(raw.floorGlueIncluded===false?false:null),installationMethod:raw.installationMethod||'',floorDemolitionIncluded:raw.floorDemolitionIncluded===true?true:(raw.floorDemolitionIncluded===false?false:null),skirtingIncluded:raw.skirtingIncluded===true?true:(raw.skirtingIncluded===false?false:null),thresholdsIncluded:raw.thresholdsIncluded===true?true:(raw.thresholdsIncluded===false?false:null),tileArea:raw.tileArea||null,tileFormat:raw.tileFormat||'',tileLayout:raw.tileLayout||'',substratePreparationIncluded:raw.substratePreparationIncluded===true?true:(raw.substratePreparationIncluded===false?false:null),waterproofingIncluded:raw.waterproofingIncluded===true?true:(raw.waterproofingIncluded===false?false:null),groutType:raw.groutType||'',miter45Included:raw.miter45Included===true?true:(raw.miter45Included===false?false:null),tileCutsIncluded:raw.tileCutsIncluded===true?true:(raw.tileCutsIncluded===false?false:null),tileDemolitionIncluded:raw.tileDemolitionIncluded===true?true:(raw.tileDemolitionIncluded===false?false:null),minimumVisit:money(raw.minimumVisit),minorWorkCount:raw.minorWorkCount||null,fastenersSpecified:raw.fastenersSpecified===true?true:(raw.fastenersSpecified===false?false:null),drillingIncluded:raw.drillingIncluded===true?true:(raw.drillingIncluded===false?false:null),furnitureAssemblyIncluded:raw.furnitureAssemblyIncluded===true?true:(raw.furnitureAssemblyIncluded===false?false:null),doorHardwareIncluded:raw.doorHardwareIncluded===true?true:(raw.doorHardwareIncluded===false?false:null),radiatorSpec:raw.radiatorSpec||'',heatingConnection:raw.heatingConnection||'',heatingValvesIncluded:raw.heatingValvesIncluded===true?true:(raw.heatingValvesIncluded===false?false:null),riserWorkIncluded:raw.riserWorkIncluded===true?true:(raw.riserWorkIncluded===false?false:null),radiatorDemolitionIncluded:raw.radiatorDemolitionIncluded===true?true:(raw.radiatorDemolitionIncluded===false?false:null),radiatorInstallationIncluded:raw.radiatorInstallationIncluded===true?true:(raw.radiatorInstallationIncluded===false?false:null),heatingPressureTestIncluded:raw.heatingPressureTestIncluded===true?true:(raw.heatingPressureTestIncluded===false?false:null),plumbingPoints:raw.plumbingPoints||null,pipeMeters:raw.pipeMeters||null,pipeSystem:raw.pipeSystem||'',distributionScheme:raw.distributionScheme||'',waterDistributionIncluded:raw.waterDistributionIncluded===true?true:(raw.waterDistributionIncluded===false?false:null),drainageIncluded:raw.drainageIncluded===true?true:(raw.drainageIncluded===false?false:null),plumbingChasingIncluded:raw.plumbingChasingIncluded===true?true:(raw.plumbingChasingIncluded===false?false:null),plumbingDemolitionIncluded:raw.plumbingDemolitionIncluded===true?true:(raw.plumbingDemolitionIncluded===false?false:null),pressureTestIncluded:raw.pressureTestIncluded===true?true:(raw.pressureTestIncluded===false?false:null),fixtureType:raw.fixtureType||'',pointsCount:raw.pointsCount||null,lineCount:raw.lineCount||null,cableSpec:raw.cableSpec||'',routeSpec:raw.routeSpec||'',cableLayingIncluded:raw.cableLayingIncluded===true?true:(raw.cableLayingIncluded===false?false:null),chasingIncluded:raw.chasingIncluded===true?true:(raw.chasingIncluded===false?false:null),restorationIncluded:raw.restorationIncluded===true?true:(raw.restorationIncluded===false?false:null),panelIncluded:raw.panelIncluded===true?true:(raw.panelIncluded===false?false:null),protectionSpec:raw.protectionSpec||'',testingIncluded:raw.testingIncluded===true?true:(raw.testingIncluded===false?false:null),parapetReinforcement:raw.parapetReinforcement===true?true:(raw.parapetReinforcement===false?false:null),externalElements:raw.externalElements===true?true:(raw.externalElements===false?false:null),finishIncluded:bool(raw.finishIncluded),demolitionIncluded:bool(raw.demolitionIncluded),wasteRemovalIncluded:bool(raw.wasteRemovalIncluded),electricsIncluded:bool(raw.electricsIncluded),warmFloorIncluded:bool(raw.warmFloorIncluded),measurement:raw.measurement||'',leadTime:raw.leadTime||'',warranty:raw.warranty||'',extraCosts:Array.isArray(raw.extraCosts)?raw.extraCosts:[],exclusions:Array.isArray(raw.exclusions)?raw.exclusions:[],unknowns:Array.isArray(raw.unknowns)?raw.unknowns:[],isFromPrice:isFromPrice};
    var gaps=[];if(o.totalPrice==null)gaps.push('Не указана итоговая стоимость');if(o.materialsIncluded==null&&task.serviceCode!=='WINDOW_REPAIR'&&task.serviceCode!=='MINOR_APARTMENT_REPAIR'&&task.serviceCode!=='TILE_INSTALLATION'&&task.serviceCode!=='FLOORING_INSTALLATION'&&task.serviceCode!=='WALL_FINISHING'&&task.serviceCode!=='INTERIOR_DOORS')gaps.push('Неясно, входят ли материалы');if(!o.worksIncluded.length)gaps.push('Не раскрыт состав работ');if(!o.leadTime)gaps.push('Не указан срок');if(!o.warranty)gaps.push('Не указана гарантия');if(isFromPrice)gaps.push('Указана цена «от», итоговая стоимость не подтверждена');
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
    }else if(task.serviceCode==='BALCONY_LEAK_REPAIR'){
      if(!o.diagnosis)missingCritical.push('диагноз / подтверждённая причина');
      if(!o.leakSource)missingCritical.push('локализованный источник проблемы');
      if(o.leakSource==='козырёк / верхнее примыкание'&&!includesAny(includedText,['козыр','верхн','примыкан','кровл']))missingCritical.push('работы по козырьку / верхнему примыканию');
      if(o.leakSource==='фасадный / межпанельный шов'&&!includesAny(includedText,['фасад','межпанел','шов','гермет']))missingCritical.push('герметизация фасадного / межпанельного шва');
      if(o.leakSource==='оконный монтажный шов / примыкание'&&!includesAny(includedText,['монтажн','примыкан','гермет','шов']))missingCritical.push('герметизация оконного примыкания');
      if(o.leakSource==='плита / трещины'&&!includesAny(includedText,['плит','трещин','заделк']))missingCritical.push('ремонт плиты / трещин');
      if(o.leakSource==='конденсация / влажностный режим')missingCritical.push('решение причины конденсации после проверки вентиляции / влажности');
    }else if(task.serviceCode==='WINDOW_REPAIR'){
      if(!o.diagnosis)missingCritical.push('диагноз / причина неисправности после осмотра');
      if(!o.repairType)missingCritical.push('конкретный вид ремонта');
      if(o.partsIncluded==null&&/фурнитур|уплотн|стеклопак|детал|запчаст/.test(responseText))missingCritical.push('входят ли детали / запчасти');
      if(o.visitCost==null&&!o.diagnosticsIncluded)missingCritical.push('стоимость выезда / диагностики');
      if(/конден|запот/.test(taskGoal+' '+text(task.scope)+' '+text(task.description))&&!/(вентиляц|влажност|температур|диагност|причин)/.test(responseText))missingCritical.push('диагностика причины конденсата');
    }else if(task.serviceCode==='INTERIOR_DOORS'){
      var ds=taskGoal+' '+text(task.scope)+' '+text(task.doorType||'')+' '+text(task.oldDoors||'')+' '+text(task.doorKit||'');
      if(!o.doorType)missingCritical.push('тип двери');
      if(o.doorBoxIncluded!==true)missingCritical.push('дверная коробка / монтаж блока');
      if(o.doorTrimIncluded!==true)missingCritical.push('наличники');
      if(o.doorHingesIncluded!==true)missingCritical.push('петли');
      if(o.doorLockHandleIncluded!==true)missingCritical.push('ручки / замки / защёлки');
      if(/yes|замен|стар/.test(ds)&&o.doorDemolitionIncluded!==true)missingCritical.push('демонтаж старой двери');
      if(/hidden|sliding|double/.test(ds)&&o.doorOpeningPrepIncluded!==true)missingCritical.push('подготовка / проверка проёма');
    }else if(task.serviceCode==='WALL_FINISHING'){
      var ws=taskGoal+' '+text(task.scope)+' '+text(task.finishType||'')+' '+text(task.wallState||'')+' '+text(task.quality||'');
      var wallpaper=/wallpaper|обо/.test(ws),paint=/paint|покрас|краск/.test(ws);
      if(o.wallPrimerIncluded!==true)missingCritical.push('грунтовка стен');
      if(o.wallPuttyIncluded!==true)missingCritical.push('шпаклёвка / подготовка основания');
      if(paint&&o.wallSandingIncluded!==true)missingCritical.push('шлифовка под покраску');
      if(paint&&o.wallPaintingIncluded!==true)missingCritical.push('покраска стен');
      if(wallpaper&&o.wallpaperInstallationIncluded!==true)missingCritical.push('поклейка обоев');
      if(/old_wallpaper|old_paint|стар/.test(ws)&&o.wallDemolitionIncluded!==true)missingCritical.push('демонтаж старого покрытия');
    }else if(task.serviceCode==='FLOORING_INSTALLATION'){
      var fs=taskGoal+' '+text(task.scope)+' '+text(task.flooringType||'')+' '+text(task.layout||'')+' '+text(task.baseState||'');
      if(!o.flooringType)missingCritical.push('тип напольного покрытия');
      if(!o.flooringLayout)missingCritical.push('схема укладки');
      if(o.floorBasePreparationIncluded!==true)missingCritical.push('подготовка / оценка основания');
      if(/laminate|spc|engineered|ламинат|паркет|кварц/.test(fs)&&o.underlayIncluded!==true&&o.installationMethod!=='glued')missingCritical.push('подложка');
      if(/engineered|паркет/.test(fs)&&!o.installationMethod)missingCritical.push('способ укладки');
      if(/old_covering|стар.{0,10}покрыт/.test(fs)&&o.floorDemolitionIncluded!==true)missingCritical.push('демонтаж старого покрытия');
    }else if(task.serviceCode==='TILE_INSTALLATION'){
      var ts=taskGoal+' '+text(task.scope)+' '+text(task.tileZone||'')+' '+text(task.tileFormat||'')+' '+text(task.layout||'');
      if(!o.tileFormat)missingCritical.push('тип / формат плитки');
      if(!o.tileLayout)missingCritical.push('раскладка');
      if(o.substratePreparationIncluded!==true)missingCritical.push('подготовка основания');
      if(/wet_room|ванн|сануз|душ/.test(ts)&&o.waterproofingIncluded!==true)missingCritical.push('гидроизоляция мокрой зоны');
      if(!o.groutType)missingCritical.push('тип затирки');
      if(o.tileCutsIncluded!==true)missingCritical.push('подрезка / отверстия');
    }else if(task.serviceCode==='MINOR_APARTMENT_REPAIR'){
      var ms=taskGoal+' '+text(task.scope)+' '+text(task.repairJob||'')+' '+text(task.workList||'');
      if(!o.worksIncluded.length)missingCritical.push('перечень работ');
      if(/mounting|креп|полк|карниз|зеркал|телевиз/.test(ms)&&o.drillingIncluded!==true)missingCritical.push('сверление / монтаж крепежа');
      if(/mounting|креп|полк|карниз|зеркал|телевиз/.test(ms)&&o.fastenersSpecified!==true)missingCritical.push('крепёж / расходники');
      if(/furniture|мебел|шкаф|стол|комод/.test(ms)&&o.furnitureAssemblyIncluded!==true)missingCritical.push('сборка / ремонт мебели');
      if(/door_hardware|двер|ручк|замок|петл/.test(ms)&&o.doorHardwareIncluded!==true)missingCritical.push('двери / фурнитура');
    }else if(task.serviceCode==='RADIATOR_HEATING'){
      var hs=taskGoal+' '+text(task.scope)+' '+text(task.heatingJob||'')+' '+text(task.system||'')+' '+text(task.riserWork||'');
      if(!o.radiatorSpec&&!/valves/.test(hs))missingCritical.push('модель / параметры радиатора');
      if(!o.heatingConnection&&!/valves/.test(hs))missingCritical.push('схема подключения');
      if(o.heatingValvesIncluded!==true)missingCritical.push('запорная / регулирующая арматура');
      if(o.radiatorInstallationIncluded!==true&&!/valves/.test(hs))missingCritical.push('монтаж радиатора');
      if(/замен|replacement/.test(hs)&&o.radiatorDemolitionIncluded!==true)missingCritical.push('демонтаж старого радиатора');
      if(/central|стояк|yes/.test(hs)&&o.riserWorkIncluded!==true)missingCritical.push('отключение / работы со стояком');
      if(o.heatingPressureTestIncluded!==true)missingCritical.push('опрессовка / проверка герметичности');
    }else if(task.serviceCode==='PLUMBING_WORKS'){
      var pscope=taskGoal+' '+text(task.scope)+' '+text(task.plumbingJob||'');
      var network=/(развод|water_distribution|relocation|труб|водоснабж)/.test(pscope), drain=/(канализац|drainage|слив)/.test(pscope), fixture=/(fixture|смесител|унитаз|раковин|ванн)/.test(pscope);
      if(network&&!o.pipeSystem)missingCritical.push('система труб / фитингов');
      if(network&&!o.distributionScheme)missingCritical.push('схема разводки');
      if(network&&o.waterDistributionIncluded!==true)missingCritical.push('разводка водоснабжения');
      if(network&&o.pressureTestIncluded!==true)missingCritical.push('опрессовка / проверка герметичности');
      if(drain&&o.drainageIncluded!==true)missingCritical.push('канализация / слив');
      if(fixture&&!o.fixtureType)missingCritical.push('конкретный сантехнический прибор / узел');
      if(/замен/.test(pscope)&&o.plumbingDemolitionIncluded!==true)missingCritical.push('демонтаж существующего оборудования');
      if(/finished|чистов|отделк/.test(text(task.currentState)+' '+text(task.objectState))&&network&&o.plumbingChasingIncluded!==true)missingCritical.push('способ прокладки / штробление в существующей отделке');
    }else if(task.serviceCode==='ELECTRICAL_INSTALLATION'){
      var scopeText=taskGoal+' '+text(task.scope)+' '+text(task.electricalJob||'')+' '+text(task.panelScope||'');
      if(!o.cableSpec&&/(лини|проводк|розет|выключател)/.test(scopeText))missingCritical.push('марка / сечение кабеля');
      if(!o.routeSpec&&/(лини|проводк|розет|выключател)/.test(scopeText))missingCritical.push('способ прокладки кабеля');
      if(o.cableLayingIncluded!==true&&/(лини|проводк|розет|выключател)/.test(scopeText))missingCritical.push('прокладка кабеля');
      if(/щит|panel|replace|extend/.test(scopeText)){
        if(o.panelIncluded!==true)missingCritical.push('работы в электрощите');
        if(!o.protectionSpec)missingCritical.push('состав защитной автоматики');
      }
      if(/полная|full_rewire|partial_rewire|замена проводки/.test(scopeText)&&o.chasingIncluded!==true&&/finished|чистов|отделк/.test(text(task.currentState)+' '+text(task.objectState)))missingCritical.push('штробление / прокладка в существующей отделке');
      if(o.testingIncluded!==true)missingCritical.push('проверка / измерения после монтажа');
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